import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app";

describe("POST /api/fuzzify", () => {
  it("returns 400 when sensor fields are missing", async () => {
    const res = await request(app).post("/api/fuzzify").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 when only some sensor fields are provided", async () => {
    const res = await request(app)
      .post("/api/fuzzify")
      .send({ kelembapanTanah: 20, suhuUdara: 35 });
    expect(res.status).toBe(400);
  });

  it("returns durasiSiram in range [0, 300]", async () => {
    const res = await request(app).post("/api/fuzzify").send({
      kelembapanTanah: 20,
      suhuUdara: 35,
      kelembapanUdara: 30,
      curahHujan: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.durasiSiram).toBeGreaterThanOrEqual(0);
    expect(res.body.durasiSiram).toBeLessThanOrEqual(300);
  });

  it("returns high durasiSiram for dry/hot/low-humidity/no-rain conditions", async () => {
    // kelembapanTanah=10 (kering), suhuUdara=40 (panas), kelembapanUdara=20 (rendah), curahHujan=0 (tidak_ada)
    // Rules fire toward sangat_panjang (~280-300s)
    const res = await request(app).post("/api/fuzzify").send({
      kelembapanTanah: 10,
      suhuUdara: 40,
      kelembapanUdara: 20,
      curahHujan: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.durasiSiram).toBeGreaterThan(200);
  });

  it("returns near-zero durasiSiram for wet soil conditions", async () => {
    // kelembapanTanah=90 (basah) — rule fires output:nol
    const res = await request(app).post("/api/fuzzify").send({
      kelembapanTanah: 90,
      suhuUdara: 28,
      kelembapanUdara: 70,
      curahHujan: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.durasiSiram).toBeLessThan(30);
  });

  it("response shape includes required fields", async () => {
    const res = await request(app).post("/api/fuzzify").send({
      kelembapanTanah: 50,
      suhuUdara: 28,
      kelembapanUdara: 55,
      curahHujan: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("inputs");
    expect(res.body).toHaveProperty("memberships");
    expect(res.body).toHaveProperty("outputMemberships");
    expect(res.body).toHaveProperty("activeRules");
    expect(res.body).toHaveProperty("durasiSiram");
    expect(Array.isArray(res.body.activeRules)).toBe(true);
  });

  it("uses provided curahHujan value when given", async () => {
    const res = await request(app).post("/api/fuzzify").send({
      kelembapanTanah: 50,
      suhuUdara: 28,
      kelembapanUdara: 55,
      curahHujan: 5,
    });
    expect(res.status).toBe(200);
    expect(res.body.inputs.curahHujan).toBe(5);
  });
});
