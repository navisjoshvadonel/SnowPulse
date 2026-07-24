import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InsightsCenter from '@/components/ai-insights/InsightsCenter'
import React from 'react'

vi.mock('@/services/api', () => ({
  apiService: {
    generateReport: vi.fn()
  }
}))

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const React = require('react')
  const icons = ['Send', 'AlertTriangle', 'TrendingUp', 'Sparkles', 'MessageSquare', 'CheckSquare', 'BrainCircuit', 'RefreshCw', 'FileText']
  const mockExports: any = {}
  icons.forEach(i => mockExports[i] = (props: any) => <div data-testid={`icon-${i.toLowerCase()}`} {...props} />)
  return mockExports
})

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const defaultProps = {
  datasetId: 1,
  kpis: { mean_value: 50000, metric_name: 'test_metric' },
  anomalies: [],
  recommendations: ['Test recommendation 1'],
  loading: false
}

test('renders Copilot tab by default and handles initial history', () => {
  const history = [{ query: 'Hello', timestamp: '2023-01-01', response: 'Hi there' }]
  render(<InsightsCenter {...defaultProps} initialHistory={history} />)
  
  // History should be loaded
  expect(screen.getByText('Hello')).toBeInTheDocument()
  expect(screen.getByText('Hi there')).toBeInTheDocument()
})

test('switches tabs correctly', () => {
  render(<InsightsCenter {...defaultProps} />)
  
  // Click Forecast tab
  fireEvent.click(screen.getByText('Forecast'))
  expect(screen.getByText('Forecast Model Engine')).toBeInTheDocument()
  
  // SVG drawing logic test - should use our kpis dynamic metric
  expect(screen.getByText(/potential peak test_metric limit of/i)).toBeInTheDocument()

  // Click Actions tab
  fireEvent.click(screen.getByText('Actions'))
  expect(screen.getByText('Test recommendation 1')).toBeInTheDocument()
  expect(screen.getByText('Generate Executive Report')).toBeInTheDocument()
})
