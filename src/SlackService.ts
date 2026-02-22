import {
  type ChatPostMessageArguments,
  type ChatUpdateArguments,
  type ChatDeleteArguments,
  type ConversationsListArguments,
  type ConversationsInfoArguments,
  type UsersListArguments,
  type UsersInfoArguments,
  type ReactionsAddArguments,
  type ReactionsRemoveArguments,
  type FilesUploadV2Arguments,
  type ChatPostMessageResponse,
  type ChatUpdateResponse,
  type ChatDeleteResponse,
  type ConversationsListResponse,
  type ConversationsInfoResponse,
  type UsersListResponse,
  type UsersInfoResponse,
  type ReactionsAddResponse,
  type ReactionsRemoveResponse,
  type FilesUploadResponse,
  type WebAPICallResult
} from "@slack/web-api"
import { Effect, Layer, type ConfigError } from "effect"

import { mapSlackError, annotateSpanWithError, type SlackError } from "./internal/errors.js"
import { SlackClient } from "./SlackClient.js"
import { SlackConfig } from "./SlackConfig.js"

/**
 * SlackService - Effect-native Slack Web API client
 */
export class SlackService extends Effect.Service<SlackService>()("effect-slack/SlackService", {
  effect: Effect.gen(function* () {
    const client = yield* SlackClient

    // === Chat Methods ===

    const postMessage = (
      args: ChatPostMessageArguments
    ): Effect.Effect<ChatPostMessageResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.chat.postMessage(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.postMessage", {
          attributes: {
            "slack.channel": args.channel,
            "slack.method": "chat.postMessage"
          }
        })
      )

    const updateMessage = (
      args: ChatUpdateArguments
    ): Effect.Effect<ChatUpdateResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.chat.update(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.updateMessage", {
          attributes: {
            "slack.channel": args.channel,
            "slack.ts": args.ts,
            "slack.method": "chat.update"
          }
        })
      )

    const deleteMessage = (
      args: ChatDeleteArguments
    ): Effect.Effect<ChatDeleteResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.chat.delete(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.deleteMessage", {
          attributes: {
            "slack.channel": args.channel,
            "slack.ts": args.ts,
            "slack.method": "chat.delete"
          }
        })
      )

    // === Conversations Methods ===

    const listConversations = (
      args?: ConversationsListArguments
    ): Effect.Effect<ConversationsListResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.conversations.list(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.listConversations", {
          attributes: { "slack.method": "conversations.list" }
        })
      )

    const getConversationInfo = (
      args: ConversationsInfoArguments
    ): Effect.Effect<ConversationsInfoResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.conversations.info(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.getConversationInfo", {
          attributes: {
            "slack.channel": args.channel,
            "slack.method": "conversations.info"
          }
        })
      )

    // === Users Methods ===

    const listUsers = (args?: UsersListArguments): Effect.Effect<UsersListResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.users.list(args ?? {}),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.listUsers", {
          attributes: { "slack.method": "users.list" }
        })
      )

    const getUserInfo = (args: UsersInfoArguments): Effect.Effect<UsersInfoResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.users.info(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.getUserInfo", {
          attributes: {
            "slack.user": args.user,
            "slack.method": "users.info"
          }
        })
      )

    // === Reactions Methods ===

    const addReaction = (
      args: ReactionsAddArguments
    ): Effect.Effect<ReactionsAddResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.reactions.add(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.addReaction", {
          attributes: {
            "slack.channel": args.channel,
            "slack.reaction": args.name,
            "slack.method": "reactions.add"
          }
        })
      )

    const removeReaction = (
      args: ReactionsRemoveArguments
    ): Effect.Effect<ReactionsRemoveResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.reactions.remove(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.removeReaction", {
          attributes: {
            "slack.reaction": args.name,
            "slack.method": "reactions.remove"
          }
        })
      )

    // === Files Methods ===

    const uploadFile = (
      args: FilesUploadV2Arguments
    ): Effect.Effect<FilesUploadResponse, SlackError> =>
      Effect.tryPromise({
        try: () => client.filesUploadV2(args),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.uploadFile", {
          attributes: { "slack.method": "files.uploadV2" }
        })
      )

    // === Generic API Call ===

    const apiCall = <R extends WebAPICallResult = WebAPICallResult>(
      method: string,
      args?: Record<string, unknown>
    ): Effect.Effect<R, SlackError> =>
      Effect.tryPromise({
        try: () => client.apiCall(method, args) as Promise<R>,
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("SlackService.apiCall", {
          attributes: { "slack.method": method }
        })
      )

    return {
      // Chat
      postMessage,
      updateMessage,
      deleteMessage,
      // Conversations
      listConversations,
      getConversationInfo,
      // Users
      listUsers,
      getUserInfo,
      // Reactions
      addReaction,
      removeReaction,
      // Files
      uploadFile,
      // Generic
      apiCall
    } as const
  }),
  dependencies: [SlackClient.Default]
}) {
  /**
   * Live layer that includes config from environment variables
   */
  static readonly Live: Layer.Layer<SlackService, ConfigError.ConfigError> =
    SlackService.Default.pipe(Layer.provide(SlackConfig.fromEnv))
}
