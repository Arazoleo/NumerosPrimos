import { createPrimeverseServer } from '../server/primeverse-online/server.js'

// Vercel WebSocket Functions (Public Beta) accept an exported Node HTTP server.
const runtime = createPrimeverseServer()

export default runtime.server
