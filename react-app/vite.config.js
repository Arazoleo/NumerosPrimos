import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const multiplayerPort = readPort(process.env.PORT ?? environment.PORT)
  const multiplayerTarget = `http://127.0.0.1:${multiplayerPort}`

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api/primeverse': { target: multiplayerTarget, ws: true },
        '/health': { target: multiplayerTarget },
      },
    },
  }
})

function readPort(raw) {
  if (raw === undefined || raw === '') return 8787
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new RangeError('PORT deve estar entre 1 e 65535.')
  }
  return parsed
}
