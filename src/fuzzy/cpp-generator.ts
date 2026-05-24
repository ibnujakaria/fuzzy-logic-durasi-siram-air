interface FuzzySet {
  key: string;
  fn: "segitiga" | "trapesium";
  a: number; b: number; c: number; d: number;
}

interface FuzzyVariable {
  unit: string;
  min: number;
  max: number;
  sets: FuzzySet[];
}

interface FuzzyRule {
  conditions: Record<string, string>;
  output: string;
}

export interface GenerateCppInput {
  config: Record<string, FuzzyVariable>;
  rules: FuzzyRule[];
}

function fmtN(n: number): string {
  const s = String(parseFloat(String(n)));
  return s.includes(".") ? s + "f" : s;
}

function fmtFloat(n: number): string {
  const s = fmtN(n);
  return s.includes(".") ? s : s + ".0f";
}

export function generateCpp(input: GenerateCppInput): string {
  const { config, rules } = input;
  const inputKeys = ["kelembapanTanah", "suhuUdara", "kelembapanUdara", "curahHujan"];
  const outputKey = "durasiSiram";
  const L: string[] = [];

  L.push('#include "watering_config.hpp"');
  L.push('#include "fuzzy_membership.hpp"');
  L.push("");
  L.push("const FuzzyConfig& getWateringConfig() {");
  L.push("    static const FuzzyConfig config = {");
  L.push("        // --- inputs ---");
  L.push("        {");

  for (const key of inputKeys) {
    const v = config[key];
    if (!v) continue;
    L.push(`            // ${key} [${v.min}-${v.max} ${v.unit}]`);
    L.push(`            { "${key}", {`);
    v.sets.forEach((s, i) => {
      const fn = s.fn === "segitiga" ? "segitiga" : "trapesium";
      const params =
        s.fn === "segitiga"
          ? `${fmtN(s.a)}, ${fmtN(s.b)}, ${fmtN(s.c)}`
          : `${fmtN(s.a)}, ${fmtN(s.b)}, ${fmtN(s.c)}, ${fmtN(s.d)}`;
      const comma = i < v.sets.length - 1 ? "," : "";
      L.push(`                { "${s.key}", ${fn}(${params}) }${comma}`);
    });
    L.push(`            }, ${v.sets.length} },`);
  }

  L.push("        },");
  L.push(`        ${inputKeys.length}, // inputCount`);
  L.push("");

  const out = config[outputKey];
  L.push(`        // --- output: ${outputKey} [${out.min}-${out.max} ${out.unit}] ---`);
  L.push(`        { "${outputKey}", {`);
  out.sets.forEach((s, i) => {
    const fn = s.fn === "segitiga" ? "segitiga" : "trapesium";
    const params =
      s.fn === "segitiga"
        ? `${fmtN(s.a)}, ${fmtN(s.b)}, ${fmtN(s.c)}`
        : `${fmtN(s.a)}, ${fmtN(s.b)}, ${fmtN(s.c)}, ${fmtN(s.d)}`;
    const comma = i < out.sets.length - 1 ? "," : "";
    L.push(`            { "${s.key}", ${fn}(${params}) }${comma}`);
  });
  L.push(`        }, ${out.sets.length} },`);
  L.push("");

  const activeRules = rules.filter((r) =>
    inputKeys.some((k) => r.conditions[k] && r.conditions[k] !== "*")
  );

  L.push(`        // --- rules (${activeRules.length}) ---`);
  L.push("        {");
  for (const r of activeRules) {
    const conds = inputKeys.filter((k) => r.conditions[k] && r.conditions[k] !== "*");
    const condStrs = conds.map((k) => `{ "${k}", "${r.conditions[k]}" }`);
    L.push(`            { {${condStrs.join(", ")}}, ${conds.length}, "${r.output}" },`);
  }
  L.push("        },");
  L.push(`        ${activeRules.length}, // ruleCount`);
  L.push("");
  L.push("        // outputMin, outputMax");
  L.push(`        ${fmtFloat(out.min)}, ${fmtFloat(out.max)}`);
  L.push("    };");
  L.push("    return config;");
  L.push("}");

  return L.join("\n");
}
