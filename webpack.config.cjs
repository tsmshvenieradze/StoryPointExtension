const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function baseConfig(entryName, mode) {
  return {
    mode,
    entry: { [entryName]: `./src/entries/${entryName}.tsx` },
    output: {
      filename: `${entryName}.js`,
      path: path.resolve(__dirname, 'dist'),
      publicPath: '',
      clean: false,
    },
    devtool: mode === 'development' ? 'inline-source-map' : false,
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: { transpileOnly: false },
        },
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(woff2?|ttf|eot|svg|png)$/,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: `${entryName}.html`,
        template: 'src/template.html',
        inject: 'body',
        chunks: [entryName],
      }),
    ],
    target: 'web',
    performance: { hints: false },
  };
}

module.exports = (env, argv) => {
  const mode = argv.mode === 'production' ? 'production' : 'development';
  // SPIKE — modal-spike entry is added for Plan 04-01 (D-01/D-05/D-10
  // empirical resolution). Reverted in Plan 04-01 Task 4.
  return [
    baseConfig('toolbar', mode),
    baseConfig('modal', mode),
    baseConfig('modal-spike', mode),
  ];
};
