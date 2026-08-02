import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { copyFileSync, mkdirSync, cpSync } from 'node:fs'

// Build de l'extension Chrome (MV3), séparé du build du site.
// Produit le panneau latéral (le MÊME app React que le site) dans dist-extension/,
// puis y copie les fichiers statiques de l'extension (manifest + service worker).
export default defineConfig({
  base: './', // chemins relatifs : obligatoire pour une page servie par l'extension
  plugins: [
    react(),
    {
      name: 'copie-fichiers-extension',
      closeBundle() {
        const out = resolve('dist-extension')
        mkdirSync(out, { recursive: true })
        for (const f of ['manifest.json', 'background.js']) {
          copyFileSync(resolve('extension', f), resolve(out, f))
        }
        cpSync(resolve('extension', 'icons'), resolve(out, 'icons'), { recursive: true })
      },
    },
  ],
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: { sidepanel: resolve('sidepanel.html') },
    },
  },
})
