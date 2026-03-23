export type MembershipFn = (x: number) => number;

export interface LinguisticVariable {
  name: string;
  sets: Record<string, MembershipFn>;
}

export interface FuzzyRule {
  conditions: Record<string, string>; // variable name → set name
  output: string;                     // output set name
}

export interface FuzzyConfig {
  inputs: LinguisticVariable[];
  output: LinguisticVariable;
  rules: FuzzyRule[];
  outputRange: [number, number];
}

export interface FuzzifyResult {
  inputMemberships: Record<string, Record<string, number>>;
  ruleStrengths: Array<{ rule: FuzzyRule; strength: number }>;
  crispOutput: number;
}
