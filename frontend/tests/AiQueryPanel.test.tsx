import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiQueryPanel from '@/components/dashboard/AiQueryPanel'
import React from 'react'

// Mock Lucide icons
vi.mock('lucide-react', () => {
  return {
    Sparkles: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', { 'data-testid': 'icon-sparkles', ...props }),
    Send: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', { 'data-testid': 'icon-send', ...props }),
    Bot: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', { 'data-testid': 'icon-bot', ...props }),
    User: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', { 'data-testid': 'icon-user', ...props }),
    Loader2: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', { 'data-testid': 'icon-loader2', ...props })
  }
})

// Mock GenerativeWidget component
vi.mock('../components/dashboard/GenerativeWidget', () => {
  return {
    default: () => React.createElement('div', { 'data-testid': 'generative-widget' })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('renders AiQueryPanel with accessible ARIA labels for query input and submit button', () => {
  render(<AiQueryPanel />)

  const input = screen.getByLabelText('Ask SnowPulse AI')
  expect(input).toBeInTheDocument()

  const submitBtn = screen.getByRole('button', { name: 'Submit query' })
  expect(submitBtn).toBeInTheDocument()
})
