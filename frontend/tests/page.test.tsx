import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HomePage from '@/app/page'
import React from 'react'
import { apiService } from '@/services/api'

// Mock Lucide icons statically so Vitest registers the exports
vi.mock('lucide-react', () => {
  const React = require('react');
  const mockExports: Record<string, any> = {};
  const icons = [
    'Calendar', 'RefreshCw', 'Search', 'Bell', 'ChevronDown', 'User', 'Settings', 'LogOut',
    'Activity', 'Database', 'Server', 'ExternalLink', 'Globe', 'Filter', 'ArrowUpRight',
    'ArrowDownRight', 'Minus', 'Brain', 'Target', 'ServerCog', 'Hash', 'Tag', 'MapPin',
    'AlertCircle', 'Sparkles', 'Send', 'Bot', 'Loader2', 'AlertTriangle', 'TrendingUp',
    'MessageSquare', 'CheckSquare', 'BrainCircuit', 'FileText', 'ChevronRight', 'ChevronLeft',
    'Trash2', 'Layers', 'LayoutDashboard', 'Briefcase'
  ];
  icons.forEach(icon => {
    mockExports[icon] = (props: any) => React.createElement('div', { 'data-testid': `icon-${icon.toLowerCase()}`, ...props });
  });
  return mockExports;
})

// Mock framer-motion to render plain elements in JSDOM and strip animation props
vi.mock('framer-motion', () => {
  const React = require('react');
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
  }
}))

// Mock components to simplify rendering
vi.mock('@/components/executive-overview/KpiOverview', () => ({
  default: () => <div data-testid="kpi-overview">KPI Overview Component</div>
}))
vi.mock('@/components/performance-trends/TrendVisuals', () => ({
  default: () => <div data-testid="trend-visuals">Trend Visuals Component</div>
}))
vi.mock('@/components/geo-intelligence/GeographicMap', () => ({
  default: () => <div data-testid="geo-map">Geo Map Component</div>
}))
vi.mock('@/components/ai-insights/InsightsCenter', () => ({
  default: () => <div data-testid="insights-center">Insights Center Component</div>
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

test('renders login form by default and switches to register mode', async () => {
  apiService.getMe = vi.fn().mockResolvedValue({ ok: false })
  
  render(<HomePage />)
  
  // Title of the app
  expect(screen.getByText('SNOW Intelligence')).toBeInTheDocument()
  
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

  render(<HomePage />)
  
  // Check that empty state displays available datasets
  await waitFor(() => {
    expect(screen.getByText('Sales_Data.csv')).toBeInTheDocument()
  })

  // Click on the dataset to load the dashboard
  fireEvent.click(screen.getByText('Sales_Data.csv'))
  
  // Verify loading state changes to dashboard components
  await waitFor(() => {
    expect(screen.getByTestId('kpi-overview')).toBeInTheDocument()
    expect(screen.getByTestId('trend-visuals')).toBeInTheDocument()
    expect(screen.getByTestId('geo-map')).toBeInTheDocument()
  })

  // Wait for sidebar to be mounted (requestAnimationFrame)
  let snowAiBtn: HTMLElement;
  await waitFor(() => {
    snowAiBtn = screen.getByText('Snow AI')
    expect(snowAiBtn).toBeInTheDocument()
  })

  // Navigate to the Snow AI panel via sidebar
  fireEvent.click(snowAiBtn!)

  // Verify that the Insights Center is rendered in the Snow AI view
  await waitFor(() => {
    expect(screen.getByTestId('insights-center')).toBeInTheDocument()
  })
})
