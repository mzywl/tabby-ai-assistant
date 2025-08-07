const path = require('path')

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        use: 'raw-loader'
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  externals: [
    'tabby-core',
    'tabby-terminal',
    'tabby-settings',
    '@angular/animations',
    '@angular/cdk',
    '@angular/common',
    '@angular/core',
    '@angular/forms',
    '@angular/platform-browser',
    '@ng-bootstrap/ng-bootstrap',
    '@ngx-translate/core',
    'ngx-translate-messageformat-compiler',
    'rxjs',
    'rxjs/operators',
    'zone.js/dist/zone',
    'electron',
  ],
  target: 'electron-renderer',
}