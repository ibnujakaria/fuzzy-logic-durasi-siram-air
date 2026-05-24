# Fuzzy Logic System — Technical Documentation

> **Purpose**: Single source of truth for the Mamdani fuzzy inference system used in this project. This document is the authoritative reference for AI agents and developers working on the fuzzy logic subsystem.

## 1. System Overview

This project implements a **Mamdani-type fuzzy inference system** to determine plant watering duration. The system accepts 4 crisp inputs, applies fuzzification, evaluates a rule base, aggregates outputs, and defuzzifies to produce a single crisp output (watering duration in seconds).

### Pipeline

```
Crisp Inputs → Fuzzification → Rule Evaluation (AND=min) → Aggregation (MAX) → Defuzzification (Centroid) → Crisp Output
```

### File Map

| File | Role |
|---|---|
| `src/fuzzy/types.ts` | Core type definitions (`MembershipFn`, `LinguisticVariable`, `FuzzyRule`, `FuzzyConfig`, `FuzzifyResult`). Framework-agnostic. |
| `src/fuzzy/membership.ts` | Membership function constructors: `triangular(a,b,c)` and `trapezoidal(a,b,c,d)`. Framework-agnostic. |
| `src/fuzzy/engine.ts` | Inference engine: `evaluate(config, inputs) → FuzzifyResult`. Performs fuzzification, rule evaluation, output membership computation, and centroid defuzzification. Framework-agnostic. |
| `src/fuzzy/watering-config.ts` | Application-specific configuration: defines all linguistic variables, membership function parameters, and the 24-rule rule base. Exports `wateringConfig: FuzzyConfig`. |
| `src/services/bmkg.ts` | BMKG weather API service. Provides `fetchWeatherData(locationId)`, `getLocationInfo(data)`, `getRainProbabilityNext3Hours(data)`. |

### Agnosticism Boundary

`types.ts`, `membership.ts`, and `engine.ts` are **fully agnostic** — zero dependencies on Express, BMKG, or any application logic. They can be extracted and reused in any TypeScript project. Only `watering-config.ts` is application-specific.

---

## 2. Input Variables

### 2.1 Kelembapan Tanah (`kelembapanTanah`)

Nilai kelembapan tanah dalam persen. Semakin tinggi nilainya, semakin basah tanahnya.

- **Universe of discourse**: [0, 100] %
- **Source**: Hardware sensor (user-provided)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `kering` | Trapezoidal | (0, 0, 20, 40) | [0, 40] |
| `lembap` | Triangular | (30, 50, 70) | (30, 70) |
| `basah` | Trapezoidal | (60, 80, 100, 100) | [60, 100] |

Overlap zones: kering∩lembap at [30,40], lembap∩basah at [60,70].

### 2.2 Suhu Udara (`suhuUdara`)

- **Universe of discourse**: [0, 50] °C
- **Source**: Hardware sensor (user-provided)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `dingin` | Trapezoidal | (0, 0, 18, 25) | [0, 25] |
| `hangat` | Triangular | (22, 28, 34) | (22, 34) |
| `panas` | Trapezoidal | (32, 38, 50, 50) | [32, 50] |

Overlap zones: dingin∩hangat at [22,25], hangat∩panas at [32,34].

### 2.3 Kelembapan Udara (`kelembapanUdara`)

- **Universe of discourse**: [0, 100] %
- **Source**: Hardware sensor (user-provided)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `rendah` | Trapezoidal | (0, 0, 25, 45) | [0, 45] |
| `sedang` | Triangular | (35, 55, 75) | (35, 75) |
| `tinggi` | Trapezoidal | (65, 80, 100, 100) | [65, 100] |

Overlap zones: rendah∩sedang at [35,45], sedang∩tinggi at [65,75].

### 2.4 Curah Hujan (`curahHujan`)

Total prakiraan presipitasi 3 jam ke depan.

- **Universe of discourse**: [0, 50] mm
- **Source**: BMKG API (diambil otomatis, jumlah field `tp` dari `getRainProbabilityNext3Hours`)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `tidak_ada` | Trapezoidal | (0, 0, 0.1, 0.5) | [0, 0.5] |
| `ringan` | Triangular | (0.3, 1.5, 4) | (0.3, 4) |
| `lebat` | Trapezoidal | (3, 6, 50, 50) | [3, 50] |

Overlap zones: tidak_ada∩ringan at [0.3,0.5], ringan∩lebat at [3,4].

---

## 3. Output Variable

### Durasi Siram (`durasiSiram`)

- **Universe of discourse**: [0, 300] detik (0–5 menit)
- **Defuzzification resolution**: 200 titik diskrit

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `nol` | Trapezoidal | (0, 0, 0, 20) | [0, 20] |
| `pendek` | Triangular | (10, 60, 110) | (10, 110) |
| `sedang` | Triangular | (80, 150, 220) | (80, 220) |
| `panjang` | Triangular | (180, 240, 280) | (180, 280) |
| `sangat_panjang` | Trapezoidal | (250, 280, 300, 300) | [250, 300] |

---

## 4. Membership Functions

### Triangular `triangular(a, b, c)`

```
μ(x) = 0                  if x ≤ a or x ≥ c
μ(x) = (x - a) / (b - a)  if a < x ≤ b
μ(x) = (c - x) / (c - b)  if b < x < c
```

Peak at `b` where μ = 1. Zero outside `(a, c)`.

### Trapezoidal `trapezoidal(a, b, c, d)`

```
μ(x) = 0                  if x ≤ a or x ≥ d
μ(x) = (x - a) / (b - a)  if a < x < b
μ(x) = 1                  if b ≤ x ≤ c
μ(x) = (d - x) / (d - c)  if c < x < d
```

Plateau at [b, c] where μ = 1. When `a = b`, the left shoulder is open (μ = 1 from the start). When `c = d`, the right shoulder is open.

---

## 5. Rule Base (23 Rules)

All rules use AND (min) operator for antecedent conjunction. Rules are defined in `watering-config.ts` in the `rules` array.

### Tanah Kering — Tanpa Hujan (9 aturan)

| # | Suhu | Kelembapan Udara | → Output |
|---|---|---|---|
| 1 | panas | rendah | sangat_panjang |
| 2 | panas | sedang | sangat_panjang |
| 3 | panas | tinggi | panjang |
| 4 | hangat | rendah | sangat_panjang |
| 5 | hangat | sedang | panjang |
| 6 | hangat | tinggi | sedang |
| 7 | dingin | rendah | panjang |
| 8 | dingin | sedang | sedang |
| 9 | dingin | tinggi | pendek |

### Tanah Kering — Hujan Ringan (3 aturan)

| # | Suhu | → Output |
|---|---|---|
| 10 | panas | panjang |
| 11 | hangat | sedang |
| 12 | dingin | pendek |

Catatan: aturan ini tidak menyertakan kelembapan udara — semua nilai kelembapan cocok.

### Tanah Kering — Hujan Lebat (1 aturan)

| # | → Output |
|---|---|
| 13 | pendek |

Hanya `kelembapanTanah=kering` dan `curahHujan=lebat` yang ditentukan. Semua nilai suhu/kelembapan cocok.

### Tanah Lembap — Tanpa Hujan (7 aturan)

| # | Suhu | Kelembapan Udara | → Output |
|---|---|---|---|
| 14 | panas | rendah | panjang |
| 15 | panas | sedang | sedang |
| 16 | panas | tinggi | pendek |
| 17 | hangat | rendah | sedang |
| 18 | hangat | sedang | pendek |
| 19 | hangat | tinggi | nol |
| 20 | dingin | (semua) | nol |

### Tanah Lembap — Ada Hujan (2 aturan)

| # | Hujan | → Output |
|---|---|---|
| 21 | ringan | nol |
| 22 | lebat | nol |

### Tanah Basah (1 aturan)

| # | → Output |
|---|---|
| 23 | nol |

Hanya `kelembapanTanah=basah` yang ditentukan. Tanpa syarat — tanah basah selalu menghasilkan durasi nol.

### Rule Design Notes

- Rules with fewer conditions act as **catch-all** patterns. When a rule omits a variable (e.g., rule 13 omits temperature and humidity), the engine only checks the specified conditions. Unspecified variables do not constrain the rule's fire strength.
- The rule base is designed so that **soil moisture is the primary driver**: wet → always zero, dry → longest durations, moist → moderate. Temperature and humidity modulate within these bands. Rain acts as a suppressant.

---

## 6. Inference Process

### 6.1 Fuzzification (`fuzzifyInputs` in engine.ts)

Each crisp input value is evaluated against all membership functions of its linguistic variable, producing a degree ∈ [0, 1] for each fuzzy set.

Contoh: `kelembapanTanah = 35`
```
μ_kering(35) = (40 - 35) / (40 - 20) = 0.25
μ_lembap(35) = (35 - 30) / (50 - 30) = 0.25
μ_basah(35)  = 0
```

### 6.2 Rule Evaluation (`evaluateRules` in engine.ts)

For each rule, the fire strength is computed as the **minimum** of all condition membership degrees (AND operator):

```
strength = min(μ_condition_1, μ_condition_2, ..., μ_condition_n)
```

Only conditions explicitly listed in the rule's `conditions` object are checked. Missing variables default to not constraining the rule.

### 6.3 Output Membership Computation (`computeOutputMemberships` in engine.ts)

For each output fuzzy set, the membership degree is the **maximum fire strength** across all rules that target that set:

```
μ_output_set = MAX over all rules i targeting that set: strength_i
```

This produces a `Record<string, number>` mapping each output set name to its activation degree. This is separate from defuzzification — it shows which output sets are "active" and how strongly, before the centroid calculation.

### 6.4 Aggregation (inside `defuzzify` in engine.ts)

For each point `y` in the output domain [0, 300], the aggregated membership is:

```
μ_agg(y) = MAX over all rules i: min(strength_i, μ_output_i(y))
```

This is the standard Mamdani **clipping + MAX aggregation**.

### 6.5 Defuzzification — Centroid (`defuzzify` in engine.ts)

The crisp output is computed via the centroid (center of gravity) method:

```
y* = Σ(y × μ_agg(y)) / Σ(μ_agg(y))
```

- Resolution: 200 evenly spaced points over [0, 300]
- Step size: 1.5
- If denominator = 0 (no rules fire), output defaults to `0` (range minimum)
- Final value is rounded to the nearest integer

---

## 7. API Integration

### POST `/api/fuzzify`

**Request body:**
```json
{
  "kelembapanTanah": 20,
  "suhuUdara": 35,
  "kelembapanUdara": 30,
  "curahHujan": 0.5
}
```

`curahHujan` bersifat **opsional**. Jika disertakan, nilainya digunakan langsung (mode manual). Jika dihilangkan, server mengambilnya otomatis dari BMKG via `getRainProbabilityNext3Hours`, menjumlahkan field `tp` dari semua entri prakiraan 3 jam ke depan.

**Response:**
```json
{
  "inputs": { "kelembapanTanah": 20, "suhuUdara": 35, "kelembapanUdara": 30, "curahHujan": 0.5 },
  "memberships": { "kelembapanTanah": { "kering": 1, "lembap": 0, "basah": 0 }, ... },
  "outputMemberships": { "nol": 0, "pendek": 0, "sedang": 0, "panjang": 0.25, "sangat_panjang": 0.25 },
  "activeRules": [{ "conditions": {...}, "output": "sangat_panjang", "strength": 0.667 }],
  "durasiSiram": 279
}
```

- `memberships`: derajat keanggotaan input per variabel per himpunan fuzzy
- `outputMemberships`: kekuatan aktivasi maksimum per himpunan output (sebelum defuzzifikasi)
- `activeRules`: aturan dengan strength > 0
- `durasiSiram`: output crisp hasil defuzzifikasi dalam satuan detik

### BMKG Location

The BMKG location ID is hardcoded as `LOCATION_ID = "35.78.13.1003"` in `src/app.ts`. The BMKG service functions (`src/services/bmkg.ts`) accept `locationId` as a parameter and are location-agnostic.

---

## 8. Worked Example

**Inputs**: kelembapanTanah=10%, suhuUdara=36°C, kelembapanUdara=20%, curahHujan=0.1mm

### Step 1: Fuzzification

| Variable | Value | kering/dingin/rendah/tidak_ada | lembap/hangat/sedang/ringan | basah/panas/tinggi/lebat |
|---|---|---|---|---|
| kelembapanTanah | 10% | 1.00 | 0 | 0 |
| suhuUdara | 36°C | — | 0 (hangat) | 0.667 (panas) |
| kelembapanUdara | 20% | 1.00 | 0 | 0 |
| curahHujan | 0.1mm | 1.00 | 0 | 0 |

### Step 2: Rule Evaluation

Rule 1 fires: `{kering, panas, rendah, tidak_ada} → sangat_panjang`
```
strength = min(1.00, 0.667, 1.00, 1.00) = 0.667
```

All other rules have strength = 0 (at least one condition evaluates to 0).

### Step 3: Defuzzification

The `sangat_panjang` output set (trapezoidal 250,280,300,300) is clipped at 0.667. Centroid computation over 200 points yields **279 seconds** (~4 min 39 sec).
