import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Submit</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled and non-interactive while loading', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Submit
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
