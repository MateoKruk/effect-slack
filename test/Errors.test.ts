import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { assert } from "vitest"

import {
  SlackRequestError,
  SlackHttpError,
  SlackPlatformError,
  SlackRateLimitedError,
  SlackFileUploadInvalidArgumentsError,
  SlackFileUploadReadError,
  SlackUnknownError
} from "../src/index.js"

describe("Slack Errors", () => {
  describe("SlackRequestError", () => {
    it.scoped("should be yieldable with cause", () =>
      Effect.gen(function* () {
        const originalError = new Error("Network failure")
        const error = yield* Effect.flip(
          Effect.fail(
            new SlackRequestError({
              message: "Request failed",
              cause: originalError
            })
          )
        )
        assert.strictEqual(error._tag, "SlackRequestError")
        assert.strictEqual(error.message, "Request failed")
        assert.strictEqual(error.cause, originalError)
      })
    )
  })

  describe("SlackHttpError", () => {
    it.scoped("should contain HTTP response details", () =>
      Effect.gen(function* () {
        const error = new SlackHttpError({
          statusCode: 500,
          statusMessage: "Internal Server Error",
          message: "Server error",
          body: { error: "server_error" }
        })
        assert.strictEqual(error._tag, "SlackHttpError")
        assert.strictEqual(error.statusCode, 500)
        assert.strictEqual(error.statusMessage, "Internal Server Error")
        assert.deepStrictEqual(error.body, { error: "server_error" })
      })
    )
  })

  describe("SlackPlatformError", () => {
    it.scoped("should contain Slack error code", () =>
      Effect.gen(function* () {
        const error = new SlackPlatformError({
          error: "channel_not_found",
          message: "Channel not found",
          data: { ok: false, error: "channel_not_found" }
        })
        assert.strictEqual(error._tag, "SlackPlatformError")
        assert.strictEqual(error.error, "channel_not_found")
      })
    )

    it.scoped("should detect auth errors", () =>
      Effect.gen(function* () {
        const authError = new SlackPlatformError({
          error: "invalid_auth",
          message: "Invalid auth"
        })
        assert.strictEqual(authError.isAuthError, true)

        const notAuthError = new SlackPlatformError({
          error: "channel_not_found",
          message: "Channel not found"
        })
        assert.strictEqual(notAuthError.isAuthError, false)
      })
    )

    it.scoped("should detect all auth error types", () =>
      Effect.gen(function* () {
        const authErrors = [
          "invalid_auth",
          "not_authed",
          "token_revoked",
          "token_expired",
          "account_inactive"
        ]

        for (const errorCode of authErrors) {
          const error = new SlackPlatformError({
            error: errorCode,
            message: `Auth error: ${errorCode}`
          })
          assert.strictEqual(error.isAuthError, true, `Expected ${errorCode} to be an auth error`)
        }
      })
    )
  })

  describe("SlackRateLimitedError", () => {
    it.scoped("should include retry info", () =>
      Effect.gen(function* () {
        const error = new SlackRateLimitedError({
          retryAfter: 30,
          message: "Rate limited"
        })
        assert.strictEqual(error._tag, "SlackRateLimitedError")
        assert.strictEqual(error.retryAfter, 30)
      })
    )
  })

  describe("SlackFileUploadInvalidArgumentsError", () => {
    it.scoped("should contain error details", () =>
      Effect.gen(function* () {
        const error = new SlackFileUploadInvalidArgumentsError({
          message: "Invalid file arguments",
          data: { missing: "filename" }
        })
        assert.strictEqual(error._tag, "SlackFileUploadInvalidArgumentsError")
        assert.deepStrictEqual(error.data, { missing: "filename" })
      })
    )
  })

  describe("SlackFileUploadReadError", () => {
    it.scoped("should contain cause", () =>
      Effect.gen(function* () {
        const originalError = new Error("File not found")
        const error = new SlackFileUploadReadError({
          message: "Failed to read file",
          cause: originalError
        })
        assert.strictEqual(error._tag, "SlackFileUploadReadError")
        assert.strictEqual(error.cause, originalError)
      })
    )
  })

  describe("SlackUnknownError", () => {
    it.scoped("should wrap unknown errors", () =>
      Effect.gen(function* () {
        const originalError = { weird: "error" }
        const error = new SlackUnknownError({
          cause: originalError,
          message: "Unknown error"
        })
        assert.strictEqual(error._tag, "SlackUnknownError")
        assert.deepStrictEqual(error.cause, originalError)
      })
    )
  })

  describe("Error catching", () => {
    it.scoped("errors can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          return yield* new SlackPlatformError({
            error: "invalid_auth",
            message: "Invalid token"
          })
        }).pipe(Effect.catchTag("SlackPlatformError", (e) => Effect.succeed(`Caught: ${e.error}`)))

        const result = yield* program
        assert.strictEqual(result, "Caught: invalid_auth")
      })
    )

    it.scoped("errors can be caught with catchTags", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          return yield* new SlackRateLimitedError({
            retryAfter: 60,
            message: "Too many requests"
          })
        }).pipe(
          Effect.catchTags({
            SlackRateLimitedError: (e) => Effect.succeed(`Retry after ${e.retryAfter}s`),
            SlackPlatformError: (e) => Effect.succeed(`Platform error: ${e.error}`)
          })
        )

        const result = yield* program
        assert.strictEqual(result, "Retry after 60s")
      })
    )
  })
})
