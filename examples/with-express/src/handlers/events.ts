import { Router, type Request, type Response } from "express"
import { Effect, Exit } from "effect"
import { SlackService } from "effect-slack"
import { runSlackEffectExit } from "../slack.js"

const router = Router()

// Slack event payload types (simplified for this example)
interface SlackChallenge {
  type: "url_verification"
  challenge: string
}

interface SlackEventCallback {
  type: "event_callback"
  event: {
    type: string
    channel: string
    user: string
    text: string
    ts: string
  }
}

type SlackEventPayload = SlackChallenge | SlackEventCallback

/**
 * POST /slack/events - Slack Events API webhook handler
 *
 * Handles:
 * - URL verification challenges (required for Slack app setup)
 * - app_mention events (responds when bot is @mentioned)
 */
router.post("/slack/events", async (req: Request, res: Response) => {
  const payload = req.body as SlackEventPayload

  // Handle URL verification challenge
  if (payload.type === "url_verification") {
    console.log("Received URL verification challenge")
    res.json({ challenge: payload.challenge })
    return
  }

  // Handle event callbacks
  if (payload.type === "event_callback") {
    const { event } = payload

    console.log(`Received event: ${event.type}`, { channel: event.channel, user: event.user })

    // Respond to app mentions using Effect
    if (event.type === "app_mention") {
      const program = Effect.gen(function* () {
        const slack = yield* SlackService

        yield* Effect.log("Responding to app mention").pipe(
          Effect.annotateLogs({ channel: event.channel, user: event.user })
        )

        yield* slack.postMessage({
          channel: event.channel,
          text: `Hello <@${event.user}>! You mentioned me. How can I help?`,
          thread_ts: event.ts
        })
      })

      const exit = await runSlackEffectExit(program)

      if (Exit.isFailure(exit)) {
        console.error("Failed to respond to mention:", exit.cause)
      }
    }

    res.json({})
    return
  }

  res.json({})
})

export default router
