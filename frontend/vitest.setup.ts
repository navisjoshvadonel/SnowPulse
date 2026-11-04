import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock framer-motion to render plain elements in JSDOM and strip animation props
vi.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dummy = ({ children, ...props }: any) => {
    const {
      initial,
      animate,
      exit,
      transition,
      variants,
      layout,
      layoutId,
      ...cleanProps
    } = props;
    return React.createElement('div', cleanProps, children);
  };
  return {
    motion: new Proxy({}, {
      get: () => dummy,
    }),
    AnimatePresence: ({ children }: any) => children,
  };
})

// Mock ECharts for JSDOM environment
vi.mock('echarts', () => ({
  init: () => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
  graphic: {
    LinearGradient: vi.fn(),
  },
}))

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
})
