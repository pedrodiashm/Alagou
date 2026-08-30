// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "web-dist/*", ".expo/*", "server/*", "node_modules/*"],
  },
  {
    rules: {
      // Padrão legítimo de "carregar dados no mount" (fetch on mount).
      // Mantido como warning para não quebrar o CI nem poluir a edição.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);