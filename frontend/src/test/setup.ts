import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// Establish API mocking before all tests
beforeAll(() => server.listen())

// Clean up after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Clean up after the tests are finished
afterAll(() => server.close())

// Mock window.matchMedia for testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock performance.now for performance testing
const originalPerformanceNow = performance.now
beforeAll(() => {
  let mockTime = 0
  performance.now = () => mockTime
  ;(global as any).mockPerformanceTime = (time: number) => {
    mockTime = time
  }
})

afterAll(() => {
  performance.now = originalPerformanceNow
})