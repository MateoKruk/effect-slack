import * as fs from "node:fs"
import * as path from "node:path"

import { Either } from "effect"
import { describe, it, expect } from "vitest"

import { generateServiceFile, generateIndexFile } from "../../scripts/lib/codegen.js"
import { parseMethodsSource } from "../../scripts/lib/parser.js"

const GENERATED_DIR = path.join(process.cwd(), "src/generated")
const METHODS_PATH = path.join(process.cwd(), "node_modules/@slack/web-api/dist/methods.d.ts")

// Parse real Slack methods.d.ts once for all tests
const methodsSource = fs.readFileSync(METHODS_PATH, "utf-8")
const parseResult = parseMethodsSource(methodsSource)
const namespaces = Either.getOrThrow(parseResult)

const readCommitted = (filename: string) =>
  fs.readFileSync(path.join(GENERATED_DIR, filename), "utf-8")

const getNamespace = (name: string) => {
  const ns = namespaces.find((ns) => ns.name === name)
  if (!ns) throw new Error(`Namespace "${name}" not found`)
  return ns
}

describe("Generator Output Validation", () => {
  describe("Service Files", () => {
    it("ChatService.ts matches committed file", () => {
      const generated = generateServiceFile(getNamespace("chat"))
      const committed = readCommitted("ChatService.ts")
      expect(generated).toBe(committed)
    })

    it("UsersService.ts matches committed file", () => {
      const generated = generateServiceFile(getNamespace("users"))
      const committed = readCommitted("UsersService.ts")
      expect(generated).toBe(committed)
    })

    it("AdminService.ts matches committed file", () => {
      const generated = generateServiceFile(getNamespace("admin"))
      const committed = readCommitted("AdminService.ts")
      expect(generated).toBe(committed)
    })

    it("ReactionsService.ts matches committed file", () => {
      const generated = generateServiceFile(getNamespace("reactions"))
      const committed = readCommitted("ReactionsService.ts")
      expect(generated).toBe(committed)
    })
  })

  describe("Index File", () => {
    it("index.ts matches committed file", () => {
      const generated = generateIndexFile(namespaces)
      const committed = readCommitted("index.ts")
      expect(generated).toBe(committed)
    })
  })
})
