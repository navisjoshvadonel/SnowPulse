import { expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DirectConnectorsModal from '@/components/ingestion/DirectConnectorsModal'
import React from 'react'

test('renders close button with correct aria-label and handles close click', () => {
  const handleClose = vi.fn()
  render(<DirectConnectorsModal isOpen={true} onClose={handleClose} />)

  const closeButton = screen.getByRole('button', { name: /close modal/i })
  expect(closeButton).toBeInTheDocument()

  fireEvent.click(closeButton)
  expect(handleClose).toHaveBeenCalledTimes(1)
})
