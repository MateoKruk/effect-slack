import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer } from "effect"
import { SlackService } from "effect-slack"
import { SlackBotApi } from "./Api.js"
import { SlashCommandResponse, SlackApiError } from "./Schemas.js"

export const CommandsLive = HttpApiBuilder.group(SlackBotApi, "commands", (handlers) =>
  Effect.gen(function* () {
    const slack = yield* SlackService

    return handlers.handle("handleCommand", ({ payload }) =>
      Effect.gen(function* () {
        yield* Effect.log(`Received slash command: ${payload.command}`, {
          user: payload.user_name,
          channel: payload.channel_name,
          text: payload.text
        })

        // Handle different commands
        switch (payload.command) {
          case "/greet": {
            // Post a greeting message to the channel
            yield* slack
              .postMessage({
                channel: payload.channel_id,
                text: `Hello <@${payload.user_id}>! :wave: ${payload.text ? `You said: "${payload.text}"` : "How can I help you today?"}`
              })
              .pipe(
                Effect.tapError((error) =>
                  Effect.logError("Failed to post greeting", { error })
                ),
                Effect.catchAll(
                  (error) =>
                    new SlackApiError({
                      message: `Failed to send greeting: ${String(error)}`
                    })
                )
              )

            // Acknowledge the command with an ephemeral response
            return new SlashCommandResponse({
              response_type: "ephemeral",
              text: "Greeting sent!"
            })
          }

          case "/ping": {
            // Simple ping/pong response
            return new SlashCommandResponse({
              response_type: "ephemeral",
              text: "Pong! :ping_pong:"
            })
          }

          default: {
            // Handle unknown commands
            yield* Effect.log(`Unknown command: ${payload.command}`)
            return new SlashCommandResponse({
              response_type: "ephemeral",
              text: `Unknown command: ${payload.command}. Available commands: /greet, /ping`
            })
          }
        }
      }).pipe(
        Effect.withSpan("handleSlashCommand", {
          attributes: {
            "slack.command": payload.command,
            "slack.user_id": payload.user_id,
            "slack.channel_id": payload.channel_id
          }
        })
      )
    )
  })
).pipe(Layer.provide(SlackService.Live))
