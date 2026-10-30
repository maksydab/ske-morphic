
export default {
  plugins: [
    (await import("postcss-import")).default(),
    (await import("cssnano")).default({
      preset: "default"
    })
  ]
};
