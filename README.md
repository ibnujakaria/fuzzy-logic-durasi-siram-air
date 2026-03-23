# Sistem Monitoring Cuaca & Fuzzy Logic

Aplikasi web untuk monitoring cuaca dan analisis penyiraman tanaman menggunakan fuzzy logic. Data cuaca diambil dari API publik BMKG.

## Fitur

- **Prakiraan Cuaca** — Menampilkan cuaca terkini dan prakiraan mendatang berdasarkan data BMKG
- **Fuzzy Logic** — Menentukan durasi penyiraman berdasarkan 4 input:
  - Kelembapan tanah (sensor analog, 0–1023)
  - Suhu udara (°C)
  - Kelembapan udara (%)
  - Curah hujan 3 jam ke depan (otomatis dari BMKG)
- Metode Mamdani dengan defuzzifikasi centroid
- Implementasi fuzzy logic murni tanpa library pihak ketiga

## Teknologi

- TypeScript, Express, EJS, Alpine.js

## Menjalankan

```bash
npm install
npm run dev
```

Server berjalan di `http://localhost:3780`.

## Endpoint API

| Method | Path                  | Keterangan                          |
|--------|-----------------------|-------------------------------------|
| GET    | `/api/weather`        | Data cuaca lengkap dari BMKG        |
| GET    | `/api/location`       | Informasi lokasi dari BMKG          |
| GET    | `/api/rain-probability` | Prakiraan hujan 3 jam ke depan    |
| POST   | `/api/fuzzify`        | Proses fuzzy logic untuk penyiraman |

### Contoh Request POST `/api/fuzzify`

```json
{
  "soilMoisture": 200,
  "airTemperature": 35,
  "airHumidity": 30
}
```

Response berisi durasi penyiraman (detik), derajat keanggotaan tiap input, dan aturan fuzzy yang aktif.

## Deploy ke Netlify

Aplikasi ini siap di-deploy ke [Netlify](https://www.netlify.com/) sebagai serverless function.

### Langkah-langkah

1. Push repository ke GitHub
2. Buka [app.netlify.com](https://app.netlify.com/) dan login
3. Klik **"Add new site"** → **"Import an existing project"**
4. Pilih repository dari GitHub
5. Netlify akan otomatis mendeteksi konfigurasi dari `netlify.toml` — tidak perlu mengubah pengaturan apapun
6. Klik **"Deploy site"**

### Cara Kerja

- Semua request diarahkan ke serverless function di `netlify/functions/api.ts`
- Function ini membungkus Express app menggunakan `serverless-http`
- Template EJS di-bundle bersama function melalui pengaturan `included_files` di `netlify.toml`
- Tidak ada build step tambahan yang diperlukan

### Catatan

- Pastikan tidak ada environment variable yang perlu diatur — aplikasi ini tidak memerlukan konfigurasi tambahan
- Netlify free tier mendukung 125.000 function invocations per bulan
- Jika terjadi cold start lambat, itu normal untuk serverless function

## Lokasi

Lokasi saat ini di-hardcode ke **Gundih, Bubutan, Kota Surabaya** (kode: `35.78.13.1003`). Untuk mengubah lokasi, ganti nilai `LOCATION_ID` di `src/app.ts`.
