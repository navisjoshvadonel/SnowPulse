import { describe, test, expect, vi, afterEach } from 'vitest';
import { runMonteCarloSimulation } from '../utils/monteCarloSimulation';

describe('runMonteCarloSimulation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('runs with default parameters and returns complete MonteCarloResult structure', () => {
    const result = runMonteCarloSimulation({});

    expect(result.targetMetric).toBe('Revenue');
    expect(result.baseValue).toBe(100);
    expect(result.steps).toBe(12);
    expect(result.iterations).toBe(1000);
    expect(result.stepLabels).toHaveLength(13);
    expect(result.stepLabels[0]).toBe('Base');
    expect(result.stepLabels[1]).toBe('M1');
    expect(result.stepLabels[12]).toBe('M12');

    // Percentiles structure
    expect(result.percentiles.p10).toHaveLength(13);
    expect(result.percentiles.p25).toHaveLength(13);
    expect(result.percentiles.p50).toHaveLength(13);
    expect(result.percentiles.p75).toHaveLength(13);
    expect(result.percentiles.p90).toHaveLength(13);

    // Risk metrics structure
    expect(result.riskMetrics).toEqual(
      expect.objectContaining({
        finalP10: expect.any(Number),
        finalP50: expect.any(Number),
        finalP90: expect.any(Number),
        var95: expect.any(Number),
        cvar95: expect.any(Number),
        probOfLoss: expect.any(Number),
        probOfTarget: expect.any(Number),
        targetThreshold: 115, // Default targetThreshold = baseValue * 1.15
      })
    );

    // Distribution bins
    expect(result.distributionBins).toHaveLength(12);
    result.distributionBins.forEach((bin) => {
      expect(bin).toEqual(
        expect.objectContaining({
          binMin: expect.any(Number),
          binMax: expect.any(Number),
          label: expect.any(String),
          count: expect.any(Number),
          percentage: expect.any(Number),
          tier: expect.stringMatching(/Worst Case \(P10\)|Expected|Optimistic \(P90\)/),
        })
      );
    });

    const totalBinCount = result.distributionBins.reduce((sum, b) => sum + b.count, 0);
    expect(totalBinCount).toBe(1000);

    // AI narrative & execution time
    expect(result.aiRiskNarrative).toContain('Revenue');
    expect(result.aiRiskNarrative).toContain('favorable');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  test('clamps parameter boundaries correctly', () => {
    // Test baseValue lower bound (< 1), steps lower bound (< 3), iterations lower bound (< 100), volatility lower bound (< 0.01)
    const resultLow = runMonteCarloSimulation({
      baseValue: -50,
      steps: 1,
      iterations: 10,
      volatility: 0.0001,
    });

    expect(resultLow.baseValue).toBe(1);
    expect(resultLow.steps).toBe(3);
    expect(resultLow.iterations).toBe(100);
    expect(resultLow.stepLabels).toHaveLength(4); // Base + M1..M3

    // Test steps upper bound (> 60), iterations upper bound (> 10000), volatility upper bound (> 1.0)
    const resultHigh = runMonteCarloSimulation({
      baseValue: 200,
      steps: 100,
      iterations: 50000,
      volatility: 5.0,
    });

    expect(resultHigh.steps).toBe(60);
    expect(resultHigh.iterations).toBe(10000);
    expect(resultHigh.stepLabels).toHaveLength(61); // Base + M1..M60
  });

  test('handles custom targetThreshold and adverse parameter shifts', () => {
    const result = runMonteCarloSimulation({
      baseValue: 500,
      steps: 6,
      iterations: 500,
      priceDelta: 0.02,
      costDelta: 0.1,
      churnDelta: 0.05, // netImpact = 0.02 - 0.10 - 0.05 = -0.13 (adverse)
      volatility: 0.2,
      metricName: 'ARR',
      targetThreshold: 600,
    });

    expect(result.targetMetric).toBe('ARR');
    expect(result.riskMetrics.targetThreshold).toBe(600);
    expect(result.aiRiskNarrative).toContain('adverse');
    expect(result.aiRiskNarrative).toContain('ARR');
  });

  test('produces deterministic output when Math.random is mocked', () => {
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result1 = runMonteCarloSimulation({
      baseValue: 100,
      steps: 6,
      iterations: 200,
    });

    mockRandom.mockClear();
    mockRandom.mockReturnValue(0.5);

    const result2 = runMonteCarloSimulation({
      baseValue: 100,
      steps: 6,
      iterations: 200,
    });

    expect(result1.percentiles).toEqual(result2.percentiles);
    expect(result1.riskMetrics).toEqual(result2.riskMetrics);
  });

  test('handles u1 === 0 in Box-Muller transformation without error or infinite loop', () => {
    let callCount = 0;
    // Return 0 on the first call for u1, then return 0.5 subsequently
    vi.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return 0;
      return 0.5;
    });

    const result = runMonteCarloSimulation({
      baseValue: 100,
      steps: 3,
      iterations: 100,
    });

    expect(result).toBeDefined();
    expect(result.iterations).toBe(100);
    expect(callCount).toBeGreaterThan(1);
  });
});
