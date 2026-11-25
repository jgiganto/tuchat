import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // En desarrollo, el Hub se reenvía al backend (incluido el WebSocket) para que el navegador
    // lo vea todo en el mismo origen, igual que en producción, donde el backend sirve el frontend.
    proxy: {
      '/hubs': { target: 'http://localhost:5125', ws: true, changeOrigin: true },
    },
  },
})
