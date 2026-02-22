import { describe, it } from "@effect/vitest"
import { Either } from "effect"
import { assert } from "vitest"

import { parseMethodsSource, getJsDocInfo } from "../../scripts/lib/parser.js"

describe("Parser", () => {
  describe("getJsDocInfo", () => {
    it("extracts description from JSDoc comment", () => {
      const fullText = `
        /**
         * @description Posts a message to a channel.
         */
        postMessage`

      const info = getJsDocInfo(fullText)
      assert.strictEqual(info.description, "Posts a message to a channel.")
      assert.isUndefined(info.deprecated)
    })

    it("detects @deprecated tag", () => {
      const fullText = `
        /**
         * @description Old method
         * @deprecated
         */
        oldMethod`

      const info = getJsDocInfo(fullText)
      assert.isTrue(info.deprecated)
    })

    it("handles description with @deprecated", () => {
      const fullText = `
        /**
         * @description This is deprecated.
         * @deprecated Use newMethod instead.
         */
        oldMethod`

      const info = getJsDocInfo(fullText)
      assert.strictEqual(info.description, "This is deprecated.")
      assert.isTrue(info.deprecated)
    })

    it("returns empty object when no JSDoc", () => {
      const fullText = "someProperty"
      const info = getJsDocInfo(fullText)
      assert.isUndefined(info.description)
      assert.isUndefined(info.deprecated)
    })

    it("handles multiline descriptions", () => {
      const fullText = `
        /**
         * @description This is a long description
         * that spans multiple lines.
         */
        method`

      const info = getJsDocInfo(fullText)
      assert.strictEqual(info.description, "This is a long description that spans multiple lines.")
    })
  })

  describe("parseMethodsSource", () => {
    it("parses a simple Methods class", () => {
      const source = `
        type MethodWithRequiredArgument<A, R> = (args: A) => Promise<R>;
        type MethodWithOptionalArgument<A, R> = (args?: A) => Promise<R>;

        export declare class Methods {
          chat: {
            postMessage: MethodWithRequiredArgument<ChatPostMessageArguments, ChatPostMessageResponse>;
            delete: MethodWithRequiredArgument<ChatDeleteArguments, ChatDeleteResponse>;
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        const namespaces = result.right
        assert.strictEqual(namespaces.length, 1)
        assert.strictEqual(namespaces[0].name, "chat")
        assert.strictEqual(namespaces[0].methods.length, 2)
        assert.strictEqual(namespaces[0].methods[0].name, "postMessage")
        assert.strictEqual(namespaces[0].methods[0].apiPath, "chat.postMessage")
        assert.isFalse(namespaces[0].methods[0].isOptionalArgs)
      }
    })

    it("handles MethodWithOptionalArgument", () => {
      const source = `
        type MethodWithOptionalArgument<A, R> = (args?: A) => Promise<R>;

        export declare class Methods {
          users: {
            list: MethodWithOptionalArgument<UsersListArguments, UsersListResponse>;
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        assert.isTrue(result.right[0].methods[0].isOptionalArgs)
      }
    })

    it("parses nested namespaces", () => {
      const source = `
        type MethodWithRequiredArgument<A, R> = (args: A) => Promise<R>;
        type MethodWithOptionalArgument<A, R> = (args?: A) => Promise<R>;

        export declare class Methods {
          chat: {
            postMessage: MethodWithRequiredArgument<A, B>;
            scheduledMessages: {
              list: MethodWithOptionalArgument<C, D>;
            };
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        const chat = result.right[0]
        assert.strictEqual(chat.methods.length, 1)
        assert.strictEqual(chat.subNamespaces.length, 1)
        assert.strictEqual(chat.subNamespaces[0].name, "scheduledMessages")
        assert.strictEqual(chat.subNamespaces[0].methods[0].apiPath, "chat.scheduledMessages.list")
      }
    })

    it("parses deeply nested namespaces", () => {
      const source = `
        type MethodWithRequiredArgument<A, R> = (args: A) => Promise<R>;

        export declare class Methods {
          admin: {
            apps: {
              approved: {
                list: MethodWithRequiredArgument<A, B>;
              };
            };
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        const admin = result.right[0]
        assert.strictEqual(admin.subNamespaces[0].name, "apps")
        assert.strictEqual(admin.subNamespaces[0].subNamespaces[0].name, "approved")
        assert.strictEqual(
          admin.subNamespaces[0].subNamespaces[0].methods[0].apiPath,
          "admin.apps.approved.list"
        )
      }
    })

    it("skips apiCall and filesUploadV2", () => {
      const source = `
        type MethodWithRequiredArgument<A, R> = (args: A) => Promise<R>;

        export declare class Methods {
          apiCall: any;
          filesUploadV2: any;
          chat: {
            postMessage: MethodWithRequiredArgument<A, B>;
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        assert.strictEqual(result.right.length, 1)
        assert.strictEqual(result.right[0].name, "chat")
      }
    })

    it("returns error when Methods class not found", () => {
      const source = `
        export declare class SomethingElse {
          foo: string;
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isLeft(result))

      if (Either.isLeft(result)) {
        assert.strictEqual(result.left._tag, "MethodsClassNotFoundError")
      }
    })

    it("handles multiple namespaces", () => {
      const source = `
        type MethodWithRequiredArgument<A, R> = (args: A) => Promise<R>;
        type MethodWithOptionalArgument<A, R> = (args?: A) => Promise<R>;

        export declare class Methods {
          chat: {
            postMessage: MethodWithRequiredArgument<A, B>;
          };
          users: {
            list: MethodWithOptionalArgument<C, D>;
          };
          reactions: {
            add: MethodWithRequiredArgument<E, F>;
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        assert.strictEqual(result.right.length, 3)
        assert.deepStrictEqual(
          result.right.map((n) => n.name),
          ["chat", "users", "reactions"]
        )
      }
    })

    it("extracts argument and response types", () => {
      const source = `
        type MethodWithRequiredArgument<A, R> = (args: A) => Promise<R>;

        export declare class Methods {
          chat: {
            postMessage: MethodWithRequiredArgument<ChatPostMessageArguments, ChatPostMessageResponse>;
          };
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        const method = result.right[0].methods[0]
        assert.strictEqual(method.argsType, "ChatPostMessageArguments")
        assert.strictEqual(method.responseType, "ChatPostMessageResponse")
      }
    })

    it("handles empty class", () => {
      const source = `
        export declare class Methods {
        }
      `

      const result = parseMethodsSource(source)
      assert.isTrue(Either.isRight(result))

      if (Either.isRight(result)) {
        assert.strictEqual(result.right.length, 0)
      }
    })
  })
})
