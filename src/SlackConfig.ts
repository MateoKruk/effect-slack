import type { WebClientOptions } from "@slack/web-api"
import { Context, Effect, Layer, Config, Redacted, type ConfigError } from "effect"

/**
 * Slack configuration interface
 */
export interface SlackConfigShape {
  readonly token: Redacted.Redacted<string>
  readonly options?: Omit<WebClientOptions, "token">
}

/**
 * SlackConfig service tag
 */
export class SlackConfig extends Context.Tag("effect-slack/SlackConfig")<
  SlackConfig,
  SlackConfigShape
>() {
  /**
   * Create config layer from environment variables
   * Expects SLACK_TOKEN environment variable
   */
  static readonly fromEnv: Layer.Layer<SlackConfig, ConfigError.ConfigError> = Layer.effect(
    SlackConfig,
    Effect.gen(function* () {
      const token = yield* Config.redacted("SLACK_TOKEN")
      return { token }
    })
  )

  /**
   * Create config layer from explicit values
   */
  static readonly make = (config: SlackConfigShape): Layer.Layer<SlackConfig> =>
    Layer.succeed(SlackConfig, config)
}
