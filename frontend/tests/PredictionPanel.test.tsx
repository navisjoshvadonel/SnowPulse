import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PredictionPanel from '@/components/dashboard/PredictionPanel'
import React from 'react'
import { apiService } from '@/services/api'

vi.mock('@/services/api', () => ({
  apiService: {
    trainMlModel: vi.fn()
  }
}))

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  graphic: { LinearGradient: vi.fn() }
}))

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const React = require('react')
  return {
    Brain: (props: any) => <div data-testid="icon-brain" {...props} />,
    Cpu: (props: any) => <div data-testid="icon-cpu" {...props} />,
    Play: (props: any) => <div data-testid="icon-play" {...props} />,
    Sparkles: (props: any) => <div data-testid="icon-sparkles" {...props} />,
    Target: (props: any) => <div data-testid="icon-target" {...props} />,
    Trophy: (props: any) => <div data-testid="icon-trophy" {...props} />,
    Zap: (props: any) => <div data-testid="icon-zap" {...props} />
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('renders fallback state when no forecast is trained', () => {
  render(<PredictionPanel datasetId={1} forecast={null} trainingHistory={[]} loading={false} />)
  expect(screen.getByText(/No forecast model trained for this dataset yet/i)).toBeInTheDocument()
})

test('triggers AutoML training state and shows scanning animation', async () => {
  apiService.trainMlModel = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      champion_model: 'XGBoost',
      task_type: 'regression',
      features_used: 12,
      target_col: 'revenue',
      feature_importances: []
    })
  })

  render(<PredictionPanel datasetId={1} forecast={null} trainingHistory={[]} loading={false} />)
  
  const btn = screen.getByRole('button', { name: /Run AutoML/i })
  fireEvent.click(btn)

  // Immediately shows training animation text
  expect(screen.getByText(/Synthesizing Neural Weights/i)).toBeInTheDocument()
  
  // Wait for the mock 2.5s delay inside handleRunAutoML to resolve
  await waitFor(() => {
    expect(screen.queryByText(/Synthesizing Neural Weights/i)).not.toBeInTheDocument()
  }, { timeout: 3500 })

  // Results should be displayed
  expect(screen.getByText('XGBoost')).toBeInTheDocument()
})
