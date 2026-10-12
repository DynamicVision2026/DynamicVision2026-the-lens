import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { assertBundle } from '../../scripts/check-bundle.mjs';

assertBundle();

export default defineConfig({
  plugins: [react()],
});
