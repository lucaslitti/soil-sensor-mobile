const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// echarts/zrender pin tslib@2.3.0, whose `import` export entry
// (tslib/modules/index.js) fails under Metro's package-exports resolution with
// "Cannot read property '__extends' of undefined". Force the pure ESM build.
const TSLIB_ESM = path.resolve(__dirname, 'node_modules/tslib/tslib.es6.js');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'tslib') {
        return context.resolveRequest(context, TSLIB_ESM, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
