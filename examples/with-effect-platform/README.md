# Slack Bot with Effect Platform

A production-ready Slack Bot API example using `effect-slack` and `@effect/platform-bun`.

## Features

- **Slack Events API** - Handle messages, app mentions, and more
- **Slash Commands** - Respond to custom commands (`/greet`, `/ping`)
- **Request Verification** - HMAC-SHA256 signature verification utilities included
- **OpenAPI Documentation** - Auto-generated Swagger UI at `/docs`
- **Type-safe** - Full TypeScript with Effect Schema validation
- **Observability** - Built-in spans for tracing

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
# Using ngrok or similar
ngrok http 3000
```

### 5. Configure Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app or select an existing one
3. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write` - Send messages
   - `app_mentions:read` - Receive mention events
   - `commands` - Handle slash commands
4. Install the app to your workspace
5. Copy the **Bot User OAuth Token** (`xoxb-...`) to your `.env`
6. Under **Basic Information**, copy the **Signing Secret** to your `.env`
7. Under **Event Subscriptions**:
   - Enable events
   - Set Request URL to: `https://your-ngrok-url.ngrok.io/slack/events`
   - Subscribe to bot events: `app_mention`, `message.im` (optional)
8. Under **Slash Commands**, create commands:
   - `/greet` - Request URL: `https://your-ngrok-url.ngrok.io/slack/commands`
   - `/ping` - Request URL: `https://your-ngrok-url.ngrok.io/slack/commands`

## API Endpoints

| Endpoint          | Method | Description              |
| ----------------- | ------ | ------------------------ |
| `/slack/events`   | POST   | Slack Events API webhook |
| `/slack/commands` | POST   | Slash command handler    |
| `/health`         | GET    | Health check             |
| `/docs`           | GET    | Swagger UI documentation |

## Project Structure

```
src/
  Api.ts              # HttpApi definition with endpoint groups
  Config.ts           # Application configuration
  Main.ts             # Entry point - wires everything together
  Schemas.ts          # Effect Schema definitions for Slack payloads
  SignatureVerification.ts  # Request signature verification
  SlackEvents.ts      # Event handlers (mentions, messages)
  SlashCommands.ts    # Slash command handlers
```

## Using effect-slack

This example demonstrates using `effect-slack` to interact with the Slack API:

```typescript
import { Effect } from "effect"
import { SlackService } from "effect-slack"

const handleAppMention = Effect.gen(function* () {
  const slack = yield* SlackService

  yield* slack.postMessage({
    channel: "C1234567890",
    text: "Hello! I received your mention."
  })
})
```

## Error Handling

The example uses Effect's typed error handling:

```typescript
import { SlackService } from "effect-slack"

const program = Effect.gen(function* () {
  const slack = yield* SlackService
  yield* slack.postMessage({ channel, text })
}).pipe(
  Effect.catchTags({
    SlackRateLimitedError: (e) =>
      Effect.log(`Rate limited for ${e.retryAfter}s`),
    SlackPlatformError: (e) =>
      Effect.logError(`Slack error: ${e.error}`)
  })
)
```

## Environment Variables

| Variable               | Required | Description                             |
| ---------------------- | -------- | --------------------------------------- |
| `SLACK_TOKEN`          | Yes      | Bot User OAuth Token (`xoxb-...`)       |
| `SLACK_SIGNING_SECRET` | Yes      | Signing Secret for request verification |
| `PORT`                 | No       | Server port (default: 3000)             |

## Available Commands

### `/greet [message]`

Posts a greeting message to the channel.

Example: `/greet Hello everyone!`

### `/ping`

Returns a simple "Pong!" response (ephemeral).

## Development

### Type checking

```bash
bun run typecheck
```

### Watch mode

```bash
bun run dev
```

### Production

```bash
bun run start
```

## Learn More

- [effect-slack documentation](https://github.com/mateokruk/effect-slack)
- [Effect documentation](https://effect.website)
- [@effect/platform documentation](https://effect.website/docs/guides/platform/introduction)
- [Slack API documentation](https://api.slack.com/docs)

## License

MIT
