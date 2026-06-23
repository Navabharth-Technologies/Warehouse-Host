const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs', 'mjs');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'socket.io-client': require.resolve('socket.io-client/dist/socket.io.js'),
};

module.exports = config;
