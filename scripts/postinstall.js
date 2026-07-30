// Some Expo tooling (e.g. babel-preset-expo, @expo/cli) resolves sibling
// packages like `expo` and `expo-router` with a naive require.resolve()
// relative to its own hoisted location, instead of the project root. In an
// npm workspace those tools get hoisted to the repo root while their
// siblings stay nested under apps/mobile/node_modules, breaking that lookup.
// Symlinking them into the root node_modules fixes discovery without
// perturbing npm's own dependency resolution (e.g. React versions).
const fs = require('fs')
const path = require('path')

const packages = ['expo', 'expo-router']

for (const name of packages) {
  const target = path.join(__dirname, '..', 'node_modules', name)
  const source = path.join(__dirname, '..', 'apps', 'mobile', 'node_modules', name)
  if (!fs.existsSync(target) && fs.existsSync(source)) {
    fs.symlinkSync(path.relative(path.dirname(target), source), target, 'dir')
  }
}
