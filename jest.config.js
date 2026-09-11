module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@wuba/react-native-echarts|echarts|zrender|react-native-svg|react-native-safe-area-context|react-native-screens)/)',
  ],
};
