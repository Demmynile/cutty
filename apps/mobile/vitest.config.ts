import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const stub = (file: string) => here(`./__tests__/stubs/${file.includes('.') ? file : `${file}.ts`}`)

// Logic tests for the Expo app run in Node. Native modules are replaced with
// small in-memory stubs (react-native renders to the DOM for screen tests);
// React resolves to the app's own React 19 everywhere.
export default defineProject({
  resolve: {
    alias: [
      { find: '@cutty/types', replacement: here('../../packages/types/index.ts') },
      { find: /^@\//, replacement: here('./') },
      { find: /^react$/, replacement: here('./node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: here('./node_modules/react/jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: here('./node_modules/react/jsx-dev-runtime.js') },
      { find: /^react-dom\/client$/, replacement: here('./node_modules/react-dom/client.js') },
      { find: /^react-native$/, replacement: stub('react-native.tsx') },
      { find: /^expo-router$/, replacement: stub('expo-router.tsx') },
      { find: /^expo-image$/, replacement: stub('expo-image.tsx') },
      { find: /^expo-linear-gradient$/, replacement: stub('expo-linear-gradient.tsx') },
      { find: /^react-native-safe-area-context$/, replacement: stub('safe-area.tsx') },
      { find: /^react-native-reanimated$/, replacement: stub('reanimated.tsx') },
      { find: /^(expo-status-bar|expo-splash-screen|expo-sharing|expo-file-system\/legacy|expo-crypto|@clerk\/expo\/token-cache)$/, replacement: stub('misc-expo') },
      { find: /^@clerk\/expo\/experimental$/, replacement: stub('clerk-expo') },
      { find: /^@clerk\/expo$/, replacement: stub('clerk-expo') },
      { find: /^expo-secure-store$/, replacement: stub('expo-secure-store') },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: stub('async-storage') },
      { find: /^expo-constants$/, replacement: stub('expo-constants') },
      { find: /^expo-web-browser$/, replacement: stub('expo-web-browser') },
      { find: /^expo-linking$/, replacement: stub('expo-linking') },
      { find: /^expo-image-picker$/, replacement: stub('expo-image-picker') },
      { find: /^expo-image-manipulator$/, replacement: stub('expo-image-manipulator') },
      { find: /^nativewind$/, replacement: stub('nativewind') },
      { find: /^expo-location$/, replacement: stub('expo-location') },
      { find: /^react-native-maps$/, replacement: stub('react-native-maps.tsx') },
      { find: /^@expo\/vector-icons$/, replacement: stub('vector-icons.tsx') },
    ],
  },
  define: { __DEV__: 'true' },
  esbuild: { jsx: 'automatic' },
  test: {
    name: 'mobile',
    environment: 'node',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['__tests__/setup.ts'],
    // Inlined so their `import 'react'` goes through the alias above.
    server: { deps: { inline: ['zustand', 'react-hook-form', '@hookform/resolvers', '@tanstack/react-query'] } },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
