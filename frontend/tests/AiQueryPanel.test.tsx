import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiQueryPanel from '@/components/dashboard/AiQueryPanel'
import React from 'react'

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const icons = ['Sparkles', 'Send', 'Bot', 'User', 'Loader2']
  const mockExports: any = { __esModule: true }
  icons.forEach((i) => {
    mockExports[i] = (props: any) => <div data-testid={`icon-${i.toLowerCase()}`} {...props} />
  })
  return mockExports
})

// Mock GenerativeWidget
vi.mock('@/components/dashboard/GenerativeWidget', () => ({
  default: () => <div data-testid="generative-widget" />
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('renders AI query input and submit button with proper accessibility labels', () => {
  render(<AiQueryPanel />)

  const input = screen.getByRole('textbox', { name: /ask snowpulse ai a question/i })
  expect(input).toBeInTheDocument()

  const submitButton = screen.getByRole('button', { name: /submit query/i })
  expect(submitButton).toBeInTheDocument()
})
