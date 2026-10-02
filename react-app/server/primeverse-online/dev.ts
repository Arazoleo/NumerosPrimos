import { createPrimeverseServer } from './server.js'

const port = readPort(process.env.PORT)
const host = process.env.PRIMEVERSE_HOST?.trim() || '127.0.0.1'
const runtime = createPrimeverseServer()

runtime.server.listen(port, host, () => {
  const storage = runtime.store.mode
  process.stdout.write(
    `Primeverse Online em http://${host}:${port} · ws /api/primeverse · storage ${storage}\n`,
  )
})

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  process.stdout.write(`Encerrando Primeverse Online (${signal})…\n`)
  await runtime.close()
  process.exitCode = 0
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

function readPort(raw: string | undefined): number {
  const parsed = raw === undefined || raw.trim() === '' ? 8787 : Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new RangeError('PORT deve estar entre 1 e 65535.')
  }
  return parsed
}
