import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocsChangelogModal from '@/components/modals/DocsChangelogModal'
import React from 'react'

// Mock framer-motion to simplify rendering in test environment
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

test('renders close button with correct aria-label and accessible links', () => {
  render(<DocsChangelogModal isOpen={true} onClose={() => {}} />)

  const closeButton = screen.getByRole('button', { name: /close modal/i })
  expect(closeButton).toBeInTheDocument()

  const apiRefLink = screen.getByRole('link', { name: /api reference/i })
  expect(apiRefLink).toBeInTheDocument()

  const archGuideLink = screen.getByRole('link', { name: /architecture guide/i })
  expect(archGuideLink).toBeInTheDocument()

  const openInTabSpans = screen.getAllByText('(opens in a new tab)')
  expect(openInTabSpans).toHaveLength(2)
})
