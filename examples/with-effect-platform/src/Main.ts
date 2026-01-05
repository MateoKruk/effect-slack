import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { SlackConfig } from "effect-slack"
import { SlackBotApi } from "./Api.js"
import { AppConfig } from "./Config.js"
import { EventsLive } from "./SlackEvents.js"
import { CommandsLive } from "./SlashCommands.js"
import { HealthResponse } from "./Schemas.js"

// =============================================================================
// Health Group Implementation
// =============================================================================

const HealthLive = HttpApiBuilder.group(SlackBotApi, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed(new HealthResponse({ status: "ok" })))
)

// =============================================================================
// API Implementation
// =============================================================================

const ApiLive = HttpApiBuilder.api(SlackBotApi).pipe(
  Layer.provide(EventsLive),
  Layer.provide(CommandsLive),
  Layer.provide(HealthLive)
)

// =============================================================================
// Server Configuration
// =============================================================================

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Add Swagger documentation at /docs
  Layer.provide(HttpApiSwagger.layer({ path: "/docs" })),
  // Add CORS support
  Layer.provide(HttpApiBuilder.middlewareCors()),
  // Provide the API implementation
  Layer.provide(ApiLive),
  // Log server address on startup
  HttpServer.withLogAddress,
  // Configure the HTTP server with port from config
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
  // Provide Slack configuration from environment
  Layer.provide(SlackConfig.fromEnv),
  // Provide the app configuration
  Layer.provide(AppConfig.fromEnv)
)

// =============================================================================
// Main
// =============================================================================

BunRuntime.runMain(Layer.launch(ServerLive))
