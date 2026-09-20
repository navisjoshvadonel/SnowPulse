import { describe, expect, test, vi } from 'vitest'
import { formatMetricValue } from '../utils/formatters'

describe('formatMetricValue', () => {
  describe('Null, Undefined, and NaN inputs', () => {
    test('returns "N/A" for null, undefined, or NaN', () => {
      expect(formatMetricValue(null)).toBe('N/A')
      expect(formatMetricValue(undefined)).toBe('N/A')
      expect(formatMetricValue(NaN)).toBe('N/A')
    })
  })

  describe('Currency formatting', () => {
    test('formats metric as currency when metricName suggests financial currency', () => {
      expect(formatMetricValue(1234.56, 'revenue')).toBe('$1,234.56')
      expect(formatMetricValue(100, 'price')).toBe('$100.00')
      expect(formatMetricValue(4500, 'mrr')).toBe('$4,500.00')
    })

    test('formats metric as currency when semanticType suggests financial currency', () => {
      expect(formatMetricValue(50, 'total', 'monetary')).toBe('$50.00')
      expect(formatMetricValue(99.99, 'item', 'price')).toBe('$99.99')
    })

    test('does not format as currency if metric name contains non-currency terms', () => {
      expect(formatMetricValue(85, 'satisfaction_score')).toBe('85')
      expect(formatMetricValue(25, 'customer_age')).toBe('25')
      expect(formatMetricValue(100, 'item_count')).toBe('100')
      expect(formatMetricValue(98.6, 'body_temp')).toBe('98.6')
    })

    test('does not format as currency if semanticType is percentage or count', () => {
      expect(formatMetricValue(0.15, 'revenue', 'percentage')).toBe('15.0%')
      expect(formatMetricValue(10, 'revenue', 'count')).toBe('10')
    })

    test('supports compact currency notation', () => {
      expect(
        formatMetricValue(1500000, 'revenue', null, { notation: 'compact' })
      ).toBe('$1.5M')
    })

    test('respects custom maximumFractionDigits for currency', () => {
      expect(
        formatMetricValue(123.456, 'revenue', null, {
          maximumFractionDigits: 0,
        })
      ).toBe('$123')
    })

    test('falls back to basic string formatting if Intl.NumberFormat throws', () => {
      const originalNumberFormat = Intl.NumberFormat
      const spy = vi
        .spyOn(Intl, 'NumberFormat')
        .mockImplementation(function (this: unknown) {
          throw new Error('Intl error')
        } as unknown as typeof Intl.NumberFormat)

      expect(formatMetricValue(1234.56, 'revenue')).toBe('$1234.56')

      spy.mockRestore()
      Intl.NumberFormat = originalNumberFormat
    })
  })

  describe('Percentage formatting', () => {
    test('formats metric as percentage based on name or semanticType', () => {
      expect(formatMetricValue(0.155, 'growth_rate')).toBe('15.5%')
      expect(formatMetricValue(15.5, 'churn_rate')).toBe('15.5%')
      expect(formatMetricValue(0.05, 'value', 'percentage')).toBe('5.0%')
      expect(formatMetricValue(150, 'growth_pct')).toBe('15000.0%')
    })
  })

  describe('Compact notation for general metrics', () => {
    test('formats millions with M suffix', () => {
      expect(
        formatMetricValue(2500000, 'views', null, { notation: 'compact' })
      ).toBe('2.5M')
      expect(
        formatMetricValue(-3500000, 'views', null, { notation: 'compact' })
      ).toBe('-3.5M')
    })

    test('formats thousands with k suffix', () => {
      expect(
        formatMetricValue(1200, 'views', null, { notation: 'compact' })
      ).toBe('1.2k')
      expect(
        formatMetricValue(-4500, 'views', null, { notation: 'compact' })
      ).toBe('-4.5k')
    })

    test('formats numbers < 1000 correctly in compact mode', () => {
      expect(
        formatMetricValue(500, 'views', null, { notation: 'compact' })
      ).toBe('500')
      expect(
        formatMetricValue(12.345, 'views', null, { notation: 'compact' })
      ).toBe('12.3')
    })
  })

  describe('Standard number formatting', () => {
    test('formats integers with thousands separators', () => {
      expect(formatMetricValue(10000, 'units')).toBe('10,000')
    })

    test('formats non-integers with default and custom fraction digits', () => {
      expect(formatMetricValue(1234.56, 'units')).toBe('1,234.6')
      expect(
        formatMetricValue(1234.5678, 'units', null, {
          maximumFractionDigits: 3,
        })
      ).toBe('1,234.568')
    })
  })
})
