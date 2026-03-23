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
| `src/fuzzy/engine.ts` | Inference engine: `evaluate(config, inputs) → FuzzifyResult`. Performs fuzzification, rule evaluation, and centroid defuzzification. Framework-agnostic. |
| `src/fuzzy/watering-config.ts` | Application-specific configuration: defines all linguistic variables, membership function parameters, and the 24-rule rule base. Exports `wateringConfig: FuzzyConfig`. |
| `src/services/bmkg.ts` | BMKG weather API service. Provides `fetchWeatherData(locationId)`, `getLocationInfo(data)`, `getRainProbabilityNext3Hours(data)`. |

### Agnosticism Boundary

`types.ts`, `membership.ts`, and `engine.ts` are **fully agnostic** — zero dependencies on Express, BMKG, or any application logic. They can be extracted and reused in any TypeScript project. Only `watering-config.ts` is application-specific.

---

## 2. Input Variables

### 2.1 Soil Moisture (`soilMoisture`)

Analog sensor reading. Higher value = wetter soil.

- **Universe of discourse**: [0, 1023]
- **Source**: Hardware sensor (3 user-provided fields)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `dry` | Trapezoidal | (0, 0, 200, 400) | [0, 400] |
| `moist` | Triangular | (300, 500, 700) | (300, 700) |
| `wet` | Trapezoidal | (600, 800, 1023, 1023) | [600, 1023] |

Overlap zones: dry∩moist at [300,400], moist∩wet at [600,700].

### 2.2 Air Temperature (`airTemperature`)

- **Universe of discourse**: [0, 50] °C
- **Source**: Hardware sensor (user-provided)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `cool` | Trapezoidal | (0, 0, 18, 25) | [0, 25] |
| `warm` | Triangular | (22, 28, 34) | (22, 34) |
| `hot` | Trapezoidal | (32, 38, 50, 50) | [32, 50] |

Overlap zones: cool∩warm at [22,25], warm∩hot at [32,34].

### 2.3 Air Humidity (`airHumidity`)

- **Universe of discourse**: [0, 100] %
- **Source**: Hardware sensor (user-provided)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `low` | Trapezoidal | (0, 0, 25, 45) | [0, 45] |
| `medium` | Triangular | (35, 55, 75) | (35, 75) |
| `high` | Trapezoidal | (65, 80, 100, 100) | [65, 100] |

Overlap zones: low∩medium at [35,45], medium∩high at [65,75].

### 2.4 Rain Precipitation (`rainPrecipitation`)

Total precipitation forecast for the next 3 hours.

- **Universe of discourse**: [0, 50] mm
- **Source**: BMKG API (automatically fetched, sum of `tp` fields from `getRainProbabilityNext3Hours`)

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `none` | Trapezoidal | (0, 0, 0.1, 0.5) | [0, 0.5] |
| `light` | Triangular | (0.3, 1.5, 4) | (0.3, 4) |
| `heavy` | Trapezoidal | (3, 6, 50, 50) | [3, 50] |

Overlap zones: none∩light at [0.3,0.5], light∩heavy at [3,4].

---

## 3. Output Variable

### Watering Duration (`wateringDuration`)

- **Universe of discourse**: [0, 300] seconds (0–5 minutes)
- **Defuzzification resolution**: 200 discrete points

| Fuzzy Set | Type | Parameters | Support |
|---|---|---|---|
| `zero` | Trapezoidal | (0, 0, 0, 20) | [0, 20] |
| `short` | Triangular | (10, 60, 110) | (10, 110) |
| `medium` | Triangular | (80, 150, 220) | (80, 220) |
| `long` | Triangular | (180, 240, 280) | (180, 280) |
| `very_long` | Trapezoidal | (250, 280, 300, 300) | [250, 300] |

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

## 5. Rule Base (24 Rules)

All rules use AND (min) operator for antecedent conjunction. Rules are defined in `watering-config.ts` in the `rules` array.

### Dry Soil — No Rain (9 rules)

| # | Temperature | Humidity | → Output |
|---|---|---|---|
| 1 | hot | low | very_long |
| 2 | hot | medium | very_long |
| 3 | hot | high | long |
| 4 | warm | low | very_long |
| 5 | warm | medium | long |
| 6 | warm | high | medium |
| 7 | cool | low | long |
| 8 | cool | medium | medium |
| 9 | cool | high | short |

### Dry Soil — Light Rain (3 rules)

| # | Temperature | → Output |
|---|---|---|
| 10 | hot | long |
| 11 | warm | medium |
| 12 | cool | short |

Note: these rules do not specify humidity — any humidity level matches.

### Dry Soil — Heavy Rain (1 rule)

| # | → Output |
|---|---|
| 13 | short |

Only `soilMoisture=dry` and `rainPrecipitation=heavy` are specified. All temperature/humidity values match.

### Moist Soil — No Rain (7 rules)

| # | Temperature | Humidity | → Output |
|---|---|---|---|
| 14 | hot | low | long |
| 15 | hot | medium | medium |
| 16 | hot | high | short |
| 17 | warm | low | medium |
| 18 | warm | medium | short |
| 19 | warm | high | zero |
| 20 | cool | (any) | zero |

### Moist Soil — Any Rain (2 rules)

| # | Rain | → Output |
|---|---|---|
| 21 | light | zero |
| 22 | heavy | zero |

### Wet Soil (1 rule)

| # | → Output |
|---|---|
| 23 | zero |

Only `soilMoisture=wet` is specified. Unconditional — wet soil always produces zero watering regardless of other inputs.

### Rule Design Notes

- Rules with fewer conditions act as **catch-all** patterns. When a rule omits a variable (e.g., rule 13 omits temperature and humidity), the engine only checks the specified conditions. Unspecified variables do not constrain the rule's fire strength.
- The rule base is designed so that **soil moisture is the primary driver**: wet → always zero, dry → longest durations, moist → moderate. Temperature and humidity modulate within these bands. Rain acts as a suppressant.

---

## 6. Inference Process

### 6.1 Fuzzification (`fuzzifyInputs` in engine.ts)

Each crisp input value is evaluated against all membership functions of its linguistic variable, producing a degree ∈ [0, 1] for each fuzzy set.

Example: `soilMoisture = 350`
```
μ_dry(350)   = (400 - 350) / (400 - 200) = 0.25
μ_moist(350) = (350 - 300) / (500 - 300) = 0.25
μ_wet(350)   = 0
```

### 6.2 Rule Evaluation (`evaluateRules` in engine.ts)

For each rule, the fire strength is computed as the **minimum** of all condition membership degrees (AND operator):

```
strength = min(μ_condition_1, μ_condition_2, ..., μ_condition_n)
```

Only conditions explicitly listed in the rule's `conditions` object are checked. Missing variables default to not constraining the rule.

### 6.3 Aggregation (inside `defuzzify` in engine.ts)

For each point `y` in the output domain [0, 300], the aggregated membership is:

```
μ_agg(y) = MAX over all rules i: min(strength_i, μ_output_i(y))
```

This is the standard Mamdani **clipping + MAX aggregation**.

### 6.4 Defuzzification — Centroid (`defuzzify` in engine.ts)

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
  "soilMoisture": 200,
  "airTemperature": 35,
  "airHumidity": 30
}
```

Rain precipitation is **not** sent by the client. The server fetches it automatically from BMKG via `getRainProbabilityNext3Hours`, summing the `tp` (total precipitation) field across all forecast entries within the next 3 hours.

**Response:**
```json
{
  "inputs": { "soilMoisture": 200, "airTemperature": 35, "airHumidity": 30, "rainPrecipitation": 0.1 },
  "memberships": { "soilMoisture": { "dry": 1, "moist": 0, "wet": 0 }, ... },
  "activeRules": [{ "conditions": {...}, "output": "very_long", "strength": 0.667 }],
  "wateringDuration": 279
}
```

### BMKG Location

The BMKG location ID is hardcoded as `LOCATION_ID = "35.78.13.1003"` in `src/server.ts`. The BMKG service functions (`src/services/bmkg.ts`) accept `locationId` as a parameter and are location-agnostic.

---

## 8. Worked Example

**Inputs**: soilMoisture=100, airTemperature=36°C, airHumidity=20%, rainPrecipitation=0.1mm

### Step 1: Fuzzification

| Variable | Value | dry/cool/low/none | moist/warm/medium/light | wet/hot/high/heavy |
|---|---|---|---|---|
| soilMoisture | 100 | 1.00 | 0 | 0 |
| airTemperature | 36 | — | 0 (warm) | 0.667 (hot) |
| airHumidity | 20 | 1.00 | 0 | 0 |
| rainPrecipitation | 0.1 | 1.00 | 0 | 0 |

### Step 2: Rule Evaluation

Rule 1 fires: `{dry, hot, low, none} → very_long`
```
strength = min(1.00, 0.667, 1.00, 1.00) = 0.667
```

All other rules have strength = 0 (at least one condition evaluates to 0).

### Step 3: Defuzzification

The `very_long` output set (trapezoidal 250,280,300,300) is clipped at 0.667. Centroid computation over 200 points yields **279 seconds** (~4 min 39 sec).
