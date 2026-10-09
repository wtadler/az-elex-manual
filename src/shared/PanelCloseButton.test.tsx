// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PanelCloseButton } from './PanelCloseButton'

afterEach(cleanup)

describe('PanelCloseButton', () => {
  it('is a labeled button with the shared class that calls onClose', () => {
    const onClose = vi.fn()
    render(<PanelCloseButton onClose={onClose} label="Close statute panel" />)
    const button = screen.getByRole('button', { name: 'Close statute panel' })
    expect(button.className).toBe('panel-close')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.textContent).toBe('✕ Close')
    fireEvent.click(button)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
