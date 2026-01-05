import { Router, type Request, type Response } from "express"
import { Effect, Exit } from "effect"
import { SlackService } from "effect-slack"
import { runSlackEffectExit } from "../slack.js"

const router = Router()

// Slack slash command payload
interface SlashCommandPayload {
  command: string
  text?: string
  user_id: string
  user_name: string
  channel_id: string
  channel_name: string
  response_url: string
}

/**
 * POST /slack/commands - Slack slash command handler
 *
 * Handles:
 * - /greet [message] - Posts a greeting to the channel
 * - /ping - Returns a simple pong response
 */
router.post("/slack/commands", async (req: Request, res: Response) => {
  const payload = req.body as SlashCommandPayload

  console.log(`Received command: ${payload.command}`, {
    user: payload.user_name,
    channel: payload.channel_name
  })

  switch (payload.command) {
    case "/greet": {
      const program = Effect.gen(function* () {
        const slack = yield* SlackService

        yield* Effect.log("Sending greeting").pipe(
          Effect.annotateLogs({ channel: payload.channel_id, user: payload.user_id })
        )

        yield* slack.postMessage({
          channel: payload.channel_id,
          text: `Hello <@${payload.user_id}>! ${payload.text ? `You said: "${payload.text}"` : "How can I help you today?"}`
        })
      })

      const exit = await runSlackEffectExit(program)

      if (Exit.isSuccess(exit)) {
        res.json({ response_type: "ephemeral", text: "Greeting sent!" })
      } else {
        console.error("Failed to send greeting:", exit.cause)
        res.json({ response_type: "ephemeral", text: "Sorry, couldn't send the greeting." })
      }
      return
    }

    case "/ping": {
      res.json({ response_type: "ephemeral", text: "Pong!" })
      return
    }

    default: {
      console.log(`Unknown command: ${payload.command}`)
      res.json({
        response_type: "ephemeral",
        text: `Unknown command: ${payload.command}. Available: /greet, /ping`
      })
    }
  }
})

export default router
