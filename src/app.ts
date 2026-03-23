import express from "express";
import path from "path";
import ejs from "ejs";
import fs from "fs";
import { fetchWeatherData, getLocationInfo, getRainProbabilityNext3Hours } from "./services/bmkg";
import { evaluate } from "./fuzzy/engine";
import { wateringConfig } from "./fuzzy/watering-config";

const LOCATION_ID = "35.78.13.1003";

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
    const { soilMoisture, airTemperature, airHumidity, rainPrecipitation: manualRain } = req.body;

    if (soilMoisture == null || airTemperature == null || airHumidity == null) {
      res.status(400).json({ error: "Semua field sensor harus diisi." });
      return;
    }

    let rainPrecipitation: number;
    if (manualRain != null) {
      rainPrecipitation = Number(manualRain);
    } else {
      const weatherData = await fetchWeatherData(LOCATION_ID);
      const rainEntries = getRainProbabilityNext3Hours(weatherData);
      rainPrecipitation = rainEntries.reduce((sum, e) => sum + e.tp, 0);
    }

    const result = evaluate(wateringConfig, {
      soilMoisture: Number(soilMoisture),
      airTemperature: Number(airTemperature),
      airHumidity: Number(airHumidity),
      rainPrecipitation,
    });

    res.json({
      inputs: {
        soilMoisture: Number(soilMoisture),
        airTemperature: Number(airTemperature),
        airHumidity: Number(airHumidity),
        rainPrecipitation,
      },
      memberships: result.inputMemberships,
      activeRules: result.ruleStrengths
        .filter((r) => r.strength > 0)
        .map((r) => ({
          conditions: r.rule.conditions,
          output: r.rule.output,
          strength: Math.round(r.strength * 1000) / 1000,
        })),
      wateringDuration: result.crispOutput,
    });
  } catch (err) {
    logError("POST /api/fuzzify", err);
    res.status(500).json({ error: "Gagal memproses fuzzy logic." });
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

export { app };
