# Project Context

This is a TypeScript/Express web application that uses Mamdani fuzzy logic to determine plant watering duration based on sensor data and weather forecasts.

## Fuzzy Logic Reference

**Read `documentation.md` before making any changes to the fuzzy logic system.** It is the single source of truth for:

- Membership function types and parameters
- All 24 inference rules and their design rationale
- Input/output variable definitions and universes of discourse
- The inference pipeline (fuzzification → rule evaluation → aggregation → centroid defuzzification)
- API request/response contracts for `/api/fuzzify`
- File map showing which files are framework-agnostic vs application-specific

If you modify any file under `src/fuzzy/` or change the `/api/fuzzify` endpoint, update `documentation.md` to stay in sync.

## Key Architecture Decisions

- `src/fuzzy/types.ts`, `membership.ts`, `engine.ts` are **agnostic** — no project dependencies. Do not add imports from services, Express, or application code.
- `src/fuzzy/watering-config.ts` is the only application-specific fuzzy file.
- BMKG service (`src/services/bmkg.ts`) accepts `locationId` as a parameter. The location ID is hardcoded once in `src/server.ts`.
- Frontend uses Alpine.js (CDN) with EJS templates. No build step for frontend.
- UI wording is in **Bahasa Indonesia**. Code, filenames, and variable names are in **English**.
