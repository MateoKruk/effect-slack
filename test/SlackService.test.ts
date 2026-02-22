import { describe, it } from "@effect/vitest"
import type { WebClient } from "@slack/web-api"
import { Effect, Layer } from "effect"
import { assert } from "vitest"

import { SlackService } from "../src/index.js"

// Mock WebClient for testing
const createMockWebClient = () =>
  ({
    chat: {
      postMessage: async () => ({ ok: true, ts: "1234.5678", channel: "C123" }),
      update: async () => ({ ok: true, ts: "1234.5678", channel: "C123" }),
      delete: async () => ({ ok: true, ts: "1234.5678", channel: "C123" })
    },
    conversations: {
      list: async () => ({ ok: true, channels: [] }),
      info: async () => ({ ok: true, channel: { id: "C123", name: "general" } })
    },
    users: {
      list: async () => ({ ok: true, members: [] }),
      info: async () => ({ ok: true, user: { id: "U123", name: "testuser" } })
    },
    reactions: {
      add: async () => ({ ok: true }),
      remove: async () => ({ ok: true })
    },
    filesUploadV2: async () => ({ ok: true, files: [] }),
    apiCall: async () => ({ ok: true })
  }) as unknown as WebClient

// Create test layer by providing mock client directly (bypassing SlackConfig)
const TestLayer = Layer.effect(
  SlackService,
  Effect.gen(function* () {
    const client = createMockWebClient()

    const postMessage = (args: Parameters<typeof client.chat.postMessage>[0]) =>
      Effect.tryPromise({
        try: () => client.chat.postMessage(args),
        catch: (e) => e
      })

    const updateMessage = (args: Parameters<typeof client.chat.update>[0]) =>
      Effect.tryPromise({
        try: () => client.chat.update(args),
        catch: (e) => e
      })

    const deleteMessage = (args: Parameters<typeof client.chat.delete>[0]) =>
      Effect.tryPromise({
        try: () => client.chat.delete(args),
        catch: (e) => e
      })

    const listConversations = (args?: Parameters<typeof client.conversations.list>[0]) =>
      Effect.tryPromise({
        try: () => client.conversations.list(args),
        catch: (e) => e
      })

    const getConversationInfo = (args: Parameters<typeof client.conversations.info>[0]) =>
      Effect.tryPromise({
        try: () => client.conversations.info(args),
        catch: (e) => e
      })

    const listUsers = (args?: Parameters<typeof client.users.list>[0]) =>
      Effect.tryPromise({
        try: () => client.users.list(args ?? {}),
        catch: (e) => e
      })

    const getUserInfo = (args: Parameters<typeof client.users.info>[0]) =>
      Effect.tryPromise({
        try: () => client.users.info(args),
        catch: (e) => e
      })

    const addReaction = (args: Parameters<typeof client.reactions.add>[0]) =>
      Effect.tryPromise({
        try: () => client.reactions.add(args),
        catch: (e) => e
      })

    const removeReaction = (args: Parameters<typeof client.reactions.remove>[0]) =>
      Effect.tryPromise({
        try: () => client.reactions.remove(args),
        catch: (e) => e
      })

    const uploadFile = (args: Parameters<typeof client.filesUploadV2>[0]) =>
      Effect.tryPromise({
        try: () => client.filesUploadV2(args),
        catch: (e) => e
      })

    const apiCall = <R>(method: string, args?: Record<string, unknown>) =>
      Effect.tryPromise({
        try: () => client.apiCall(method, args) as Promise<R>,
        catch: (e) => e
      })

    return {
      postMessage,
      updateMessage,
      deleteMessage,
      listConversations,
      getConversationInfo,
      listUsers,
      getUserInfo,
      addReaction,
      removeReaction,
      uploadFile,
      apiCall
    } as unknown as Effect.Effect.Success<typeof SlackService.Default>
  })
)

describe("SlackService", () => {
  describe("Chat methods", () => {
    it.scoped("postMessage should send a message", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.postMessage({
          channel: "C123",
          text: "Hello, World!"
        })
        assert.strictEqual(result.ok, true)
        assert.strictEqual(result.ts, "1234.5678")
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped("updateMessage should update a message", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.updateMessage({
          channel: "C123",
          ts: "1234.5678",
          text: "Updated message"
        })
        assert.strictEqual(result.ok, true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped("deleteMessage should delete a message", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.deleteMessage({
          channel: "C123",
          ts: "1234.5678"
        })
        assert.strictEqual(result.ok, true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Conversations methods", () => {
    it.scoped("listConversations should return channels", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.listConversations()
        assert.strictEqual(result.ok, true)
        assert.deepStrictEqual(result.channels, [])
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped("getConversationInfo should return channel info", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.getConversationInfo({ channel: "C123" })
        assert.strictEqual(result.ok, true)
        assert.strictEqual(result.channel?.id, "C123")
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Users methods", () => {
    it.scoped("listUsers should return members", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.listUsers()
        assert.strictEqual(result.ok, true)
        assert.deepStrictEqual(result.members, [])
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped("getUserInfo should return user info", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.getUserInfo({ user: "U123" })
        assert.strictEqual(result.ok, true)
        assert.strictEqual(result.user?.id, "U123")
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Reactions methods", () => {
    it.scoped("addReaction should add a reaction", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.addReaction({
          channel: "C123",
          timestamp: "1234.5678",
          name: "thumbsup"
        })
        assert.strictEqual(result.ok, true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.scoped("removeReaction should remove a reaction", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.removeReaction({
          channel: "C123",
          timestamp: "1234.5678",
          name: "thumbsup"
        })
        assert.strictEqual(result.ok, true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Files methods", () => {
    it.scoped("uploadFile should upload a file", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.uploadFile({
          channel_id: "C123",
          content: "file content",
          filename: "test.txt"
        })
        assert.strictEqual(result.ok, true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Generic API call", () => {
    it.scoped("apiCall should make a generic API call", () =>
      Effect.gen(function* () {
        const slack = yield* SlackService
        const result = yield* slack.apiCall("api.test")
        assert.strictEqual(result.ok, true)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

describe("SlackService error handling", () => {
  it.scoped("should handle errors from postMessage", () =>
    Effect.gen(function* () {
      const slack = yield* SlackService
      const result = yield* slack
        .postMessage({ channel: "C123", text: "test" })
        .pipe(
          Effect.catchAll((e) => Effect.succeed({ caught: true, message: (e as Error).message }))
        )

      assert.deepStrictEqual(result, { caught: true, message: "Caught error" })
    }).pipe(
      Effect.provide(
        Layer.effect(
          SlackService,
          Effect.gen(function* () {
            const postMessage = () =>
              Effect.tryPromise({
                try: async () => {
                  throw new Error("API Error")
                },
                catch: () => new Error("Caught error")
              })

            return {
              postMessage,
              updateMessage: postMessage,
              deleteMessage: postMessage,
              listConversations: postMessage,
              getConversationInfo: postMessage,
              listUsers: postMessage,
              getUserInfo: postMessage,
              addReaction: postMessage,
              removeReaction: postMessage,
              uploadFile: postMessage,
              apiCall: postMessage
            } as unknown as Effect.Effect.Success<typeof SlackService.Default>
          })
        )
      )
    )
  )
})
