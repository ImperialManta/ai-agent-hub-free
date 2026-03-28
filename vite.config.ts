import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // WSL2: inotify doesn't work on Windows-mounted drives (/mnt/d/)
  // Use polling so Vite detects file changes reliably
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
