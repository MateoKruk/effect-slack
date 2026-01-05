import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// =============================================================================
// Slack Event Types
// =============================================================================

export class SlackChallenge extends Schema.Class<SlackChallenge>("SlackChallenge")({
  type: Schema.Literal("url_verification"),
  token: Schema.String,
  challenge: Schema.String
}) {}

export class SlackMessageEvent extends Schema.Class<SlackMessageEvent>("SlackMessageEvent")({
  type: Schema.Literal("message"),
  channel: Schema.String,
  user: Schema.String,
  text: Schema.String,
  ts: Schema.String,
  event_ts: Schema.String,
  channel_type: Schema.optional(Schema.String)
}) {}

export class SlackAppMentionEvent extends Schema.Class<SlackAppMentionEvent>("SlackAppMentionEvent")({
  type: Schema.Literal("app_mention"),
  channel: Schema.String,
  user: Schema.String,
  text: Schema.String,
  ts: Schema.String,
  event_ts: Schema.String
}) {}

export const SlackEvent = Schema.Union(SlackMessageEvent, SlackAppMentionEvent)
export type SlackEvent = typeof SlackEvent.Type

export class SlackEventCallback extends Schema.Class<SlackEventCallback>("SlackEventCallback")({
  type: Schema.Literal("event_callback"),
  token: Schema.String,
  team_id: Schema.String,
  api_app_id: Schema.String,
  event: SlackEvent,
  event_id: Schema.String,
  event_time: Schema.Number
}) {}

export const SlackEventPayload = Schema.Union(SlackChallenge, SlackEventCallback)
export type SlackEventPayload = typeof SlackEventPayload.Type

// =============================================================================
// Slash Command Types
// =============================================================================

export class SlashCommandPayload extends Schema.Class<SlashCommandPayload>("SlashCommandPayload")({
  token: Schema.String,
  team_id: Schema.String,
  team_domain: Schema.String,
  channel_id: Schema.String,
  channel_name: Schema.String,
  user_id: Schema.String,
  user_name: Schema.String,
  command: Schema.String,
  text: Schema.String,
  response_url: Schema.String,
  trigger_id: Schema.String
}) {}

// =============================================================================
// Response Types
// =============================================================================

export class ChallengeResponse extends Schema.Class<ChallengeResponse>("ChallengeResponse")({
  challenge: Schema.String
}) {}

export class EventAckResponse extends Schema.Class<EventAckResponse>("EventAckResponse")({}) {}

export class SlashCommandResponse extends Schema.Class<SlashCommandResponse>("SlashCommandResponse")({
  response_type: Schema.optional(Schema.Literal("in_channel", "ephemeral")),
  text: Schema.optional(Schema.String),
  blocks: Schema.optional(Schema.Array(Schema.Unknown))
}) {}

export class HealthResponse extends Schema.Class<HealthResponse>("HealthResponse")({
  status: Schema.Literal("ok")
}) {}

// =============================================================================
// Error Types
// =============================================================================

export class SignatureVerificationError extends Schema.TaggedError<SignatureVerificationError>()(
  "SignatureVerificationError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 401 })
) {}

export class SlackApiError extends Schema.TaggedError<SlackApiError>()(
  "SlackApiError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 500 })
) {}
