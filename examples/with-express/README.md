# Slack Bot with Express + Effect

A Slack bot example showing how to integrate `effect-slack` into an Express application. This demonstrates gradual Effect adoption - using Effect only for Slack API calls while keeping Express for HTTP handling.

## Why Express + Effect?

This example is for teams who:

- Already use Express and want to adopt Effect incrementally
- Prefer Express's familiar routing API
- Want Effect's benefits (type-safe errors, retries, tracing) for Slack interactions
- Are evaluating Effect without a full commitment

## Features

- **Express Routes** - Standard Express routing you know and love
- **Effect for Slack** - Type-safe Slack API calls via `effect-slack`
- **Effect Logging** - Structured logging with `Effect.log` and annotations
- **Simple Bridge** - `runSlackEffect()` helper converts Effect to Promise
- **Error Handling** - Graceful error handling with `Exit.isFailure`

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Slack credentials
```

### 3. Run the server

```bash
bun run dev
```

### 4. Expose locally (for development)

```bash
ngrok http 3000
```

### 5. Configure Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app or select an existing one
3. Under **OAuth & Permissions**, add Bot Token Scopes:
   - `chat:write`
   - `app_mentions:read`
   - `commands`
4. Install the app to your workspace
5. Copy the **Bot User OAuth Token** to your `.env`
6. Under **Basic Information**, copy the **Signing Secret** to your `.env`
7. Under **Event Subscriptions**:
   - Enable events
   - Set Request URL: `https://your-ngrok-url.ngrok.io/slack/events`
   - Subscribe to: `app_mention`
8. Under **Slash Commands**, create:
   - `/greet` - Request URL: `https://your-ngrok-url.ngrok.io/slack/commands`
   - `/ping` - Request URL: `https://your-ngrok-url.ngrok.io/slack/commands`

## The Key Pattern

The bridge between Express and Effect is the `runSlackEffect()` helper:

```typescript
// src/slack.ts
import { Effect, Layer } from "effect"
import { SlackService, type SlackError } from "effect-slack"

export const runSlackEffect = <A>(
  program: Effect.Effect<A, SlackError, SlackService>
): Promise<A> =>
  program.pipe(
    Effect.provide(SlackService.Live),
    Effect.runPromise
  )
```

Use it in Express routes:

```typescript
// src/handlers/events.ts
router.post("/slack/events", async (req, res) => {
  const { event } = req.body

  if (event.type === "app_mention") {
    const program = Effect.gen(function* () {
      const slack = yield* SlackService
      yield* slack.postMessage({
        channel: event.channel,
        text: `Hello <@${event.user}>!`,
        thread_ts: event.ts
      })
    })

    await runSlackEffect(program)
  }

  res.json({})
})
```

## Project Structure

```
src/
  index.ts              # Express app setup
  slack.ts              # Effect-to-Promise bridge
  handlers/
    health.ts           # GET /health
    events.ts           # POST /slack/events
    commands.ts         # POST /slack/commands
```

## API Endpoints

| Endpoint          | Method | Description              |
| ----------------- | ------ | ------------------------ |
| `/slack/events`   | POST   | Slack Events API webhook |
| `/slack/commands` | POST   | Slash command handler    |
| `/health`         | GET    | Health check             |

## Error Handling

Use `runSlackEffectExit()` for graceful error handling:

```typescript
import { Effect, Exit } from "effect"
import { runSlackEffectExit, runEffect } from "../slack.js"

const exit = await runSlackEffectExit(program)

if (Exit.isSuccess(exit)) {
  res.json({ ok: true })
} else {
  await runEffect(
    Effect.logError("Slack error").pipe(
      Effect.annotateLogs({ cause: exit.cause.toString() })
    )
  )
  res.status(500).json({ error: "Failed to send message" })
}
```

## Comparison with Effect Platform Example

| Aspect         | This Example (Express)     | with-effect-platform           |
| -------------- | -------------------------- | ------------------------------ |
| HTTP Framework | Express                    | @effect/platform HttpApi       |
| Effect Usage   | Only for Slack calls       | Full Effect throughout         |
| Learning Curve | Low (familiar Express)     | Higher (learn Effect patterns) |
| Type Safety    | Partial (Slack calls only) | Full (routes + Slack)          |
| Best For       | Gradual adoption           | Greenfield Effect projects     |

## Learn More

- [effect-slack documentation](https://github.com/mateokruk/effect-slack)
- [Effect documentation](https://effect.website)
- [Express documentation](https://expressjs.com)
- [Slack API documentation](https://api.slack.com/docs)

## License

MIT
