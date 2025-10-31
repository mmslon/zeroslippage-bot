const path = require("node:path");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  target: "node",
  entry: "./src/index.ts",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      // resolve TS paths
      "#db": path.resolve(__dirname, "../../packages/db/src"),
      "#processing": path.resolve(__dirname, "../../packages/processing/src"),
      "#exchanges": path.resolve(__dirname, "../../packages/exchanges/src"),
      "#trpc": path.resolve(__dirname, "../../packages/trpc/src"),
    },
  },
  // in order to ignore all modules in node_modules folder
  externals: [
    nodeExternals({
      allowlist: [
        /^@opentrader/, // bundle only `@opentrader/*` packages
      ],
    }),
  ],
  externalsPresets: {
    node: true, // in order to ignore built-in modules like path, fs, etc.
  },
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
};
