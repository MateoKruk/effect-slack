import { describe, it } from "@effect/vitest"
import { Effect, Schedule } from "effect"
import { assert } from "vitest"

import {
  SlackRequestError,
  SlackHttpError,
  SlackPlatformError,
  SlackRateLimitedError,
  SlackFileUploadInvalidArgumentsError,
  SlackFileUploadReadError,
  SlackUnknownError,
  isRetryableError,
  tenRetriesInAboutThirtyMinutes,
  fiveRetriesInFiveMinutes,
  rapidRetryPolicy,
  rateLimitAwareSchedule,
  withDefaultRetry,
  withRateLimitRetry,
  withRateLimitOnlyRetry,
  Schedules
} from "../src/index.js"

describe("Retry utilities", () => {
  describe("isRetryableError", () => {
    it.scoped("SlackRateLimitedError is retryable", () =>
      Effect.gen(function* () {
        const error = new SlackRateLimitedError({ retryAfter: 30, message: "Rate limited" })
        assert.strictEqual(isRetryableError(error), true)
      })
    )

    it.scoped("SlackRequestError is retryable", () =>
      Effect.gen(function* () {
        const error = new SlackRequestError({ message: "Network error" })
        assert.strictEqual(isRetryableError(error), true)
      })
    )

    it.scoped("SlackHttpError 5xx is retryable", () =>
      Effect.gen(function* () {
        const error500 = new SlackHttpError({
          statusCode: 500,
          statusMessage: "Internal Server Error",
          message: "Server error"
        })
        assert.strictEqual(isRetryableError(error500), true)

        const error503 = new SlackHttpError({
          statusCode: 503,
          statusMessage: "Service Unavailable",
          message: "Service unavailable"
        })
        assert.strictEqual(isRetryableError(error503), true)
      })
    )

    it.scoped("SlackHttpError 4xx is NOT retryable", () =>
      Effect.gen(function* () {
        const error400 = new SlackHttpError({
          statusCode: 400,
          statusMessage: "Bad Request",
          message: "Bad request"
        })
        assert.strictEqual(isRetryableError(error400), false)

        const error404 = new SlackHttpError({
          statusCode: 404,
          statusMessage: "Not Found",
          message: "Not found"
        })
        assert.strictEqual(isRetryableError(error404), false)
      })
    )

    it.scoped("SlackPlatformError service_unavailable is retryable", () =>
      Effect.gen(function* () {
        const error = new SlackPlatformError({
          error: "service_unavailable",
          message: "Service unavailable"
        })
        assert.strictEqual(isRetryableError(error), true)
      })
    )

    it.scoped("SlackPlatformError internal_error is retryable", () =>
      Effect.gen(function* () {
        const error = new SlackPlatformError({
          error: "internal_error",
          message: "Internal error"
        })
        assert.strictEqual(isRetryableError(error), true)
      })
    )

    it.scoped("SlackPlatformError auth errors are NOT retryable", () =>
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
          assert.strictEqual(
            isRetryableError(error),
            false,
            `Expected ${errorCode} to NOT be retryable`
          )
        }
      })
    )

    it.scoped("SlackPlatformError other errors are NOT retryable", () =>
      Effect.gen(function* () {
        const error = new SlackPlatformError({
          error: "channel_not_found",
          message: "Channel not found"
        })
        assert.strictEqual(isRetryableError(error), false)
      })
    )

    it.scoped("SlackFileUploadInvalidArgumentsError is NOT retryable", () =>
      Effect.gen(function* () {
        const error = new SlackFileUploadInvalidArgumentsError({ message: "Invalid args" })
        assert.strictEqual(isRetryableError(error), false)
      })
    )

    it.scoped("SlackFileUploadReadError is NOT retryable", () =>
      Effect.gen(function* () {
        const error = new SlackFileUploadReadError({ message: "Read error" })
        assert.strictEqual(isRetryableError(error), false)
      })
    )

    it.scoped("SlackUnknownError is NOT retryable", () =>
      Effect.gen(function* () {
        const error = new SlackUnknownError({ message: "Unknown", cause: new Error("unknown") })
        assert.strictEqual(isRetryableError(error), false)
      })
    )
  })

  describe("Pre-built schedules", () => {
    it.scoped("tenRetriesInAboutThirtyMinutes is a valid schedule", () =>
      Effect.gen(function* () {
        assert.ok(Schedule.isSchedule(tenRetriesInAboutThirtyMinutes))
      })
    )

    it.scoped("fiveRetriesInFiveMinutes is a valid schedule", () =>
      Effect.gen(function* () {
        assert.ok(Schedule.isSchedule(fiveRetriesInFiveMinutes))
      })
    )

    it.scoped("rapidRetryPolicy is a valid schedule", () =>
      Effect.gen(function* () {
        assert.ok(Schedule.isSchedule(rapidRetryPolicy))
      })
    )

    it.scoped("rateLimitAwareSchedule returns a valid schedule", () =>
      Effect.gen(function* () {
        const schedule = rateLimitAwareSchedule()
        assert.ok(Schedule.isSchedule(schedule))
      })
    )

    it.scoped("rateLimitAwareSchedule accepts options", () =>
      Effect.gen(function* () {
        const schedule = rateLimitAwareSchedule({ maxRetries: 3, baseDelay: "500 millis" })
        assert.ok(Schedule.isSchedule(schedule))
      })
    )

    it.scoped("Schedules namespace exports all schedules", () =>
      Effect.gen(function* () {
        assert.ok(Schedule.isSchedule(Schedules.tenRetriesInAboutThirtyMinutes))
        assert.ok(Schedule.isSchedule(Schedules.fiveRetriesInFiveMinutes))
        assert.ok(Schedule.isSchedule(Schedules.rapidRetryPolicy))
        assert.ok(Schedule.isSchedule(Schedules.rateLimitAwareSchedule()))
      })
    )
  })

  describe("Retry helpers", () => {
    it.scoped("withDefaultRetry is a function", () =>
      Effect.gen(function* () {
        assert.strictEqual(typeof withDefaultRetry, "function")
      })
    )

    it.scoped("withRateLimitRetry is a function", () =>
      Effect.gen(function* () {
        assert.strictEqual(typeof withRateLimitRetry, "function")
      })
    )

    it.scoped("withRateLimitOnlyRetry does not retry non-rate-limit errors", () =>
      Effect.gen(function* () {
        let attempts = 0
        const makeEffect = () =>
          Effect.suspend(() => {
            attempts++
            return Effect.fail(new SlackRequestError({ message: "Network error" }))
          })

        const result = yield* withRateLimitOnlyRetry(makeEffect(), { maxRetries: 3 }).pipe(
          Effect.either
        )
        assert.ok(result._tag === "Left")
        assert.strictEqual(attempts, 1) // Should not retry network errors
      })
    )
  })
})
