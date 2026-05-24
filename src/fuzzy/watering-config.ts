import { triangular, trapezoidal } from "./membership";
import type { FuzzyConfig } from "./types";

// Kelembapan tanah: 0 (kering) sampai 100 (%)
const kelembapanTanah = {
  name: "kelembapanTanah",
  sets: {
    kering: trapezoidal(0, 0, 20, 40),
    lembap: triangular(30, 50, 70),
    basah:  trapezoidal(60, 80, 100, 100),
  },
};

// Suhu udara dalam Celsius
const suhuUdara = {
  name: "suhuUdara",
  sets: {
    dingin: trapezoidal(0, 0, 18, 25),
    hangat: triangular(22, 28, 34),
    panas:  trapezoidal(32, 38, 50, 50),
  },
};

// Kelembapan udara dalam %
const kelembapanUdara = {
  name: "kelembapanUdara",
  sets: {
    rendah: trapezoidal(0, 0, 25, 45),
    sedang: triangular(35, 55, 75),
    tinggi: trapezoidal(65, 80, 100, 100),
  },
};

// Curah hujan (mm) dari BMKG — total 3 jam ke depan
const curahHujan = {
  name: "curahHujan",
  sets: {
    tidak_ada: trapezoidal(0, 0, 0.1, 0.5),
    ringan:    triangular(0.3, 1.5, 4),
    lebat:     trapezoidal(3, 6, 50, 50),
  },
};

// Output: durasi siram dalam detik (0–300 = 0–5 menit)
const durasiSiram = {
  name: "durasiSiram",
  sets: {
    nol:           trapezoidal(0, 0, 0, 20),
    pendek:        triangular(10, 60, 110),
    sedang:        triangular(80, 150, 220),
    panjang:       triangular(180, 240, 280),
    sangat_panjang: trapezoidal(250, 280, 300, 300),
  },
};

export const wateringConfig: FuzzyConfig = {
  inputs: [kelembapanTanah, suhuUdara, kelembapanUdara, curahHujan],
  output: durasiSiram,
  outputRange: [0, 300],
  rules: [
    // --- Tanah kering, tanpa hujan (9 aturan) ---
    { conditions: { kelembapanTanah: "kering", suhuUdara: "panas",  kelembapanUdara: "rendah", curahHujan: "tidak_ada" }, output: "sangat_panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "panas",  kelembapanUdara: "sedang", curahHujan: "tidak_ada" }, output: "sangat_panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "panas",  kelembapanUdara: "tinggi", curahHujan: "tidak_ada" }, output: "panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "hangat", kelembapanUdara: "rendah", curahHujan: "tidak_ada" }, output: "sangat_panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "hangat", kelembapanUdara: "sedang", curahHujan: "tidak_ada" }, output: "panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "hangat", kelembapanUdara: "tinggi", curahHujan: "tidak_ada" }, output: "sedang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "dingin", kelembapanUdara: "rendah", curahHujan: "tidak_ada" }, output: "panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "dingin", kelembapanUdara: "sedang", curahHujan: "tidak_ada" }, output: "sedang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "dingin", kelembapanUdara: "tinggi", curahHujan: "tidak_ada" }, output: "pendek" },

    // --- Tanah kering, hujan ringan (3 aturan) ---
    { conditions: { kelembapanTanah: "kering", suhuUdara: "panas",  curahHujan: "ringan" }, output: "panjang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "hangat", curahHujan: "ringan" }, output: "sedang" },
    { conditions: { kelembapanTanah: "kering", suhuUdara: "dingin", curahHujan: "ringan" }, output: "pendek" },

    // --- Tanah kering, hujan lebat (1 aturan) ---
    { conditions: { kelembapanTanah: "kering", curahHujan: "lebat" }, output: "pendek" },

    // --- Tanah lembap, tanpa hujan (7 aturan) ---
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "panas",  kelembapanUdara: "rendah", curahHujan: "tidak_ada" }, output: "panjang" },
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "panas",  kelembapanUdara: "sedang", curahHujan: "tidak_ada" }, output: "sedang" },
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "panas",  kelembapanUdara: "tinggi", curahHujan: "tidak_ada" }, output: "pendek" },
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "hangat", kelembapanUdara: "rendah", curahHujan: "tidak_ada" }, output: "sedang" },
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "hangat", kelembapanUdara: "sedang", curahHujan: "tidak_ada" }, output: "pendek" },
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "hangat", kelembapanUdara: "tinggi", curahHujan: "tidak_ada" }, output: "nol" },
    { conditions: { kelembapanTanah: "lembap", suhuUdara: "dingin", curahHujan: "tidak_ada" }, output: "nol" },

    // --- Tanah lembap, ada hujan (2 aturan) ---
    { conditions: { kelembapanTanah: "lembap", curahHujan: "ringan" }, output: "nol" },
    { conditions: { kelembapanTanah: "lembap", curahHujan: "lebat"  }, output: "nol" },

    // --- Tanah basah (1 aturan) ---
    { conditions: { kelembapanTanah: "basah" }, output: "nol" },
  ],
};
