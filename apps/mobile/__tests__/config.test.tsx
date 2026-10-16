// @vitest-environment jsdom
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from './helpers/render'

vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))

// Build configs are loaded with Node's own require, exactly as Expo and Metro do.
const nodeRequire = createRequire(path.resolve(__dirname, '../package.json'))
const appRoot = path.resolve(__dirname, '..')

describe('tailwind.config.js', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../tailwind.config.js'), 'utf8')
  const themedNames = [...source.matchAll(/themed\('([a-z0-9-]+)'\)/g)].map((m) => m[1])

  it('scans the app and components for class names', () => {
    const config = nodeRequire('./tailwind.config.js')
    expect(config.content).toEqual(['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'])
    expect(config.theme.extend.colors.fg).toBe('rgb(var(--color-fg) / <alpha-value>)')
  })

  it('every theme-aware colour has a CSS variable in both light and dark palettes', async () => {
    const { useTheme } = await import('@/lib/theme')
    const { useThemeStore } = await import('@/store/themeStore')
    expect(themedNames.length).toBeGreaterThan(10)
    for (const mode of ['dark', 'light'] as const) {
      useThemeStore.setState({ mode })
      const { result } = await renderHook(() => useTheme())
      const vars = (result.current.themeVars as unknown as { __vars: Record<string, string> }).__vars
      for (const name of themedNames) expect(vars[`--color-${name}`], `${mode} --color-${name}`).toMatch(/^\d+ \d+ \d+$/)
      expect(Object.keys(result.current.colors).sort()).toEqual([...new Set(themedNames)].sort())
    }
  })
})

describe('babel.config.js', () => {
  it('uses the Expo preset with NativeWind JSX and the worklets plugin', () => {
    const cache = vi.fn()
    expect(nodeRequire('./babel.config.js')({ cache })).toEqual({
      presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
      plugins: ['react-native-worklets/plugin'],
    })
    expect(cache).toHaveBeenCalledWith(true)
  })
})

describe('metro.config.js', () => {
  // Expo runs Metro from apps/mobile; NativeWind finds tailwind.config.js from the cwd.
  const cwd = process.cwd()
  process.chdir(appRoot)
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const config = nodeRequire('./metro.config.js')
  log.mockRestore()
  process.chdir(cwd)
  const fallback = { resolveRequest: vi.fn(() => ({ type: 'fallback' })) }

  it('watches the whole workspace and resolves from both node_modules folders', () => {
    expect(config.watchFolders).toEqual([path.resolve(__dirname, '../../..')])
    expect(config.resolver.nodeModulesPaths).toEqual([path.join(appRoot, 'node_modules'), path.resolve(__dirname, '../../../node_modules')])
  })

  it.each(['react', 'react/jsx-runtime', 'react-dom', 'react-native', 'react-native-reanimated', 'react-native-worklets'])(
    'forces %s to the single copy in apps/mobile',
    (name) => {
      const res = config.resolver.resolveRequest(fallback, name, 'ios')
      expect(res.type).toBe('sourceFile')
      expect(res.filePath).toBe(nodeRequire.resolve(name))
      expect(fallback.resolveRequest).not.toHaveBeenCalled()
    },
  )

  it('leaves every other module to normal resolution', () => {
    expect(config.resolver.resolveRequest(fallback, 'zustand', 'android')).toEqual({ type: 'fallback' })
    expect(config.resolver.resolveRequest(fallback, 'react-native-screens', 'ios')).toEqual({ type: 'fallback' })
    expect(fallback.resolveRequest).toHaveBeenCalledWith(fallback, 'zustand', 'android')
  })
})
