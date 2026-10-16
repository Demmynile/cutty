import Module from 'node:module'
import path from 'node:path'

// Metro lets the app `require()` images; under Node, resolve them to a marker
// object naming the file instead of trying to parse JPEG bytes as JavaScript.
const extensions = (Module as unknown as { _extensions: Record<string, (m: { exports: unknown }, file: string) => void> })._extensions
for (const ext of ['.jpg', '.jpeg', '.png']) {
  extensions[ext] = (m, file) => {
    m.exports = { testUri: path.relative(path.resolve(__dirname, '..'), file) }
  }
}

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3002'
process.env.EXPO_PUBLIC_REALTIME_URL = 'http://localhost:4000'
process.env.EXPO_PUBLIC_SANITY_PROJECT_ID = 'testproj'
process.env.EXPO_PUBLIC_SANITY_DATASET = 'test'
