import { expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TopNavBar from '@/components/layout/TopNavBar'
import Sidebar from '@/components/layout/Sidebar'
import React from 'react'

// Mock framer-motion to avoid animation timing issues in vitest
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

test('TopNavBar buttons render with proper ARIA attributes', () => {
  render(<TopNavBar />)

  const searchButton = screen.getByRole('button', { name: /search insights, metrics, commands/i })
  expect(searchButton).toBeInTheDocument()

  const bellButton = screen.getByRole('button', { name: /notifications & anomaly alerts/i })
  expect(bellButton).toBeInTheDocument()
  expect(bellButton).toHaveAttribute('aria-expanded', 'false')
  expect(bellButton).toHaveAttribute('aria-haspopup', 'true')

  const userMenuButton = screen.getByRole('button', { name: /user account menu/i })
  expect(userMenuButton).toBeInTheDocument()
  expect(userMenuButton).toHaveAttribute('aria-expanded', 'false')
  expect(userMenuButton).toHaveAttribute('aria-haspopup', 'true')
})

test('Sidebar collapse toggle button renders with proper ARIA attributes', async () => {
  const onToggleCollapsed = vi.fn()
  const { rerender } = render(
    <Sidebar
      active="dashboard"
      onNavigate={() => {}}
      collapsed={false}
      onToggleCollapsed={onToggleCollapsed}
    />
  )

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument()
  })

  rerender(
    <Sidebar
      active="dashboard"
      onNavigate={() => {}}
      collapsed={true}
      onToggleCollapsed={onToggleCollapsed}
    />
  )

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload dataset/i })).toBeInTheDocument()
  })
})
