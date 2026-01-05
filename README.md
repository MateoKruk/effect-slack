# effect-slack

An Effect-native Slack SDK ✨

## Features

- **100% Type-safe** — Full TypeScript types for all 272 methods, arguments, and responses
- **Typed errors** — Discriminated unions with `catchTag`/`catchTags` for precise error handling
- **Observability built-in** — OpenTelemetry spans with rich attributes (method, channel, user, timestamps)
- **Smart retries** — Rate limit aware with exponential backoff and jitter
- **Testable by design** — Dependency injection via Effect layers, easily mockable
- **Always up-to-date** — Auto-generated from official `@slack/web-api` types

## Installation

```bash
bun add effect-slack effect
# or
npm install effect-slack effect
```

## Quick Start

```typescript
import { Effect } from "effect"
import { SlackService } from "effect-slack"

// Using environment variables (SLACK_TOKEN)
const program = Effect.gen(function* () {
  const slack = yield* SlackService

  const result = yield* slack.postMessage({
    channel: "C1234567890",
    text: "Hello from Effect!"
  })

  console.log("Message sent:", result.ts)
}).pipe(Effect.provide(SlackService.Live))

Effect.runPromise(program)
```

## Examples

Check out the [examples](./examples) folder for complete, runnable examples:

| Example                                                 | Description                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [with-effect-platform](./examples/with-effect-platform) | Full Effect stack using `@effect/platform-bun` with Events API, slash commands, and Swagger docs |
| [with-express](./examples/with-express)                 | Express + Effect integration showing gradual Effect adoption for Slack API calls                 |

## Custom Configuration

```typescript
import { Effect, Layer, Redacted } from "effect"
import { SlackService, SlackConfig, SlackClient } from "effect-slack"

const customConfig = SlackConfig.make({
  token: Redacted.make(process.env.MY_SLACK_TOKEN!),
  options: {
    retryConfig: { retries: 5 }
  }
})

const CustomSlackLayer = SlackService.Default.pipe(
  Layer.provide(SlackClient.Default),
  Layer.provide(customConfig)
)

const program = Effect.gen(function* () {
  const slack = yield* SlackService
  // ... use slack methods
}).pipe(Effect.provide(CustomSlackLayer))
```

## Error Handling

All Slack API errors are mapped to typed Effect errors that can be handled with `catchTag` or `catchTags`:

```typescript
import { Effect } from "effect"
import { SlackService } from "effect-slack"

const program = Effect.gen(function* () {
  const slack = yield* SlackService
  return yield* slack.postMessage({ channel: "C123", text: "Hi" })
}).pipe(
  Effect.catchTags({
    SlackRateLimitedError: (e) =>
      Effect.log(`Rate limited, retry in ${e.retryAfter}s`),
    SlackPlatformError: (e) =>
      e.isAuthError
        ? Effect.logError(`Auth failed: ${e.error}`)
        : Effect.logError(`API error: ${e.error}`),
    SlackHttpError: (e) =>
      Effect.logError(`HTTP ${e.statusCode}: ${e.statusMessage}`)
  }),
  Effect.provide(SlackService.Live)
)
```

### Error Types

| Error Type                             | Description                                                    |
| -------------------------------------- | -------------------------------------------------------------- |
| `SlackRequestError`                    | Network failures, DNS errors                                   |
| `SlackHttpError`                       | Non-200 HTTP responses with `statusCode` and `body`            |
| `SlackPlatformError`                   | Slack API errors with `error` code (e.g., `channel_not_found`) |
| `SlackRateLimitedError`                | Rate limit exceeded, includes `retryAfter` (seconds)           |
| `SlackFileUploadInvalidArgumentsError` | Invalid file upload arguments                                  |
| `SlackFileUploadReadError`             | Failed to read file data                                       |
| `SlackUnknownError`                    | Unexpected errors                                              |

`SlackPlatformError` includes an `isAuthError` getter that returns `true` for auth-related errors (`invalid_auth`, `not_authed`, `token_revoked`, `token_expired`, `account_inactive`).

## Retry Support

The library provides two approaches to retry handling:

### SDK-Level Retries (Default)

The underlying `@slack/web-api` SDK handles retries automatically. You can configure it via `SlackConfig`:

```typescript
import { Redacted } from "effect"
import { SlackConfig } from "effect-slack"

const config = SlackConfig.make({
  token: Redacted.make("xoxb-..."),
  options: {
    retryConfig: { retries: 5 }
  }
})
```

### Disabling SDK Retries

To use Effect-level retries exclusively, disable SDK retries:

```typescript
import { Redacted } from "effect"
import { SlackConfig } from "effect-slack"

const config = SlackConfig.make({
  token: Redacted.make("xoxb-..."),
  options: {
    retryConfig: { retries: 0 },      // Disable SDK retries
    rejectRateLimitedCalls: true       // Don't auto-handle rate limits
  }
})
```

### Effect-Level Retries

For more control, use the Effect-native retry utilities:

```typescript
import { Effect, pipe } from "effect"
import {
  SlackService,
  withDefaultRetry,
  withRateLimitRetry,
  rapidRetryPolicy,
  isRetryableError
} from "effect-slack"

// Apply default retry policy (10 retries with exponential backoff)
const program = pipe(
  Effect.flatMap(SlackService, (slack) =>
    slack.postMessage({ channel: "#general", text: "Hello!" })
  ),
  withDefaultRetry
)

// Or use a custom schedule
const programWithCustomRetry = pipe(
  Effect.flatMap(SlackService, (slack) =>
    slack.postMessage({ channel: "#general", text: "Hello!" })
  ),
  Effect.retry(rapidRetryPolicy)
)
```

### Pre-built Schedules

| Schedule                         | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `tenRetriesInAboutThirtyMinutes` | 10 retries with exponential backoff + jitter  |
| `fiveRetriesInFiveMinutes`       | 5 retries with exponential backoff + jitter   |
| `rapidRetryPolicy`               | 3 retries with 100ms delay (for testing)      |
| `rateLimitAwareSchedule(opts)`   | Configurable retries with exponential backoff |

### Retryable Errors

The `isRetryableError` function determines which errors are safe to retry:

| Error Type              | Retryable | Reason                      |
| ----------------------- | --------- | --------------------------- |
| `SlackRateLimitedError` | Yes       | Transient, has `retryAfter` |
| `SlackRequestError`     | Yes       | Network failures            |
| `SlackHttpError` (5xx)  | Yes       | Server errors               |
| `SlackHttpError` (4xx)  | No        | Client errors               |
| `SlackPlatformError`    | Partial   | Only `service_unavailable`  |
| Auth errors             | No        | Won't resolve with retry    |

## Observability

All SlackService methods are instrumented with OpenTelemetry-compatible spans.

### Span Attributes

| Attribute           | Description                                        |
| ------------------- | -------------------------------------------------- |
| `slack.method`      | Slack API method (e.g., `chat.postMessage`)        |
| `slack.channel`     | Channel ID (where applicable)                      |
| `slack.user`        | User ID (for user operations)                      |
| `slack.ts`          | Message timestamp (for updates/deletes)            |
| `slack.reaction`    | Reaction name (for reaction operations)            |
| `error.type`        | Error tag on failures (e.g., `SlackPlatformError`) |
| `slack.error`       | Platform error code (e.g., `channel_not_found`)    |
| `http.status_code`  | HTTP status code on HTTP errors                    |
| `slack.retry_after` | Retry-After seconds on rate limit errors           |

### Exporting Traces

Use `@effect/opentelemetry` to export traces to your observability backend:

```typescript
import { Effect } from "effect"
import { NodeSdk } from "@effect/opentelemetry"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { SlackService } from "effect-slack"

const TracingLive = NodeSdk.layer(() => ({
  resource: { serviceName: "my-slack-app" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter())
}))

const program = Effect.gen(function* () {
  const slack = yield* SlackService
  yield* slack.postMessage({ channel: "#general", text: "Hello!" })
})

Effect.runPromise(
  program.pipe(
    Effect.provide(SlackService.Live),
    Effect.provide(TracingLive)
  )
)
```

## Available Methods

The library provides **272 methods** across **33 services**, auto-generated from the official `@slack/web-api` types. Services include:

- **ChatService** - Messages, threads, scheduled messages
- **ConversationsService** - Channels, DMs, group conversations
- **UsersService** - User profiles, presence, identity
- **ReactionsService** - Emoji reactions
- **FilesService** - File uploads and management
- **AdminService** - Workspace administration (100+ methods)
- **AppsService**, **AuthService**, **BookmarksService**, **CallsService**, **ViewsService**, and more...

Each service is available as an Effect service with full TypeScript types. See [`src/generated/`](./src/generated/) for the complete API.

## Testing

The library is designed to be easily testable by providing mock implementations:

```typescript
import { Effect, Layer } from "effect"
import { SlackService, SlackClient } from "effect-slack"
import type { WebClient } from "@slack/web-api"

// Create a mock WebClient
const mockClient = {
  chat: {
    postMessage: async () => ({ ok: true, ts: "1234.5678" })
  }
} as unknown as WebClient

// Create test layer
const TestLayer = SlackService.Default.pipe(
  Layer.provide(SlackClient.make(mockClient))
)

// Use in tests
const testProgram = Effect.gen(function* () {
  const slack = yield* SlackService
  const result = yield* slack.postMessage({
    channel: "C123",
    text: "Test message"
  })
  return result
}).pipe(Effect.provide(TestLayer))
```

## Architecture

Services are auto-generated from the `@slack/web-api` TypeScript definitions:

1. **Parse** — Extract method signatures from `@slack/web-api/dist/methods.d.ts`
2. **Generate** — Create Effect-wrapped services with typed arguments and responses
3. **Instrument** — Add OpenTelemetry spans and error mapping to each method

```
@slack/web-api types → Parser → Code Generator → Effect Services
```

Generated services follow a consistent pattern:

```typescript
// Each method is wrapped with Effect.tryPromise, error mapping, and tracing
const postMessage = (args: ChatPostMessageArguments): Effect.Effect<ChatPostMessageResponse, SlackError> =>
  Effect.tryPromise({
    try: () => client.chat.postMessage(args),
    catch: mapSlackError
  }).pipe(
    Effect.tapError(annotateSpanWithError),
    Effect.withSpan("ChatService.postMessage", {
      attributes: { "slack.method": "chat.postMessage" }
    })
  )
```

Run `bun run generate` to regenerate services when updating `@slack/web-api`.

## License

MIT
