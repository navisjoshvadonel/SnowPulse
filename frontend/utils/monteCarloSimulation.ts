export interface MonteCarloParams {
  baseValue: number;
  steps: number;
  iterations: number;
  priceDelta: number;
  costDelta: number;
  churnDelta: number;
  volatility: number;
  metricName?: string;
  targetThreshold?: number;
}

export interface MonteCarloResult {
  targetMetric: string;
  baseValue: number;
  iterations: number;
  steps: number;
  stepLabels: string[];
  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  riskMetrics: {
    finalP10: number;
    finalP50: number;
    finalP90: number;
    var95: number;
    cvar95: number;
    probOfLoss: number;
    probOfTarget: number;
    targetThreshold: number;
  };
  distributionBins: {
    binMin: number;
    binMax: number;
    label: string;
    count: number;
    percentage: number;
    tier: "Worst Case (P10)" | "Expected" | "Optimistic (P90)";
  }[];
  aiRiskNarrative: string;
  executionTimeMs: number;
}

/**
 * High-performance client-side Monte Carlo simulation calculation engine.
 * Computes 1,000 to 10,000 Geometric Brownian Motion stochastic runs off main thread or synchronously.
 */
export function runMonteCarloSimulation(params: MonteCarloParams): MonteCarloResult {
  const startTime = performance.now();
  const {
    baseValue = 100,
    steps = 12,
    iterations = 1000,
    priceDelta = 0,
    costDelta = 0,
    churnDelta = 0,
    volatility = 0.15,
    metricName = "Revenue",
    targetThreshold
  } = params;

  const validBase = Math.max(1, baseValue);
  const numSteps = Math.max(3, Math.min(60, steps));
  const numIterations = Math.max(100, Math.min(10000, iterations));
  const dt = 1.0 / 12.0; // monthly interval

  const netImpact = priceDelta - costDelta - churnDelta;
  const muBase = 0.05; // 5% baseline annual growth
  const muEff = muBase + netImpact;
  const vol = Math.max(0.01, Math.min(1.0, volatility));

  const drift = (muEff - 0.5 * vol * vol) * dt;
  const diffusionMult = vol * Math.sqrt(dt);

  // Initialize paths matrix: [iterations, steps + 1]
  const paths: number[][] = Array.from({ length: numIterations }, () => {
    const arr = new Float64Array(numSteps + 1);
    arr[0] = validBase;
    return Array.from(arr);
  });

  // Box-Muller polar method for random normal variables
  for (let i = 0; i < numIterations; i++) {
    for (let t = 1; t <= numSteps; t++) {
      let u1 = Math.random();
      let u2 = Math.random();
      while (u1 === 0) u1 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      const shock = drift + diffusionMult * z0;
      paths[i][t] = paths[i][t - 1] * Math.exp(shock);
    }
  }

  // Calculate Percentiles for each time step
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];
  const stepLabels: string[] = ["Base"];

  for (let t = 0; t <= numSteps; t++) {
    if (t > 0) stepLabels.push(`M${t}`);
    const colValues = new Float64Array(numIterations);
    for (let i = 0; i < numIterations; i++) {
      colValues[i] = paths[i][t];
    }
    colValues.sort();

    p10.push(Number(colValues[Math.floor(numIterations * 0.10)].toFixed(2)));
    p25.push(Number(colValues[Math.floor(numIterations * 0.25)].toFixed(2)));
    p50.push(Number(colValues[Math.floor(numIterations * 0.50)].toFixed(2)));
    p75.push(Number(colValues[Math.floor(numIterations * 0.75)].toFixed(2)));
    p90.push(Number(colValues[Math.floor(numIterations * 0.90)].toFixed(2)));
  }

  // Risk & Tail Analysis on final step outcomes
  const finalVals = new Float64Array(numIterations);
  for (let i = 0; i < numIterations; i++) {
    finalVals[i] = paths[i][numSteps];
  }
  finalVals.sort();

  const finalP10 = p10[p10.length - 1];
  const finalP50 = p50[p50.length - 1];
  const finalP90 = p90[p90.length - 1];

  const p5Val = finalVals[Math.floor(numIterations * 0.05)];
  const var95 = Math.max(0, validBase - p5Val);

  let worst5Sum = 0;
  let worst5Count = 0;
  let lossCount = 0;
  const threshold = targetThreshold ?? validBase * 1.15;
  let targetCount = 0;

  for (let i = 0; i < numIterations; i++) {
    const val = finalVals[i];
    if (val <= p5Val) {
      worst5Sum += val;
      worst5Count++;
    }
    if (val < validBase) {
      lossCount++;
    }
    if (val >= threshold) {
      targetCount++;
    }
  }

  const worst5Avg = worst5Count > 0 ? worst5Sum / worst5Count : p5Val;
  const cvar95 = Math.max(var95, validBase - worst5Avg);

  const probOfLoss = Number(((lossCount / numIterations) * 100).toFixed(1));
  const probOfTarget = Number(((targetCount / numIterations) * 100).toFixed(1));

  // Outcome Frequency Distribution (12 Bins)
  const minVal = finalVals[0];
  const maxVal = finalVals[numIterations - 1];
  const binWidth = (maxVal - minVal) / 12 || 1;

  const binsCount = new Int32Array(12);
  for (let i = 0; i < numIterations; i++) {
    const idx = Math.min(11, Math.floor((finalVals[i] - minVal) / binWidth));
    binsCount[idx]++;
  }

  const distributionBins = Array.from(binsCount).map((count, i) => {
    const bMin = minVal + i * binWidth;
    const bMax = minVal + (i + 1) * binWidth;
    const pct = Number(((count / numIterations) * 100).toFixed(1));

    let tier: "Worst Case (P10)" | "Expected" | "Optimistic (P90)" = "Expected";
    if (bMax <= finalP10) tier = "Worst Case (P10)";
    else if (bMin >= finalP90) tier = "Optimistic (P90)";

    return {
      binMin: Number(bMin.toFixed(2)),
      binMax: Number(bMax.toFixed(2)),
      label: `${Math.round(bMin).toLocaleString()} - ${Math.round(bMax).toLocaleString()}`,
      count,
      percentage: pct,
      tier,
    };
  });

  const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
  const impactDir = netImpact >= 0 ? "favorable" : "adverse";

  const aiRiskNarrative =
    `Simulated ${numIterations.toLocaleString()} stochastic Monte Carlo runs over ${numSteps} steps for '${metricName}'. ` +
    `Under net ${impactDir} parameter shifts (Price: ${(priceDelta * 100).toFixed(1)}%, Cost: ${(costDelta * 100).toFixed(1)}%, Churn: ${(churnDelta * 100).toFixed(1)}%, Volatility: ${(vol * 100).toFixed(1)}%), ` +
    `the P50 expected outcome is ${finalP50.toLocaleString()} (${(((finalP50 / validBase) - 1) * 100).toFixed(1)}% vs base ${validBase.toLocaleString()}). ` +
    `Tail-risk analysis indicates a ${probOfLoss}% probability of downside loss below baseline, with a 95% Value-at-Risk (VaR) of ${Number(var95.toFixed(2)).toLocaleString()}. ` +
    `Computation completed in ${executionTimeMs}ms via Web Worker.`;

  return {
    targetMetric: metricName,
    baseValue: Number(validBase.toFixed(2)),
    iterations: numIterations,
    steps: numSteps,
    stepLabels,
    percentiles: { p10, p25, p50, p75, p90 },
    riskMetrics: {
      finalP10: Number(finalP10.toFixed(2)),
      finalP50: Number(finalP50.toFixed(2)),
      finalP90: Number(finalP90.toFixed(2)),
      var95: Number(var95.toFixed(2)),
      cvar95: Number(cvar95.toFixed(2)),
      probOfLoss,
      probOfTarget,
      targetThreshold: Number(threshold.toFixed(2)),
    },
    distributionBins,
    aiRiskNarrative,
    executionTimeMs,
  };
}
