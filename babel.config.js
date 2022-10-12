module.exports = {
  ignore: [/(node_modules)/],
  plugins: ['@babel/plugin-proposal-object-rest-spread', '@babel/plugin-proposal-class-properties'],
  presets: [
    '@babel/preset-typescript',

    [
      '@babel/preset-env',
      {
        corejs: 3,
        useBuiltIns: 'usage',
        targets: {
          node: 'current',
        },
      },
    ],
  ],
};
