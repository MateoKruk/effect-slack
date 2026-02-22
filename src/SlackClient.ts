import { WebClient } from "@slack/web-api"
import { Context, Effect, Layer, Redacted } from "effect"

import { SlackConfig } from "./SlackConfig.js"

/**
 * SlackClient service - provides access to the underlying WebClient
 */
export class SlackClient extends Context.Tag("effect-slack/SlackClient")<SlackClient, WebClient>() {
  /**
   * Default layer that creates WebClient from SlackConfig
   */
  static readonly Default: Layer.Layer<SlackClient, never, SlackConfig> = Layer.effect(
    SlackClient,
    Effect.gen(function* () {
      const config = yield* SlackConfig
      const token = Redacted.value(config.token)
      return new WebClient(token, config.options)
    })
  )

  /**
   * Create layer with custom WebClient instance
   */
  static readonly make = (client: WebClient): Layer.Layer<SlackClient> =>
    Layer.succeed(SlackClient, client)
}
