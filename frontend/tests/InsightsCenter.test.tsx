import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightsCenter from '@/components/ai-insights/InsightsCenter'
import React from 'react'

vi.mock('@/services/api', () => ({
  apiService: {
    generateReport: vi.fn()
  }
}))

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const icons = ['Send', 'AlertTriangle', 'TrendingUp', 'Sparkles', 'MessageSquare', 'CheckSquare', 'BrainCircuit', 'RefreshCw', 'FileText']
  const mockExports: any = {}
  icons.forEach(i => mockExports[i] = (props: any) => React.createElement('div', { 'data-testid': `icon-${i.toLowerCase()}`, ...props }))
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

test('handles quick prompt actions and renders streamlined interface', () => {
  render(<InsightsCenter {...defaultProps} />)
  
  // Verify header title
  expect(screen.getByText('AI Copilot & Intelligence Engine')).toBeInTheDocument()
  
  // Quick prompt pill present
  const topSectorsBtn = screen.getByRole('button', { name: /Top Sectors/i })
  expect(topSectorsBtn).toBeInTheDocument()
})
