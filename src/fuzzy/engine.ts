import type { FuzzyConfig, FuzzyRule, FuzzifyResult } from "./types";

function fuzzifyInputs(
  config: FuzzyConfig,
  inputs: Record<string, number>
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  for (const variable of config.inputs) {
    const value = inputs[variable.name];
    result[variable.name] = {};
    for (const [setName, fn] of Object.entries(variable.sets)) {
      result[variable.name][setName] = fn(value);
    }
  }

  return result;
}

function evaluateRules(
  rules: FuzzyRule[],
  memberships: Record<string, Record<string, number>>
): Array<{ rule: FuzzyRule; strength: number }> {
  return rules.map((rule) => {
    // AND operator: minimum of all condition memberships
    let strength = 1;
    for (const [varName, setName] of Object.entries(rule.conditions)) {
      const degree = memberships[varName]?.[setName] ?? 0;
      strength = Math.min(strength, degree);
    }
    return { rule, strength };
  });
}

function defuzzify(
  config: FuzzyConfig,
  ruleResults: Array<{ rule: FuzzyRule; strength: number }>,
  resolution: number = 200
): number {
  const [min, max] = config.outputRange;
  const step = (max - min) / resolution;

  // Aggregate: for each output point, take the max of all clipped output memberships
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i <= resolution; i++) {
    const x = min + i * step;
    let aggregated = 0;

    for (const { rule, strength } of ruleResults) {
      if (strength === 0) continue;
      const outputFn = config.output.sets[rule.output];
      if (!outputFn) continue;
      // Clipped membership (Mamdani): min of rule strength and output membership
      const clipped = Math.min(strength, outputFn(x));
      aggregated = Math.max(aggregated, clipped);
    }

    // Centroid calculation
    numerator += x * aggregated;
    denominator += aggregated;
  }

  if (denominator === 0) return min;
  return numerator / denominator;
}

function computeOutputMemberships(
  config: FuzzyConfig,
  ruleResults: Array<{ rule: FuzzyRule; strength: number }>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const setName of Object.keys(config.output.sets)) {
    result[setName] = 0;
  }
  for (const { rule, strength } of ruleResults) {
    if (strength === 0) continue;
    const current = result[rule.output] ?? 0;
    result[rule.output] = Math.max(current, strength);
  }
  return result;
}

export function evaluate(
  config: FuzzyConfig,
  inputs: Record<string, number>
): FuzzifyResult {
  const inputMemberships = fuzzifyInputs(config, inputs);
  const ruleStrengths = evaluateRules(config.rules, inputMemberships);
  const outputMemberships = computeOutputMemberships(config, ruleStrengths);
  const crispOutput = defuzzify(config, ruleStrengths);

  return {
    inputMemberships,
    outputMemberships,
    ruleStrengths,
    crispOutput: Math.round(crispOutput),
  };
}
