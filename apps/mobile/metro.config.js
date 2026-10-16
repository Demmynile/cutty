const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.extraNodeModules = {
	react: path.resolve(projectRoot, 'node_modules/react'),
	'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
}

// npm sometimes nests a second, disconnected copy of these packages inside
// nativewind/node_modules (its peer-dependency chain can't see the sibling
// copy in this workspace from where nativewind gets hoisted to the repo
// root). Two React or Reanimated instances in one bundle causes runtime
// crashes like "Cannot read property 'useRef' of null". extraNodeModules
// only applies when normal resolution fails, and normal resolution finds
// the nested copies just fine, so force these to a single path unconditionally.
const SINGLETON_MODULES = ['react', 'react-dom', 'react-native', 'react-native-reanimated', 'react-native-worklets']
const { resolveRequest: defaultResolveRequest } = config.resolver
config.resolver.resolveRequest = (context, moduleName, platform) => {
	const isSingleton = SINGLETON_MODULES.some((name) => moduleName === name || moduleName.startsWith(`${name}/`))
	if (isSingleton) {
		return {
			type: 'sourceFile',
			filePath: require.resolve(moduleName, { paths: [projectRoot] }),
		}
	}
	return defaultResolveRequest
		? defaultResolveRequest(context, moduleName, platform)
		: context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
