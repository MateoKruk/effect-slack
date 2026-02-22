import { describe, it } from "@effect/vitest"
import { assert } from "vitest"

import {
  generateMethodCode,
  generateNamespaceMethods,
  buildReturnObject,
  collectAllImplementations,
  generateServiceFile,
  generateIndexFile,
  generateAllFiles
} from "../../scripts/lib/codegen.js"
import type { MethodInfo, NamespaceInfo } from "../../scripts/lib/types.js"

describe("Codegen", () => {
  describe("generateMethodCode", () => {
    it("generates code for required args method", () => {
      const method: MethodInfo = {
        name: "postMessage",
        apiPath: "chat.postMessage",
        argsType: "ChatPostMessageArguments",
        responseType: "ChatPostMessageResponse",
        isOptionalArgs: false
      }

      const code = generateMethodCode(
        method,
        "client.chat.postMessage",
        "ChatService.postMessage",
        "postMessage"
      )

      assert.include(code, "const postMessage = (")
      assert.include(code, "args: ChatPostMessageArguments")
      assert.include(code, "Effect.Effect<ChatPostMessageResponse, SlackError>")
      assert.include(code, 'Effect.withSpan("ChatService.postMessage"')
      assert.include(code, '"slack.method": "chat.postMessage"')
    })

    it("generates code for optional args method", () => {
      const method: MethodInfo = {
        name: "list",
        apiPath: "users.list",
        argsType: "UsersListArguments",
        responseType: "UsersListResponse",
        isOptionalArgs: true
      }

      const code = generateMethodCode(method, "client.users.list", "UsersService.list", "list")

      assert.include(code, "args?: UsersListArguments")
    })

    it("includes JSDoc for deprecated methods", () => {
      const method: MethodInfo = {
        name: "oldMethod",
        apiPath: "test.oldMethod",
        argsType: "Args",
        responseType: "Response",
        isOptionalArgs: false,
        deprecated: true
      }

      const code = generateMethodCode(
        method,
        "client.test.oldMethod",
        "TestService.oldMethod",
        "oldMethod"
      )

      assert.include(code, "/** @deprecated */")
    })

    it("includes description in JSDoc", () => {
      const method: MethodInfo = {
        name: "postMessage",
        apiPath: "chat.postMessage",
        argsType: "Args",
        responseType: "Response",
        isOptionalArgs: false,
        description: "Posts a message to a channel."
      }

      const code = generateMethodCode(
        method,
        "client.chat.postMessage",
        "ChatService.postMessage",
        "postMessage"
      )

      assert.include(code, "/**")
      assert.include(code, "Posts a message to a channel.")
      assert.include(code, "*/")
    })

    it("includes both description and deprecated in JSDoc", () => {
      const method: MethodInfo = {
        name: "oldMethod",
        apiPath: "test.oldMethod",
        argsType: "Args",
        responseType: "Response",
        isOptionalArgs: false,
        description: "Old method description.",
        deprecated: true
      }

      const code = generateMethodCode(
        method,
        "client.test.oldMethod",
        "TestService.oldMethod",
        "oldMethod"
      )

      assert.include(code, "Old method description.")
      assert.include(code, "@deprecated")
    })
  })

  describe("generateNamespaceMethods", () => {
    it("generates methods for flat namespace", () => {
      const namespace: NamespaceInfo = {
        name: "chat",
        methods: [
          {
            name: "postMessage",
            apiPath: "chat.postMessage",
            argsType: "A",
            responseType: "B",
            isOptionalArgs: false
          },
          {
            name: "update",
            apiPath: "chat.update",
            argsType: "C",
            responseType: "D",
            isOptionalArgs: false
          }
        ],
        subNamespaces: []
      }

      const result = generateNamespaceMethods(namespace, "chat", "ChatService", [])

      assert.strictEqual(result.implementations.length, 2)
      assert.strictEqual(result.implementations[0].varName, "postMessage")
      assert.strictEqual(result.implementations[0].exportName, "postMessage")
      assert.strictEqual(result.implementations[1].varName, "update")
    })

    it("generates methods for nested namespace", () => {
      const namespace: NamespaceInfo = {
        name: "chat",
        methods: [
          {
            name: "postMessage",
            apiPath: "chat.postMessage",
            argsType: "A",
            responseType: "B",
            isOptionalArgs: false
          }
        ],
        subNamespaces: [
          {
            name: "scheduledMessages",
            methods: [
              {
                name: "list",
                apiPath: "chat.scheduledMessages.list",
                argsType: "C",
                responseType: "D",
                isOptionalArgs: true
              }
            ],
            subNamespaces: []
          }
        ]
      }

      const result = generateNamespaceMethods(namespace, "chat", "ChatService", [])

      assert.strictEqual(result.implementations.length, 1)
      assert.strictEqual(result.subNamespaceResults.size, 1)

      const subResult = result.subNamespaceResults.get("scheduledMessages")
      assert.isDefined(subResult)
      assert.strictEqual(subResult!.implementations.length, 1)
      assert.strictEqual(subResult!.implementations[0].varName, "ScheduledMessagesList")
    })

    it("handles reserved words in method names", () => {
      const namespace: NamespaceInfo = {
        name: "chat",
        methods: [
          {
            name: "delete",
            apiPath: "chat.delete",
            argsType: "A",
            responseType: "B",
            isOptionalArgs: false
          }
        ],
        subNamespaces: []
      }

      const result = generateNamespaceMethods(namespace, "chat", "ChatService", [])

      assert.strictEqual(result.implementations[0].varName, "delete_")
      assert.strictEqual(result.implementations[0].exportName, "delete_")
    })
  })

  describe("buildReturnObject", () => {
    it("builds simple return object", () => {
      const methods = [
        { implementation: "", varName: "postMessage", exportName: "postMessage" },
        { implementation: "", varName: "update", exportName: "update" }
      ]

      const result = buildReturnObject(methods, new Map(), "  ")

      assert.include(result, "  postMessage")
      assert.include(result, "  update")
    })

    it("builds return object with different var and export names", () => {
      const methods = [{ implementation: "", varName: "delete_", exportName: "delete_" }]

      const result = buildReturnObject(methods, new Map(), "  ")

      assert.include(result, "  delete_")
    })

    it("builds nested return object", () => {
      const methods = [{ implementation: "", varName: "postMessage", exportName: "postMessage" }]
      const subNamespaces = new Map([
        [
          "scheduledMessages",
          {
            implementations: [
              { implementation: "", varName: "ScheduledMessagesList", exportName: "list" }
            ],
            subNamespaceResults: new Map()
          }
        ]
      ])

      const result = buildReturnObject(methods, subNamespaces, "  ")

      assert.include(result, "  postMessage")
      assert.include(result, "  scheduledMessages: {")
      assert.include(result, "list: ScheduledMessagesList")
    })
  })

  describe("collectAllImplementations", () => {
    it("collects implementations from flat structure", () => {
      const result = {
        implementations: [
          { implementation: "code1", varName: "a", exportName: "a" },
          { implementation: "code2", varName: "b", exportName: "b" }
        ],
        subNamespaceResults: new Map()
      }

      const all = collectAllImplementations(result)
      assert.strictEqual(all.length, 2)
    })

    it("collects implementations from nested structure", () => {
      const result = {
        implementations: [{ implementation: "code1", varName: "a", exportName: "a" }],
        subNamespaceResults: new Map([
          [
            "sub",
            {
              implementations: [
                { implementation: "code2", varName: "b", exportName: "b" },
                { implementation: "code3", varName: "c", exportName: "c" }
              ],
              subNamespaceResults: new Map()
            }
          ]
        ])
      }

      const all = collectAllImplementations(result)
      assert.strictEqual(all.length, 3)
    })
  })

  describe("generateServiceFile", () => {
    it("generates complete service file", () => {
      const namespace: NamespaceInfo = {
        name: "chat",
        methods: [
          {
            name: "postMessage",
            apiPath: "chat.postMessage",
            argsType: "ChatPostMessageArguments",
            responseType: "ChatPostMessageResponse",
            isOptionalArgs: false
          }
        ],
        subNamespaces: []
      }

      const content = generateServiceFile(namespace)

      assert.include(content, "Generated Slack Chat Service")
      assert.include(content, "DO NOT EDIT")
      assert.include(content, 'import { Effect } from "effect"')
      assert.include(content, "ChatPostMessageArguments")
      assert.include(content, "ChatPostMessageResponse")
      assert.include(content, 'import { SlackClient } from "../SlackClient.js"')
      assert.include(content, "export class ChatService extends Effect.Service<ChatService>()")
      assert.include(content, '"effect-slack/ChatService"')
      assert.include(content, "const client = yield* SlackClient")
      assert.include(content, "return {")
      assert.include(content, "postMessage")
      assert.include(content, "} as const")
      assert.include(content, "dependencies: [SlackClient.Default]")
    })

    it("generates service with nested namespaces", () => {
      const namespace: NamespaceInfo = {
        name: "chat",
        methods: [
          {
            name: "postMessage",
            apiPath: "chat.postMessage",
            argsType: "A",
            responseType: "B",
            isOptionalArgs: false
          }
        ],
        subNamespaces: [
          {
            name: "scheduledMessages",
            methods: [
              {
                name: "list",
                apiPath: "chat.scheduledMessages.list",
                argsType: "C",
                responseType: "D",
                isOptionalArgs: true
              }
            ],
            subNamespaces: []
          }
        ]
      }

      const content = generateServiceFile(namespace)

      assert.include(content, "scheduledMessages: {")
      assert.include(content, "list: ScheduledMessagesList")
    })

    it("sorts import types alphabetically", () => {
      const namespace: NamespaceInfo = {
        name: "test",
        methods: [
          {
            name: "z",
            apiPath: "test.z",
            argsType: "ZArgs",
            responseType: "ZResponse",
            isOptionalArgs: false
          },
          {
            name: "a",
            apiPath: "test.a",
            argsType: "AArgs",
            responseType: "AResponse",
            isOptionalArgs: false
          }
        ],
        subNamespaces: []
      }

      const content = generateServiceFile(namespace)

      const importSection =
        content.match(/import type \{[\s\S]*?\} from "@slack\/web-api"/)?.[0] || ""
      const aIndex = importSection.indexOf("AArgs")
      const zIndex = importSection.indexOf("ZArgs")
      assert.isTrue(aIndex < zIndex, "Types should be sorted alphabetically")
    })
  })

  describe("generateIndexFile", () => {
    it("generates barrel export file", () => {
      const namespaces: NamespaceInfo[] = [
        { name: "chat", methods: [], subNamespaces: [] },
        { name: "users", methods: [], subNamespaces: [] },
        { name: "reactions", methods: [], subNamespaces: [] }
      ]

      const content = generateIndexFile(namespaces)

      assert.include(content, "Generated Slack Services")
      assert.include(content, "DO NOT EDIT")
      assert.include(content, 'export { ChatService } from "./ChatService.js"')
      assert.include(content, 'export { UsersService } from "./UsersService.js"')
      assert.include(content, 'export { ReactionsService } from "./ReactionsService.js"')
    })
  })

  describe("generateAllFiles", () => {
    it("generates all service files plus index", () => {
      const namespaces: NamespaceInfo[] = [
        {
          name: "chat",
          methods: [
            {
              name: "post",
              apiPath: "chat.post",
              argsType: "A",
              responseType: "B",
              isOptionalArgs: false
            }
          ],
          subNamespaces: []
        },
        {
          name: "users",
          methods: [
            {
              name: "list",
              apiPath: "users.list",
              argsType: "C",
              responseType: "D",
              isOptionalArgs: true
            }
          ],
          subNamespaces: []
        }
      ]

      const files = generateAllFiles(namespaces)

      assert.strictEqual(files.length, 3)
      assert.strictEqual(files[0].filename, "ChatService.ts")
      assert.strictEqual(files[1].filename, "UsersService.ts")
      assert.strictEqual(files[2].filename, "index.ts")
    })

    it("returns empty array with just index for empty namespaces", () => {
      const files = generateAllFiles([])

      assert.strictEqual(files.length, 1)
      assert.strictEqual(files[0].filename, "index.ts")
    })
  })
})
