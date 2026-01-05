import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer } from "effect"
import { SlackService } from "effect-slack"
import { SlackBotApi } from "./Api.js"
import {
  SlackChallenge,
  SlackEventCallback,
  ChallengeResponse,
  EventAckResponse,
  SlackApiError
} from "./Schemas.js"

export const EventsLive = HttpApiBuilder.group(SlackBotApi, "events", (handlers) =>
  Effect.gen(function* () {
    const slack = yield* SlackService

    return handlers.handle("handleEvent", ({ payload }) =>
      Effect.gen(function* () {
        // Handle URL verification challenge
        if (payload instanceof SlackChallenge) {
          yield* Effect.log("Received URL verification challenge")
          return new ChallengeResponse({ challenge: payload.challenge })
        }

        // Handle event callbacks
        if (payload instanceof SlackEventCallback) {
          const event = payload.event

          yield* Effect.log(`Received event: ${event.type}`, {
            channel: event.channel,
            user: event.user
          })

          // Handle app mentions - respond with a greeting
          if (event.type === "app_mention") {
            yield* slack
              .postMessage({
                channel: event.channel,
                text: `Hello <@${event.user}>! You mentioned me. How can I help?`,
                thread_ts: event.ts
              })
              .pipe(
                Effect.tapError((error) => Effect.logError("Failed to post message", { error })),
                Effect.catchAll(
                  (error) =>
                    new SlackApiError({
                      message: `Failed to respond to mention: ${String(error)}`
                    })
                )
              )
          }

          // Handle direct messages (optional: uncomment to auto-respond to DMs)
          // if (event.type === "message" && event.channel_type === "im") {
          //   yield* slack.postMessage({
          //     channel: event.channel,
          //     text: `Thanks for your message! I received: "${event.text}"`,
          //   })
          // }

          return new EventAckResponse({})
        }

        // Fallback - acknowledge unknown event types
        return new EventAckResponse({})
      }).pipe(
        Effect.withSpan("handleSlackEvent", {
          attributes: {
            "slack.event_type":
              payload instanceof SlackChallenge
                ? "url_verification"
                : payload instanceof SlackEventCallback
                  ? payload.event.type
                  : "unknown"
          }
        })
      )
    )
  })
).pipe(Layer.provide(SlackService.Live))
