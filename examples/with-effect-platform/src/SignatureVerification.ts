import { Effect, Redacted } from "effect"
import { HttpServerRequest } from "@effect/platform"
import { createHmac, timingSafeEqual } from "crypto"
import { AppConfig } from "./Config.js"
import { SignatureVerificationError } from "./Schemas.js"

const MAX_REQUEST_AGE_SECONDS = 300 // 5 minutes

export const verifySlackSignature = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const config = yield* AppConfig

  const timestamp = request.headers["x-slack-request-timestamp"]
  const signature = request.headers["x-slack-signature"]

  if (!timestamp || !signature) {
    return yield* new SignatureVerificationError({
      message: "Missing signature headers"
    })
  }

  // Check timestamp is within 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000)
  const requestTime = Number(timestamp)

  if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_REQUEST_AGE_SECONDS) {
    return yield* new SignatureVerificationError({
      message: "Request timestamp too old or invalid"
    })
  }

  // Get raw body for signature verification
  const body = yield* request.text

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${body}`
  const signingSecret = Redacted.value(config.signingSecret)
  const expectedSignature =
    "v0=" + createHmac("sha256", signingSecret).update(sigBasestring).digest("hex")

  // Compare signatures using timing-safe comparison
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return yield* new SignatureVerificationError({
      message: "Invalid signature"
    })
  }

  // Return the parsed body for use in handlers
  return body
}).pipe(Effect.withSpan("verifySlackSignature"))
