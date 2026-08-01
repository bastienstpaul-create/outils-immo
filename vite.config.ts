import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// En prod (GitHub Pages « de projet »), l'app est servie sous /outils-immo/.
// En dev, on reste à la racine pour ne rien changer au confort local.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/outils-immo/' : '/',
  plugins: [react()],
}))
