/**
 * Effect-based orchestration for the code generator
 */
import * as path from "node:path"

import { FileSystem } from "@effect/platform"
import { Effect, Console, Either } from "effect"

import { generateAllFiles } from "./codegen.js"
import {
  MethodsFileNotFoundError,
  GeneratedCodeOutOfDateError,
  MetadataNotFoundError,
  WriteFileError,
  PackageJsonNotFoundError
} from "./errors.js"
import { countMethods, computeHash } from "./helpers.js"
import { parseMethodsSource } from "./parser.js"
import type { GeneratorConfig, Metadata } from "./types.js"

/**
 * Read a file's contents using FileSystem service
 */
const readFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(filePath)
    return content
  }).pipe(Effect.mapError(() => new MethodsFileNotFoundError({ path: filePath })))

/**
 * Read Slack Web API package.json to get version
 */
const readSlackVersion = (rootDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pkgPath = path.join(rootDir, "node_modules/@slack/web-api/package.json")
    const content = yield* fs.readFileString(pkgPath)
    const pkg = JSON.parse(content)
    return pkg.version as string
  }).pipe(
    Effect.mapError(
      () =>
        new PackageJsonNotFoundError({
          path: path.join(rootDir, "node_modules/@slack/web-api/package.json")
        })
    )
  )

/**
 * Read existing metadata file
 */
const readMetadata = (metadataPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(metadataPath)
    return JSON.parse(content) as Metadata
  }).pipe(Effect.mapError(() => new MetadataNotFoundError({ path: metadataPath })))

/**
 * Write a file using FileSystem service
 */
const writeFile = (filePath: string, content: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString(filePath, content)
  }).pipe(Effect.mapError((error) => new WriteFileError({ path: filePath, cause: error })))

/**
 * Ensure directory exists
 */
const ensureDir = (dirPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(dirPath, { recursive: true })
  }).pipe(Effect.mapError((error) => new WriteFileError({ path: dirPath, cause: error })))

/**
 * Parse namespaces from methods file content
 */
const parseNamespaces = (content: string) => {
  const result = parseMethodsSource(content)
  return Either.isRight(result) ? Effect.succeed(result.right) : Effect.fail(result.left)
}

/**
 * Check if generated code is up-to-date
 */
export const check = (config: GeneratorConfig) =>
  Effect.gen(function* () {
    yield* Console.log("Checking if generated code is up-to-date...")

    // Read methods file and compute hash
    const methodsContent = yield* readFile(config.methodsFilePath)
    const currentHash = computeHash(methodsContent)

    // Read existing metadata
    const existingMetadata = yield* readMetadata(config.metadataFilePath)

    // Compare hashes
    if (existingMetadata.methodsFileHash !== currentHash) {
      yield* Effect.fail(
        new GeneratedCodeOutOfDateError({
          expectedHash: existingMetadata.methodsFileHash,
          currentHash
        })
      )
    }

    yield* Console.log("Generated code is up-to-date!")
  })

/**
 * Generate all service files
 */
export const generate = (config: GeneratorConfig) =>
  Effect.gen(function* () {
    // Read Slack version
    const slackVersion = yield* readSlackVersion(config.rootDir)

    // Read and parse methods file
    yield* Console.log("Parsing @slack/web-api methods.d.ts...")
    const methodsContent = yield* readFile(config.methodsFilePath)
    const namespaces = yield* parseNamespaces(methodsContent)
    const methodCount = countMethods(namespaces)

    yield* Console.log(`Found ${namespaces.length} namespaces with ${methodCount} methods`)

    // Compute hash for metadata
    const methodsHash = computeHash(methodsContent)

    // Generate all files
    yield* Console.log("Generating services...")
    const files = generateAllFiles(namespaces)

    // Ensure output directory exists
    yield* ensureDir(config.generatedDir)

    // Write all generated files
    for (const file of files) {
      const filePath = path.join(config.generatedDir, file.filename)
      yield* writeFile(filePath, file.content)
      yield* Console.log(`  Generated ${file.filename}`)
    }

    // Create and write metadata
    const metadata: Metadata = {
      generatedAt: new Date().toISOString(),
      slackWebApiVersion: slackVersion,
      methodsFileHash: methodsHash,
      methodCount
    }

    yield* writeFile(config.metadataFilePath, JSON.stringify(metadata, null, 2))
    yield* Console.log("  Generated _metadata.json")

    yield* Console.log(
      `\nDone! Generated ${namespaces.length} services with ${methodCount} methods.`
    )
    yield* Console.log(`Slack Web API version: ${slackVersion}`)

    return {
      namespaceCount: namespaces.length,
      methodCount,
      slackVersion
    }
  })

/**
 * Create default config from root directory
 */
export const createConfig = (rootDir: string): GeneratorConfig => {
  const generatedDir = path.join(rootDir, "src/generated")
  return {
    rootDir,
    methodsFilePath: path.join(rootDir, "node_modules/@slack/web-api/dist/methods.d.ts"),
    generatedDir,
    metadataFilePath: path.join(generatedDir, "_metadata.json")
  }
}
