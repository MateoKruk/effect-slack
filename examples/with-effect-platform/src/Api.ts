import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import {
  SlackEventPayload,
  ChallengeResponse,
  EventAckResponse,
  SlashCommandPayload,
  SlashCommandResponse,
  HealthResponse,
  SignatureVerificationError,
  SlackApiError
} from "./Schemas.js"

// =============================================================================
// Events Group - /slack/events
// =============================================================================

const EventsGroup = HttpApiGroup.make("events").add(
  HttpApiEndpoint.post("handleEvent", "/slack/events")
    .setPayload(SlackEventPayload.pipe(HttpApiSchema.withEncoding({ kind: "Json" })))
    .addSuccess(ChallengeResponse)
    .addSuccess(EventAckResponse)
    .addError(SignatureVerificationError)
    .addError(SlackApiError)
)

// =============================================================================
// Commands Group - /slack/commands
// =============================================================================

const CommandsGroup = HttpApiGroup.make("commands").add(
  HttpApiEndpoint.post("handleCommand", "/slack/commands")
    .setPayload(SlashCommandPayload.pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" })))
    .addSuccess(SlashCommandResponse)
    .addError(SignatureVerificationError)
    .addError(SlackApiError)
)

// =============================================================================
// Health Group - /health
// =============================================================================

const HealthGroup = HttpApiGroup.make("health", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health").addSuccess(HealthResponse)
)

// =============================================================================
// Top-Level API
// =============================================================================

export class SlackBotApi extends HttpApi.make("SlackBotApi")
  .add(EventsGroup)
  .add(CommandsGroup)
  .add(HealthGroup) {}
