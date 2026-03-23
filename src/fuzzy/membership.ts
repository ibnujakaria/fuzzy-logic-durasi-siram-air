import type { MembershipFn } from "./types";

export function triangular(a: number, b: number, c: number): MembershipFn {
  return (x: number) => {
    if (x < a || x > c) return 0;
    if (a === b && x === a) return 1;
    if (b === c && x === c) return 1;
    if (x <= b) return (x - a) / (b - a);
    return (c - x) / (c - b);
  };
}

export function trapezoidal(a: number, b: number, c: number, d: number): MembershipFn {
  return (x: number) => {
    if (x >= b && x <= c) return 1;
    if (x <= a || x >= d) return 0;
    if (x < b) return (x - a) / (b - a);
    return (d - x) / (d - c);
  };
}
