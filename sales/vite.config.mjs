import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import { fileURLToPath } from 'node:url';
const path = relative => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  css: {postcss:{plugins:[tailwind()]}},
  define: {'process.env.NEXT_PUBLIC_SALES_READ_ONLY':JSON.stringify('true')},
  root: path('./ui'), publicDir: path('../public'),
  plugins: [react()],
  resolve: { dedupe:['react','react-dom'], alias: [
    { find: /^.*\/LiveIntelligence$/, replacement: path('./ui/LiveIntelligence.tsx') },
    {find:'tailwindcss',replacement:require.resolve('tailwindcss/index.css')},
    { find: 'next/image', replacement: path('./ui/image.tsx') },
  ] },
  build: { outDir: path('./dist'), emptyOutDir:true },
});
