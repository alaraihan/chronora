import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "uploads/**",
      "public/**",
      ".git/**"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "no-console": "warn",
      "no-undef": "error",
      "no-constant-condition": "warn",
      "no-empty": "warn",
      "prefer-const": "warn",
      "no-var": "error",
      "eqeqeq": ["warn", "always"],
      "curly": ["warn", "all"],
      "no-trailing-spaces": "warn",
      "semi": ["warn", "always"],
      "quotes": ["warn", "double"],
      "indent": ["warn", 2],
      "comma-dangle": ["warn", "never"],
      "no-multiple-empty-lines": ["warn", { max: 2 }],
      "space-before-function-paren": [
        "warn",
        { anonymous: "always", named: "never", asyncArrow: "always" }
      ],
      "keyword-spacing": "warn",
      "space-before-blocks": "warn"
    }
  },
  {
    files: ["controller/**/*.js", "routes/**/*.js", "middlewares/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_|req|res|next" }]
    }
  },
  {
    files: ["config/**/*.js"],
    rules: {
      "no-process-env": "off"
    }
  }
];