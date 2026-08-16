import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TrendVisuals from '@/components/performance-trends/TrendVisuals'
import React from 'react'
import * as echarts from 'echarts'

// Mock echarts to prevent real canvas rendering in JSDOM
vi.mock('echarts', () => {
  const setOptionMock = vi.fn()
  const resizeMock = vi.fn()
  const disposeMock = vi.fn()
  return {
    init: vi.fn(() => ({
      setOption: setOptionMock,
      resize: resizeMock,
      dispose: disposeMock,
    })),
    graphic: {
      LinearGradient: vi.fn()
    }
  }
})

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const React = require('react')
  return {
    TrendingUp: (props: any) => <div data-testid="icon-trendingup" {...props} />,
    Clock: (props: any) => <div data-testid="icon-clock" {...props} />,
    BarChart3: (props: any) => <div data-testid="icon-barchart3" {...props} />,
    LineChart: (props: any) => <div data-testid="icon-linechart" {...props} />
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('renders dynamic series labels based on metric', () => {
  const mockTrends = {
    dates: ['2023-01-01', '2023-01-02', '2023-01-03'],
    values: [100, 150, 200],
    moving_average: [100, 125, 150],
    metric: 'sales'
  }

  render(<TrendVisuals trends={mockTrends} aiTrendNote="Trending upwards" loading={false} />)

  // Verify dynamic title
  expect(screen.getByText('Sales Performance Trends')).toBeInTheDocument()

  // ECharts init should be called
  expect(echarts.init).toHaveBeenCalled()
  
  // Extract the ECharts instance mock
  const chartInstance = (echarts.init as any).mock.results[0].value
  expect(chartInstance.setOption).toHaveBeenCalled()
  
  // Verify that the setOption was called with options containing our dynamic labels
  const optionArgs = chartInstance.setOption.mock.calls[0][0]
  expect(optionArgs.series[0].name).toContain('Projected Sales')
  expect(optionArgs.series[1].name).toContain('Actual Sales')
})

test('time filters slice the data correctly', () => {
  // Create 100 days of data
  const dates = Array.from({length: 100}, (_, i) => `2023-01-${(i+1).toString().padStart(2, '0')}`)
  const values = Array(100).fill(100)
  const moving_average = Array(100).fill(100)

  const mockTrends = {
    dates,
    values,
    moving_average,
    metric: 'revenue'
  }

  render(<TrendVisuals trends={mockTrends} aiTrendNote="Trending upwards" loading={false} />)

  // Switch to 30 Days
  const btn30 = screen.getByText('30D')
  fireEvent.click(btn30)

  const chartInstance = (echarts.init as any).mock.results[0].value
  
  // The last call to setOption should have exactly 30 data points in the X axis
  const lastOptionCall = chartInstance.setOption.mock.calls[chartInstance.setOption.mock.calls.length - 1][0]
  expect(lastOptionCall.xAxis.data.length).toBe(30)
})

test('renders loading state correctly', () => {
  render(<TrendVisuals trends={null} aiTrendNote={null} loading={true} />)
  const skeletons = document.querySelectorAll('.animate-spin')
  expect(skeletons.length).toBeGreaterThan(0)
})
