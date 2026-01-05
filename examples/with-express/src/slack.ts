import { Effect, Layer, type ConfigError } from "effect"
import { SlackService, type SlackError } from "effect-slack"

/**
 * Pre-configured layer for SlackService with environment config.
 * SlackService.Live already includes SlackConfig.fromEnv.
 */
const SlackLive: Layer.Layer<SlackService, ConfigError.ConfigError> = SlackService.Live

/**
 * Run an Effect program that uses SlackService.
 *
 * This is the bridge between Effect and Express - it converts an Effect
 * into a Promise that Express route handlers can await.
 *
 * @example
 * ```typescript
 * app.post("/slack/events", async (req, res) => {
 *   const program = Effect.gen(function* () {
 *     const slack = yield* SlackService
 *     yield* slack.postMessage({ channel: "#general", text: "Hello!" })
 *   })
 *
 *   await runSlackEffect(program)
 *   res.json({ ok: true })
 * })
 * ```
 */
export const runSlackEffect = <A>(
  program: Effect.Effect<A, SlackError | ConfigError.ConfigError, SlackService>
): Promise<A> => program.pipe(Effect.provide(SlackLive), Effect.runPromise)

/**
 * Run an Effect program and return the exit result (success or failure).
 * Useful when you need to handle errors in Express without throwing.
 */
export const runSlackEffectExit = <A>(
  program: Effect.Effect<A, SlackError | ConfigError.ConfigError, SlackService>
) => program.pipe(Effect.provide(SlackLive), Effect.runPromiseExit)
