import express from "express"
import healthRouter from "./handlers/health.js"
import eventsRouter from "./handlers/events.js"
import commandsRouter from "./handlers/commands.js"

const app = express()

// Parse JSON bodies (for Slack Events API)
app.use(express.json())

// Parse URL-encoded bodies (for Slack slash commands)
app.use(express.urlencoded({ extended: true }))

// Mount route handlers
app.use(healthRouter)
app.use("/slack", eventsRouter)
app.use("/slack", commandsRouter)

// Start server
const PORT = process.env["PORT"] ?? 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Slack events: http://localhost:${PORT}/slack/events`)
  console.log(`Slack commands: http://localhost:${PORT}/slack/commands`)
})
