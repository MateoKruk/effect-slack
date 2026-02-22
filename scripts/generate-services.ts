#!/usr/bin/env bun
/**
 * Generates Effect-wrapped Slack API services from @slack/web-api types
 *
 * Usage:
 *   bun scripts/generate-services.ts          # Generate services
 *   bun scripts/generate-services.ts --check  # Check if generated code is up-to-date
 */
import * as path from "node:path"

import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

import { generate, check, createConfig } from "./lib/index.js"

const ROOT_DIR = path.resolve(import.meta.dir, "..")
const config = createConfig(ROOT_DIR)
const isCheck = process.argv.includes("--check")

const program = isCheck ? check(config) : generate(config)

const main = program.pipe(
  Effect.catchTag("GeneratedCodeOutOfDateError", (error) =>
    Effect.gen(function* () {
      console.error("ERROR: Generated code is out of date. methods.d.ts has changed.")
      console.error(`  Expected hash: ${error.expectedHash}`)
      console.error(`  Current hash:  ${error.currentHash}`)
      console.error("Run `bun run generate` to update.")
      yield* Effect.fail(error)
    })
  ),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      console.error("ERROR:", error)
      yield* Effect.fail(error)
    })
  ),
  Effect.provide(NodeFileSystem.layer)
)

NodeRuntime.runMain(main)
