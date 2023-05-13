module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    jest: true,
  },
  plugins: ["prettier"],
  extends: ["plugin:prettier/recommended"],
  ignorePatterns: ["static/**/*", "**/*.d.ts"],
  rules: {},
};
