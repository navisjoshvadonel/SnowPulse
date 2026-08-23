import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiOverview from '@/components/executive-overview/KpiOverview'
import React from 'react'

// Mock Lucide icons
vi.mock('lucide-react', () => {
  return {
    ArrowUpRight: (props: any) => React.createElement('div', { 'data-testid': 'icon-arrowupright', ...props }),
    ArrowDownRight: (props: any) => React.createElement('div', { 'data-testid': 'icon-arrowdownright', ...props }),
    CheckCircle: (props: any) => React.createElement('div', { 'data-testid': 'icon-checkcircle', ...props })
  }
})

test('renders dynamic metric titles and currency format correctly', () => {
  const mockKpis = {
    total_value: 1250000,
    mean_value: 450,
    std_dev: 12,
    growth_rate: 15.5,
    total_records: 10000,
    unique_categories: 5,
    unique_regions: 3,
    quality_score: 99.1,
    metric_name: 'revenue'
  }

  render(<KpiOverview kpis={mockKpis} aiHeadline="Test Headline" loading={false} />)

  // Verify dynamic titles
  expect(screen.getByText(/Total Revenue/i)).toBeInTheDocument()
  expect(screen.getByText(/Mean Revenue/i)).toBeInTheDocument()
  
  // Verify values with currency format
  expect(screen.getByText(/\$1\.3M/)).toBeInTheDocument()
  expect(screen.getByText(/\$450/)).toBeInTheDocument()
})

test('renders dynamic metric titles without currency format for non-currency metrics', () => {
  const mockKpis = {
    total_value: 1250000,
    mean_value: 450,
    std_dev: 12,
    growth_rate: 15.5,
    total_records: 10000,
    unique_categories: 5,
    unique_regions: 3,
    quality_score: 99.1,
    metric_name: 'events'
  }

  render(<KpiOverview kpis={mockKpis} aiHeadline="Test Headline" loading={false} />)

  // Verify dynamic titles
  expect(screen.getByText(/Total Events/i)).toBeInTheDocument()
  expect(screen.getByText(/Mean Events/i)).toBeInTheDocument()
  
  // Verify values without currency symbol
  expect(screen.getByText(/1\.3M/)).toBeInTheDocument()
  expect(screen.getByText(/450/)).toBeInTheDocument()
})

test('renders loading state correctly', () => {
  render(<KpiOverview kpis={null} aiHeadline={null} loading={true} />)
  
  // The loading state should render skeletons
  const skeletons = document.querySelectorAll('.shimmer')
  expect(skeletons.length).toBeGreaterThan(0)
})
