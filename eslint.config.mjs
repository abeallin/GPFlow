import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default defineConfig([
  globalIgnores(['out/**', 'dist-electron/**', 'release/**', 'node_modules/**', 'archive/**', '.next/**', '.venv/**']),
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the jsx-a11y plugin (with a subset of its rules);
  // re-adding the plugin object would collide, so only the recommended rule set is layered on.
  { rules: jsxA11y.flatConfigs.recommended.rules },
  {
    rules: {
      // Pages are prerendered as static HTML, so browser storage can only be read after
      // hydration — inside an effect, followed by setState. That is the exact pattern this
      // rule flags; here it is the correct one, not derived state.
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
]);
