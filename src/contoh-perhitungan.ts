import { trapezoidal, triangular } from "./fuzzy/membership";

const kelembapanTanah = 35;

console.log('contoh perhitungan');

const keringMembershipFn = trapezoidal(0, 0, 20, 40);
const lembapMembershipFn = triangular(30, 50, 70);
const basahMembershipFn = trapezoidal(60, 80, 100, 100);

const kering = keringMembershipFn(kelembapanTanah);
const lembab = lembapMembershipFn(kelembapanTanah);
const basah = basahMembershipFn(kelembapanTanah);

console.log({ kelembapanTanah, kering, lembab, basah });
