import { expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PdfExportModal from '@/components/modals/PdfExportModal'
import React from 'react'

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const icons = ['X', 'FileText', 'Sparkles', 'CheckCircle', 'ShieldCheck', 'Printer']
  const mockExports: any = { __esModule: true }
  icons.forEach((i) => {
    mockExports[i] = (props: any) => <div data-testid={`icon-${i.toLowerCase()}`} {...props} />
  })
  return mockExports
})

test('renders close button with accessible ARIA label and handles onClose', () => {
  const handleClose = vi.fn()
  render(
    <PdfExportModal
      isOpen={true}
      onClose={handleClose}
      datasetName="Test Dataset"
      kpis={{ total_records: 100, quality_score: 95.0, mean_value: 50.0 }}
      datasetSchema={{ columns: [] }}
      aiInsights={{ headline: 'Test Headline', recommendations: [] }}
    />
  )

  const closeBtn = screen.getByRole('button', { name: /Close modal/i })
  expect(closeBtn).toBeInTheDocument()

  fireEvent.click(closeBtn)
  expect(handleClose).toHaveBeenCalledTimes(1)
})
