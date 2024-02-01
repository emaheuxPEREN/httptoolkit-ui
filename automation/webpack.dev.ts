import * as path from "path";
import * as Webpack from 'webpack';

import merge from 'webpack-merge';
import common from './webpack.common';

export default merge(common, {
    mode: 'development',

    devtool: 'eval-cheap-module-source-map' as any,

    devServer: {
        host: '127.0.0.1',
        historyApiFallback: true
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader',
                exclude: [
                    path.join(__dirname, '..', 'node_modules', 'monaco-editor'),
                    path.join(__dirname, '..', 'node_modules', 'subscriptions-transport-ws'),
                    path.join(__dirname, '..', '..', 'mockttp', 'node_modules', 'subscriptions-transport-ws'),
                    path.join(__dirname, '..', 'node_modules', 'js-beautify'),
                    path.join(__dirname, '..', 'node_modules', 'graphql-subscriptions'),
                ]
            }
        ]
    },

    plugins: [
        new Webpack.DefinePlugin({
            'process.env.DISABLE_UPDATES': 'true'
        })
    ]
});
