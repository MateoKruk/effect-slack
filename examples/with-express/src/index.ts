import express from "express"
import { Effect } from "effect"
import healthRouter from "./handlers/health.js"
import eventsRouter from "./handlers/events.js"
import commandsRouter from "./handlers/commands.js"
import { runEffectSync } from "./slack.js"

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
  runEffectSync(
    Effect.log("Server started").pipe(
      Effect.annotateLogs({
        port: PORT,
        health: `http://localhost:${PORT}/health`,
        events: `http://localhost:${PORT}/slack/events`,
        commands: `http://localhost:${PORT}/slack/commands`
      })
    )
  )
})
