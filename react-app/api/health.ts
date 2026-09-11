import express from 'express'
import { createHealthHandler } from '../server/primeverse-online/server.js'

const app = express()
app.disable('x-powered-by')
app.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})
const health = createHealthHandler()
app.get(['/api/health', '/health', '/'], health)

export default app
