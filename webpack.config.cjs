// Phase 8 re-verification trigger — exercises the master -> release promotion -> publish.yml path (v1.0.9). Harmless no-op comment.
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
  return [
    baseConfig('toolbar', mode),
    baseConfig('modal', mode),
  ];
};
