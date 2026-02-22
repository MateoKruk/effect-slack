import { describe, it } from "@effect/vitest"
import { assert } from "vitest"

import {
  toPascalCase,
  safeMethodName,
  uniqueMethodVarName,
  countMethods,
  computeHash,
  RESERVED_WORDS
} from "../../scripts/lib/helpers.js"
import type { NamespaceInfo } from "../../scripts/lib/types.js"

describe("Generator Helpers", () => {
  describe("toPascalCase", () => {
    it("converts simple words", () => {
      assert.strictEqual(toPascalCase("chat"), "Chat")
      assert.strictEqual(toPascalCase("admin"), "Admin")
      assert.strictEqual(toPascalCase("users"), "Users")
    })

    it("handles dot-separated paths", () => {
      assert.strictEqual(toPascalCase("chat.postMessage"), "ChatPostMessage")
      assert.strictEqual(toPascalCase("admin.apps.list"), "AdminAppsList")
    })

    it("handles underscore-separated names", () => {
      assert.strictEqual(toPascalCase("slack_lists"), "SlackLists")
      assert.strictEqual(toPascalCase("post_message"), "PostMessage")
    })

    it("handles kebab-case names", () => {
      assert.strictEqual(toPascalCase("post-message"), "PostMessage")
      assert.strictEqual(toPascalCase("user-groups"), "UserGroups")
    })

    it("handles mixed separators", () => {
      assert.strictEqual(toPascalCase("admin.apps_approved.list"), "AdminAppsApprovedList")
    })

    it("handles single character parts", () => {
      assert.strictEqual(toPascalCase("a.b.c"), "ABC")
    })
  })

  describe("safeMethodName", () => {
    it("returns name unchanged if not reserved", () => {
      assert.strictEqual(safeMethodName("postMessage"), "postMessage")
      assert.strictEqual(safeMethodName("list"), "list")
      assert.strictEqual(safeMethodName("create"), "create")
    })

    it("appends underscore to reserved words", () => {
      assert.strictEqual(safeMethodName("delete"), "delete_")
      assert.strictEqual(safeMethodName("import"), "import_")
      assert.strictEqual(safeMethodName("export"), "export_")
      assert.strictEqual(safeMethodName("default"), "default_")
      assert.strictEqual(safeMethodName("class"), "class_")
      assert.strictEqual(safeMethodName("function"), "function_")
      assert.strictEqual(safeMethodName("return"), "return_")
    })
  })

  describe("uniqueMethodVarName", () => {
    it("returns safe name when no namespace path", () => {
      assert.strictEqual(uniqueMethodVarName([], "postMessage"), "postMessage")
      assert.strictEqual(uniqueMethodVarName([], "list"), "list")
    })

    it("handles reserved words with no namespace", () => {
      assert.strictEqual(uniqueMethodVarName([], "delete"), "delete_")
    })

    it("prefixes with single namespace", () => {
      assert.strictEqual(
        uniqueMethodVarName(["scheduledMessages"], "list"),
        "ScheduledMessagesList"
      )
    })

    it("prefixes with multiple namespaces", () => {
      assert.strictEqual(uniqueMethodVarName(["apps", "approved"], "list"), "AppsApprovedList")
    })

    it("handles reserved words in nested paths", () => {
      assert.strictEqual(uniqueMethodVarName(["permissions"], "delete"), "PermissionsDelete_")
    })
  })

  describe("countMethods", () => {
    it("returns 0 for empty namespaces", () => {
      assert.strictEqual(countMethods([]), 0)
    })

    it("counts methods in flat namespace", () => {
      const ns: NamespaceInfo = {
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
            argsType: "A",
            responseType: "B",
            isOptionalArgs: false
          },
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
      assert.strictEqual(countMethods([ns]), 3)
    })

    it("counts methods in nested namespaces", () => {
      const ns: NamespaceInfo = {
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
                argsType: "A",
                responseType: "B",
                isOptionalArgs: true
              },
              {
                name: "create",
                apiPath: "chat.scheduledMessages.create",
                argsType: "A",
                responseType: "B",
                isOptionalArgs: false
              }
            ],
            subNamespaces: []
          }
        ]
      }
      assert.strictEqual(countMethods([ns]), 3)
    })

    it("counts across multiple top-level namespaces", () => {
      const namespaces: NamespaceInfo[] = [
        {
          name: "chat",
          methods: [
            { name: "a", apiPath: "a", argsType: "A", responseType: "B", isOptionalArgs: false }
          ],
          subNamespaces: []
        },
        {
          name: "users",
          methods: [
            { name: "b", apiPath: "b", argsType: "A", responseType: "B", isOptionalArgs: false },
            { name: "c", apiPath: "c", argsType: "A", responseType: "B", isOptionalArgs: false }
          ],
          subNamespaces: []
        }
      ]
      assert.strictEqual(countMethods(namespaces), 3)
    })
  })

  describe("computeHash", () => {
    it("computes consistent SHA256 hash", () => {
      const content = "hello world"
      const hash1 = computeHash(content)
      const hash2 = computeHash(content)
      assert.strictEqual(hash1, hash2)
    })

    it("returns different hashes for different content", () => {
      const hash1 = computeHash("hello")
      const hash2 = computeHash("world")
      assert.notStrictEqual(hash1, hash2)
    })

    it("returns 64-character hex string", () => {
      const hash = computeHash("test")
      assert.strictEqual(hash.length, 64)
      assert.match(hash, /^[a-f0-9]+$/)
    })
  })

  describe("RESERVED_WORDS", () => {
    it("contains expected JavaScript reserved words", () => {
      assert.isTrue(RESERVED_WORDS.has("delete"))
      assert.isTrue(RESERVED_WORDS.has("import"))
      assert.isTrue(RESERVED_WORDS.has("export"))
      assert.isTrue(RESERVED_WORDS.has("class"))
      assert.isTrue(RESERVED_WORDS.has("function"))
      assert.isTrue(RESERVED_WORDS.has("return"))
      assert.isTrue(RESERVED_WORDS.has("default"))
    })

    it("does not contain non-reserved words", () => {
      assert.isFalse(RESERVED_WORDS.has("list"))
      assert.isFalse(RESERVED_WORDS.has("postMessage"))
      assert.isFalse(RESERVED_WORDS.has("create"))
      assert.isFalse(RESERVED_WORDS.has("update"))
    })
  })
})
