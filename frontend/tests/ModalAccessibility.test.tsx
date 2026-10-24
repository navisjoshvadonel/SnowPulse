import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import PdfExportModal from '@/components/modals/PdfExportModal'
import { ExecutivePresentationModal } from '@/components/analytics/ExecutivePresentationModal'

// Mock framer-motion to avoid animation timing in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

test('PdfExportModal renders close button with accessible aria-label', () => {
  const handleClose = vi.fn()
  render(
    <PdfExportModal
      isOpen={true}
      onClose={handleClose}
      datasetName="Test Dataset"
      kpis={{}}
      datasetSchema={{}}
      aiInsights={{}}
    />
  )

  const closeButton = screen.getByRole('button', { name: /close modal/i })
  expect(closeButton).toBeInTheDocument()
  expect(closeButton).toHaveAttribute('aria-label', 'Close modal')
})

test('ExecutivePresentationModal renders close button with accessible aria-label', () => {
  const handleClose = vi.fn()
  render(
    <ExecutivePresentationModal
      isOpen={true}
      onClose={handleClose}
    />
  )

  const closeButton = screen.getByRole('button', { name: /close modal/i })
  expect(closeButton).toBeInTheDocument()
  expect(closeButton).toHaveAttribute('aria-label', 'Close modal')
})
