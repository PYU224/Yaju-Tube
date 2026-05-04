import { describe, expect, it } from 'vitest'
import { initializeDOMPurify, sanitizeHtml } from './sanitize'

function parseHtml(html: string) {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('sanitize utilities', () => {
  it('preserves explicit link targets while enforcing noopener noreferrer', () => {
    const sanitized = sanitizeHtml('<a href="https://example.com" target="_blank">Example</a>')
    const link = parseHtml(sanitized).querySelector('a')

    expect(link?.getAttribute('href')).toBe('https://example.com')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('removes unsafe tags and attributes from user-provided HTML', () => {
    const sanitized = sanitizeHtml('<img src="x" onerror="alert(1)"><script>alert(2)</script>')
    const document = parseHtml(sanitized)

    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('img')?.hasAttribute('onerror')).toBe(false)
  })

  it('does not register duplicate hooks when initialized repeatedly', () => {
    initializeDOMPurify()
    initializeDOMPurify()

    const sanitized = sanitizeHtml('<a href="/watch" target="_self">Watch</a>')
    const link = parseHtml(sanitized).querySelector('a')

    expect(link?.getAttribute('target')).toBe('_self')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
