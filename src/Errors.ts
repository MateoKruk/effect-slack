import { ErrorCode } from "@slack/web-api"
import { Schema } from "effect"

/**
 * Re-export ErrorCode for consumers to use in type guards
 */
export { ErrorCode }

/**
 * Request error - network failures, DNS errors, etc.
 * Maps to: slack_webapi_request_error
 */
export class SlackRequestError extends Schema.TaggedError<SlackRequestError>()(
  "SlackRequestError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect)
  }
) {}

/**
 * HTTP error - non-200 responses from Slack API
 * Maps to: slack_webapi_http_error
 */
export class SlackHttpError extends Schema.TaggedError<SlackHttpError>()("SlackHttpError", {
  statusCode: Schema.Number,
  statusMessage: Schema.String,
  message: Schema.String,
  body: Schema.optional(Schema.Unknown)
}) {}

/**
 * Platform error - Slack API returned an error response
 * Maps to: slack_webapi_platform_error
 *
 * The `error` field contains the Slack error code (e.g., "channel_not_found", "invalid_auth")
 */
export class SlackPlatformError extends Schema.TaggedError<SlackPlatformError>()(
  "SlackPlatformError",
  {
    error: Schema.String,
    message: Schema.String,
    data: Schema.optional(Schema.Unknown)
  }
) {
  /**
   * Check if this is an authentication error
   */
  get isAuthError(): boolean {
    return (
      this.error === "invalid_auth" ||
      this.error === "not_authed" ||
      this.error === "token_revoked" ||
      this.error === "token_expired" ||
      this.error === "account_inactive"
    )
  }
}

/**
 * Rate limited error - too many requests
 * Maps to: slack_webapi_rate_limited_error
 */
export class SlackRateLimitedError extends Schema.TaggedError<SlackRateLimitedError>()(
  "SlackRateLimitedError",
  {
    retryAfter: Schema.Number,
    message: Schema.String
  }
) {}

/**
 * File upload error - invalid arguments for file upload
 * Maps to: slack_webapi_file_upload_invalid_args_error
 */
export class SlackFileUploadInvalidArgumentsError extends Schema.TaggedError<SlackFileUploadInvalidArgumentsError>()(
  "SlackFileUploadInvalidArgumentsError",
  {
    message: Schema.String,
    data: Schema.optional(Schema.Unknown)
  }
) {}

/**
 * File upload read error - failed to read file data
 * Maps to: slack_webapi_file_upload_read_file_data_error
 */
export class SlackFileUploadReadError extends Schema.TaggedError<SlackFileUploadReadError>()(
  "SlackFileUploadReadError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect)
  }
) {}

/**
 * Unknown error - catch-all for unexpected errors
 */
export class SlackUnknownError extends Schema.TaggedError<SlackUnknownError>()(
  "SlackUnknownError",
  {
    message: Schema.String,
    cause: Schema.Defect
  }
) {}

/**
 * Union type of all Slack errors for exhaustive handling
 */
export type SlackError =
  | SlackRequestError
  | SlackHttpError
  | SlackPlatformError
  | SlackRateLimitedError
  | SlackFileUploadInvalidArgumentsError
  | SlackFileUploadReadError
  | SlackUnknownError
