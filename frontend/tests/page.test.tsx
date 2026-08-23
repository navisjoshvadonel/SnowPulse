import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HomePage from '@/app/page'
import React from 'react'
import { apiService } from '@/services/api'

// Mock Lucide icons using importOriginal so all icon exports are automatically captured
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const React = await import('react');
  const mockExports: Record<string, any> = {};
  Object.keys(actual).forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExports[key] = (props: any) => React.createElement('div', { 'data-testid': `icon-${key.toLowerCase()}`, ...props });
  });
  return mockExports;
})

// Mock framer-motion to render plain elements in JSDOM and strip animation props
vi.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dummy = ({ children, ...props }: any) => {
    const {
      initial,
      animate,
      exit,
      transition,
      variants,
      layout,
      layoutId,
      ...cleanProps
    } = props;
    return React.createElement('div', cleanProps, children);
  };
  return {
    motion: new Proxy({}, {
      get: () => dummy,
    }),
    AnimatePresence: ({ children }: any) => children,
  };
})

// Mock API service
vi.mock('@/services/api', () => ({
  apiService: {
    getMe: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getDatasets: vi.fn(),
    getAnalyticsSummary: vi.fn(),
    getAnalyticsInsights: vi.fn(),
    uploadDataset: vi.fn(),
    createDashboard: vi.fn(),
    askCopilot: vi.fn(),
    getDatasetSchema: vi.fn(),
    getDatasetAggregate: vi.fn(),
    getForecastPredict: vi.fn(),
    getMlHistory: vi.fn(),
    purgeAccount: vi.fn(),
  }
}))

// Mock Google OAuth
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: any) => children,
  useGoogleLogin: () => vi.fn(),
}))

// Mock canvas elements / echarts for JSDOM
vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="echarts-mock">ECharts Visualization</div>
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

test('renders login form by default and switches to register mode', async () => {
  apiService.getMe = vi.fn().mockResolvedValue({ ok: false })
  
  render(<HomePage />)
  
  // Title of the app
  expect(screen.getByText('SnowPulse AI')).toBeInTheDocument()
  
  // Form fields
  expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  
  // Submit button
  const submitBtn = screen.getByRole('button', { name: /Sign In to Workspace/i })
  expect(submitBtn).toBeInTheDocument()
  
  // Switch mode link
  const switchLink = screen.getByRole('button', { name: /Don't have an account\? Sign up/i })
  expect(switchLink).toBeInTheDocument()
  
  // Switch to register mode
  fireEvent.click(switchLink)
  
  // Button changes to Create Developer Account
  expect(screen.getByRole('button', { name: /Create Developer Account/i })).toBeInTheDocument()
})

test('transitions from empty state to dashboard panels on dataset selection', async () => {
  // Set localStorage token to simulate active session
  localStorage.setItem('snow_access_token', 'mocked-jwt')
  
  // Set up mock implementations
  apiService.getMe = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ email: 'test@snowpulse.com' })
  })
  
  apiService.getDatasets = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: 42, name: 'Sales_Data.csv', description: 'Monthly sales metrics' }])
  })
  
  apiService.getAnalyticsSummary = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      kpis: { total_value: 10000, total_records: 500, growth_rate: 12.5, metric_name: 'Revenue' },
      trends: { dates: [], values: [], moving_average: [] },
      geo: [],
      anomalies: [],
      correlations: { columns: [], matrix: [] }
    })
  })

  apiService.getAnalyticsInsights = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      headline: 'Positive sales growth observed',
      trends: 'Upward trajectory',
      geo: 'North region leading',
      recommendations: []
    })
  })

  apiService.getDatasetSchema = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      dataset_id: 42,
      name: 'Sales_Data',
      row_count: 500,
      columns: [
        { name: 'Revenue', role: 'numeric', semantic_type: 'currency' },
        { name: 'Date', role: 'date' },
        { name: 'Category', role: 'categorical' }
      ]
    })
  })

  apiService.getForecastPredict = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      forecast: []
    })
  })

  apiService.getMlHistory = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      runs: []
    })
  })

  render(<HomePage />)
  
  // Check that empty state displays available datasets
  await waitFor(() => {
    expect(screen.getAllByText('Sales_Data.csv').length).toBeGreaterThan(0)
  })

  // Click on the dataset button to load the dashboard
  const datasetItems = screen.getAllByText('Sales_Data.csv')
  const datasetBtn = datasetItems[datasetItems.length - 1].closest('button') || datasetItems[datasetItems.length - 1]
  fireEvent.click(datasetBtn)
  
  // Verify dashboard panels render
  await waitFor(() => {
    expect(screen.getByText(/Cross-Filter Slicer Bar/i)).toBeInTheDocument()
  })

  // Wait for sidebar to be mounted
  let dataQualityBtn: HTMLElement;
  await waitFor(() => {
    dataQualityBtn = screen.getByText('Data Quality Report')
    expect(dataQualityBtn).toBeInTheDocument()
  })

  // Navigate to the Data Quality Report panel via sidebar
  fireEvent.click(dataQualityBtn!)

  // Verify that the Data Quality Report panel is rendered
  await waitFor(() => {
    expect(screen.getByText('Data Quality & Readiness Report')).toBeInTheDocument()
  })
})
