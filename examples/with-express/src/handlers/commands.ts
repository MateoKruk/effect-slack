import { Router, type Request, type Response } from "express"
import { Effect, Exit } from "effect"
import { SlackService } from "effect-slack"
import { runSlackEffectExit, runEffect } from "../slack.js"

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

  await runEffect(
    Effect.log("Received slash command").pipe(
      Effect.annotateLogs({
        command: payload.command,
        user: payload.user_name,
        channel: payload.channel_name,
        text: payload.text
      })
    )
  )

  switch (payload.command) {
    case "/greet": {
      // Post a greeting message to the channel using Effect
      const program = Effect.gen(function* () {
        const slack = yield* SlackService
        yield* slack.postMessage({
          channel: payload.channel_id,
          text: `Hello <@${payload.user_id}>! ${payload.text ? `You said: "${payload.text}"` : "How can I help you today?"}`
        })
      })

      const exit = await runSlackEffectExit(program)

      if (Exit.isSuccess(exit)) {
        // Ephemeral response only visible to the user
        res.json({
          response_type: "ephemeral",
          text: "Greeting sent!"
        })
      } else {
        await runEffect(
          Effect.logError("Failed to send greeting").pipe(
            Effect.annotateLogs({ cause: exit.cause.toString() })
          )
        )
        res.json({
          response_type: "ephemeral",
          text: "Sorry, I couldn't send the greeting. Please try again."
        })
      }
      return
    }

    case "/ping": {
      // Simple response, no Slack API call needed
      res.json({
        response_type: "ephemeral",
        text: "Pong!"
      })
      return
    }

    default: {
      await runEffect(
        Effect.logWarning("Unknown command").pipe(Effect.annotateLogs({ command: payload.command }))
      )
      res.json({
        response_type: "ephemeral",
        text: `Unknown command: ${payload.command}. Available commands: /greet, /ping`
      })
    }
  }
})

export default router
