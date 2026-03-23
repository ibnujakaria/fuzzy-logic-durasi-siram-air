import { triangular, trapezoidal } from "./membership";
import type { FuzzyConfig } from "./types";

// Soil moisture: 0 (dry) to 1023 (submerged in water)
// Higher analog reading = wetter soil
const soilMoisture = {
  name: "soilMoisture",
  sets: {
    dry:   trapezoidal(0, 0, 200, 400),
    moist: triangular(300, 500, 700),
    wet:   trapezoidal(600, 800, 1023, 1023),
  },
};

// Air temperature in Celsius
const airTemperature = {
  name: "airTemperature",
  sets: {
    cool: trapezoidal(0, 0, 18, 25),
    warm: triangular(22, 28, 34),
    hot:  trapezoidal(32, 38, 50, 50),
  },
};

// Air humidity in %
const airHumidity = {
  name: "airHumidity",
  sets: {
    low:    trapezoidal(0, 0, 25, 45),
    medium: triangular(35, 55, 75),
    high:   trapezoidal(65, 80, 100, 100),
  },
};

// Rain precipitation (mm) from BMKG — total in next 3 hours
const rainPrecipitation = {
  name: "rainPrecipitation",
  sets: {
    none:  trapezoidal(0, 0, 0.1, 0.5),
    light: triangular(0.3, 1.5, 4),
    heavy: trapezoidal(3, 6, 50, 50),
  },
};

// Output: watering duration in seconds (0–300 = 0–5 minutes)
const wateringDuration = {
  name: "wateringDuration",
  sets: {
    zero:      trapezoidal(0, 0, 0, 20),
    short:     triangular(10, 60, 110),
    medium:    triangular(80, 150, 220),
    long:      triangular(180, 240, 280),
    very_long: trapezoidal(250, 280, 300, 300),
  },
};

export const wateringConfig: FuzzyConfig = {
  inputs: [soilMoisture, airTemperature, airHumidity, rainPrecipitation],
  output: wateringDuration,
  outputRange: [0, 300],
  rules: [
    // --- Dry soil ---
    // No rain
    { conditions: { soilMoisture: "dry", airTemperature: "hot",  airHumidity: "low",    rainPrecipitation: "none" }, output: "very_long" },
    { conditions: { soilMoisture: "dry", airTemperature: "hot",  airHumidity: "medium", rainPrecipitation: "none" }, output: "very_long" },
    { conditions: { soilMoisture: "dry", airTemperature: "hot",  airHumidity: "high",   rainPrecipitation: "none" }, output: "long" },
    { conditions: { soilMoisture: "dry", airTemperature: "warm", airHumidity: "low",    rainPrecipitation: "none" }, output: "very_long" },
    { conditions: { soilMoisture: "dry", airTemperature: "warm", airHumidity: "medium", rainPrecipitation: "none" }, output: "long" },
    { conditions: { soilMoisture: "dry", airTemperature: "warm", airHumidity: "high",   rainPrecipitation: "none" }, output: "medium" },
    { conditions: { soilMoisture: "dry", airTemperature: "cool", airHumidity: "low",    rainPrecipitation: "none" }, output: "long" },
    { conditions: { soilMoisture: "dry", airTemperature: "cool", airHumidity: "medium", rainPrecipitation: "none" }, output: "medium" },
    { conditions: { soilMoisture: "dry", airTemperature: "cool", airHumidity: "high",   rainPrecipitation: "none" }, output: "short" },
    // Light rain
    { conditions: { soilMoisture: "dry", airTemperature: "hot",  rainPrecipitation: "light" }, output: "long" },
    { conditions: { soilMoisture: "dry", airTemperature: "warm", rainPrecipitation: "light" }, output: "medium" },
    { conditions: { soilMoisture: "dry", airTemperature: "cool", rainPrecipitation: "light" }, output: "short" },
    // Heavy rain
    { conditions: { soilMoisture: "dry", rainPrecipitation: "heavy" }, output: "short" },

    // --- Moist soil ---
    // No rain
    { conditions: { soilMoisture: "moist", airTemperature: "hot",  airHumidity: "low",    rainPrecipitation: "none" }, output: "long" },
    { conditions: { soilMoisture: "moist", airTemperature: "hot",  airHumidity: "medium", rainPrecipitation: "none" }, output: "medium" },
    { conditions: { soilMoisture: "moist", airTemperature: "hot",  airHumidity: "high",   rainPrecipitation: "none" }, output: "short" },
    { conditions: { soilMoisture: "moist", airTemperature: "warm", airHumidity: "low",    rainPrecipitation: "none" }, output: "medium" },
    { conditions: { soilMoisture: "moist", airTemperature: "warm", airHumidity: "medium", rainPrecipitation: "none" }, output: "short" },
    { conditions: { soilMoisture: "moist", airTemperature: "warm", airHumidity: "high",   rainPrecipitation: "none" }, output: "zero" },
    { conditions: { soilMoisture: "moist", airTemperature: "cool", rainPrecipitation: "none" }, output: "zero" },
    // Any rain
    { conditions: { soilMoisture: "moist", rainPrecipitation: "light" }, output: "zero" },
    { conditions: { soilMoisture: "moist", rainPrecipitation: "heavy" }, output: "zero" },

    // --- Wet soil ---
    { conditions: { soilMoisture: "wet" }, output: "zero" },
  ],
};
