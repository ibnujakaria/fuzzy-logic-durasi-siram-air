import express from "express";
import path from "path";
import ejs from "ejs";
import fs from "fs";
import { fetchWeatherData, getLocationInfo, getRainProbabilityNext3Hours } from "./services/bmkg";
import { evaluate } from "./fuzzy/engine";
import { wateringConfig } from "./fuzzy/watering-config";
import { generateCpp } from "./fuzzy/cpp-generator";
import { triangular, trapezoidal } from "./fuzzy/membership";
import type { FuzzyConfig, MembershipFn } from "./fuzzy/types";

const LOCATION_ID = "35.78.13.1003";

// --- Config converter: frontend format → FuzzyConfig ---
// Frontend sends config as { [varKey]: { sets: [{ key, fn, a, b, c, d }] } }
// and rules as [{ conditions: { [varKey]: setKey }, output: setKey }]
function buildFuzzyConfig(
  frontendConfig: Record<string, { sets: Array<{ key: string; fn: string; a: number; b: number; c: number; d: number }> }>,
  frontendRules: Array<{ conditions: Record<string, string>; output: string }>,
  inputKeys: string[],
  outputKey: string,
  outputRange: [number, number]
): FuzzyConfig {
  const buildSets = (sets: Array<{ key: string; fn: string; a: number; b: number; c: number; d: number }>) => {
    const result: Record<string, MembershipFn> = {};
    for (const s of sets) {
      result[s.key] = s.fn === "segitiga"
        ? triangular(s.a, s.b, s.c)
        : trapezoidal(s.a, s.b, s.c, s.d);
    }
    return result;
  };

  return {
    inputs: inputKeys.map((key) => ({
      name: key,
      sets: buildSets(frontendConfig[key].sets),
    })),
    output: {
      name: outputKey,
      sets: buildSets(frontendConfig[outputKey].sets),
    },
    rules: frontendRules.map((r) => ({
      conditions: r.conditions,
      output: r.output,
    })),
    outputRange,
  };
}

const VIEWS_DIR = path.join(__dirname, "..", "src", "views");

function logError(context: string, err: unknown): void {
  const timestamp = new Date().toISOString();
  const message = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[${timestamp}] [${context}] ${message}`);
}

function renderWithLayout(view: string, data: Record<string, string> = {}): string {
  const layoutPath = path.join(VIEWS_DIR, "layout.ejs");
  const viewPath = path.join(VIEWS_DIR, `${view}.ejs`);

  const viewContent = fs.readFileSync(viewPath, "utf-8");
  const rendered = ejs.render(viewContent, data, { filename: viewPath });

  const styleMatch = rendered.match(/<style>([\s\S]*?)<\/style>/);
  const style = styleMatch ? `<style>${styleMatch[1]}</style>` : "";
  const body = rendered.replace(/<style>[\s\S]*?<\/style>/, "").trim();

  const layout = fs.readFileSync(layoutPath, "utf-8");
  return ejs.render(layout, { ...data, style, body }, { filename: layoutPath });
}

const app = express();
app.use(express.json());

// --- API Routes ---

app.get("/api/weather", async (_req, res) => {
  try {
    const data = await fetchWeatherData(LOCATION_ID);
    res.json(data);
  } catch (err) {
    logError("API /api/weather", err);
    res.status(500).json({ error: "Gagal mengambil data cuaca dari BMKG" });
  }
});

app.get("/api/location", async (_req, res) => {
  try {
    const data = await fetchWeatherData(LOCATION_ID);
    res.json(getLocationInfo(data));
  } catch (err) {
    logError("API /api/location", err);
    res.status(500).json({ error: "Gagal mengambil data lokasi dari BMKG" });
  }
});

app.get("/api/rain-probability", async (_req, res) => {
  try {
    const data = await fetchWeatherData(LOCATION_ID);
    const rain = getRainProbabilityNext3Hours(data);
    res.json(rain);
  } catch (err) {
    logError("API /api/rain-probability", err);
    res.status(500).json({ error: "Gagal mengambil data prakiraan hujan" });
  }
});

app.get("/api/weather-times", async (_req, res) => {
  try {
    const data = await fetchWeatherData(LOCATION_ID);
    const cuaca = data.data[0].cuaca.flat();
    const now = new Date();
    const upcoming = cuaca
      .filter((item) => new Date(item.local_datetime) >= now)
      .map((item) => ({
        local_datetime: item.local_datetime,
        tp: item.tp,
        weather_desc: item.weather_desc,
        weather: item.weather,
        tcc: item.tcc,
      }));
    res.json(upcoming);
  } catch (err) {
    logError("API /api/weather-times", err);
    res.status(500).json({ error: "Gagal mengambil data waktu prakiraan" });
  }
});

app.post("/api/fuzzify", async (req, res) => {
  try {
    const { kelembapanTanah, suhuUdara, kelembapanUdara, curahHujan: manualRain, config: customConfig, rules: customRules } = req.body;

    if (kelembapanTanah == null || suhuUdara == null || kelembapanUdara == null) {
      res.status(400).json({ error: "Semua field sensor harus diisi." });
      return;
    }

    let curahHujan: number;
    if (manualRain != null) {
      curahHujan = Number(manualRain);
    } else {
      const weatherData = await fetchWeatherData(LOCATION_ID);
      const rainEntries = getRainProbabilityNext3Hours(weatherData);
      curahHujan = rainEntries.reduce((sum, e) => sum + e.tp, 0);
    }

    const fuzzyConfig = customConfig && customRules
      ? buildFuzzyConfig(
          customConfig,
          customRules,
          ["kelembapanTanah", "suhuUdara", "kelembapanUdara", "curahHujan"],
          "durasiSiram",
          [0, 300]
        )
      : wateringConfig;

    const result = evaluate(fuzzyConfig, {
      kelembapanTanah: Number(kelembapanTanah),
      suhuUdara: Number(suhuUdara),
      kelembapanUdara: Number(kelembapanUdara),
      curahHujan,
    });

    res.json({
      inputs: {
        kelembapanTanah: Number(kelembapanTanah),
        suhuUdara: Number(suhuUdara),
        kelembapanUdara: Number(kelembapanUdara),
        curahHujan,
      },
      memberships: result.inputMemberships,
      outputMemberships: result.outputMemberships,
      activeRules: result.ruleStrengths
        .filter((r) => r.strength > 0)
        .map((r) => ({
          conditions: r.rule.conditions,
          output: r.rule.output,
          strength: Math.round(r.strength * 1000) / 1000,
        })),
      durasiSiram: result.crispOutput,
      usingCustomConfig: !!(customConfig && customRules),
    });
  } catch (err) {
    logError("POST /api/fuzzify", err);
    res.status(500).json({ error: "Gagal memproses fuzzy logic." });
  }
});

app.post("/api/generate-cpp", (req, res) => {
  try {
    const code = generateCpp(req.body);
    res.type("text/plain").send(code);
  } catch (err) {
    logError("POST /api/generate-cpp", err);
    res.status(500).json({ error: "Gagal menghasilkan kode C++." });
  }
});

// --- Page Routes ---

app.get("/", (_req, res) => {
  try {
    const html = renderWithLayout("home", { title: "Beranda - Sistem Monitoring Cuaca" });
    res.send(html);
  } catch (err) {
    logError("GET /", err);
    res.status(500).send("Terjadi kesalahan saat memuat halaman.");
  }
});

app.get("/weather", (_req, res) => {
  try {
    const html = renderWithLayout("index", { title: "Prakiraan Cuaca - BMKG" });
    res.send(html);
  } catch (err) {
    logError("GET /weather", err);
    res.status(500).send("Terjadi kesalahan saat memuat halaman.");
  }
});

app.get("/docs", (_req, res) => {
  try {
    const html = renderWithLayout("docs", { title: "Dokumentasi Fuzzy Logic" });
    res.send(html);
  } catch (err) {
    logError("GET /docs", err);
    res.status(500).send("Terjadi kesalahan saat memuat halaman.");
  }
});

app.get("/fuzzy", (_req, res) => {
  try {
    const html = renderWithLayout("fuzzy", { title: "Fuzzy Logic - Analisis Sensor" });
    res.send(html);
  } catch (err) {
    logError("GET /fuzzy", err);
    res.status(500).send("Terjadi kesalahan saat memuat halaman.");
  }
});

app.get("/configurator", (_req, res) => {
  try {
    const html = renderWithLayout("configurator", { title: "Konfigurasi Fuzzy" });
    res.send(html);
  } catch (err) {
    logError("GET /configurator", err);
    res.status(500).send("Terjadi kesalahan saat memuat halaman.");
  }
});

export { app };
