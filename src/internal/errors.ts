import { ErrorCode } from "@slack/web-api"
import { Effect } from "effect"

import {
  SlackRequestError,
  SlackHttpError,
  SlackPlatformError,
  SlackRateLimitedError,
  SlackFileUploadInvalidArgumentsError,
  SlackFileUploadReadError,
  SlackUnknownError,
  type SlackError
} from "../Errors.js"

/**
 * Type guard for Slack SDK errors
 */
interface SlackSdkError extends Error {
  code: string
  data?: { error?: string; [key: string]: unknown }
  statusCode?: number
  statusMessage?: string
  headers?: Record<string, string>
  body?: unknown
  retryAfter?: number
  original?: Error
}

const isSlackSdkError = (error: unknown): error is SlackSdkError => {
  return (
    error instanceof Error && "code" in error && typeof (error as SlackSdkError).code === "string"
  )
}

/**
 * Map Slack SDK errors to Effect tagged errors
 * Uses the ErrorCode enum from @slack/web-api for type-safe matching
 */
export const mapSlackError = (error: unknown): SlackError => {
  if (!isSlackSdkError(error)) {
    return new SlackUnknownError({
      cause: error,
      message: error instanceof Error ? error.message : String(error)
    })
  }

  switch (error.code) {
    case ErrorCode.RequestError:
      return new SlackRequestError({
        message: error.message,
        cause: error.original
      })

    case ErrorCode.HTTPError:
      return new SlackHttpError({
        statusCode: error.statusCode ?? 0,
        statusMessage: error.statusMessage ?? "Unknown",
        message: error.message,
        body: error.body
      })

    case ErrorCode.PlatformError:
      return new SlackPlatformError({
        error: error.data?.error ?? "unknown_error",
        message: error.message,
        data: error.data
      })

    case ErrorCode.RateLimitedError:
      return new SlackRateLimitedError({
        retryAfter: error.retryAfter ?? 60,
        message: error.message
      })

    case ErrorCode.FileUploadInvalidArgumentsError:
      return new SlackFileUploadInvalidArgumentsError({
        message: error.message,
        data: error.data
      })

    case ErrorCode.FileUploadReadFileDataError:
      return new SlackFileUploadReadError({
        message: error.message,
        cause: error.original
      })

    default:
      return new SlackUnknownError({
        cause: error,
        message: error.message
      })
  }
}

/**
 * Annotate the current span with error details
 */
export const annotateSpanWithError = (error: SlackError): Effect.Effect<void> =>
  Effect.annotateCurrentSpan({
    "error.type": error._tag,
    "slack.error": error._tag === "SlackPlatformError" ? error.error : undefined,
    "http.status_code": error._tag === "SlackHttpError" ? error.statusCode : undefined,
    "slack.retry_after": error._tag === "SlackRateLimitedError" ? error.retryAfter : undefined
  })

export type { SlackError }
