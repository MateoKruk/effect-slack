import { toPascalCase, safeMethodName, uniqueMethodVarName } from "./helpers.js"
/**
 * Pure code generation functions for the code generator
 */
import type { MethodInfo, NamespaceInfo, GeneratedMethod, GeneratedFile } from "./types.js"

/**
 * Generate code for a single method implementation
 */
export const generateMethodCode = (
  method: MethodInfo,
  clientPath: string,
  spanName: string,
  varName: string
): string => {
  const argsParam = method.isOptionalArgs ? `args?: ${method.argsType}` : `args: ${method.argsType}`

  const deprecatedJsDoc = method.deprecated ? "    /** @deprecated */\n" : ""
  const descriptionJsDoc = method.description
    ? `    /**\n     * ${method.description}${method.deprecated ? "\n     * @deprecated" : ""}\n     */\n`
    : deprecatedJsDoc

  return `${descriptionJsDoc}    const ${varName} = (
      ${argsParam}
    ): Effect.Effect<${method.responseType}, SlackError> =>
      Effect.tryPromise({
        try: () => ${clientPath}(${method.isOptionalArgs ? "args" : "args"}),
        catch: mapSlackError
      }).pipe(
        Effect.tapError(annotateSpanWithError),
        Effect.withSpan("${spanName}", {
          attributes: { "slack.method": "${method.apiPath}" }
        })
      )`
}

/**
 * Result of generating methods for a namespace
 */
interface NamespaceMethodsResult {
  readonly implementations: readonly GeneratedMethod[]
  readonly subNamespaceResults: ReadonlyMap<string, NamespaceMethodsResult>
}

/**
 * Generate methods for a namespace recursively
 */
export const generateNamespaceMethods = (
  namespace: NamespaceInfo,
  clientBasePath: string,
  spanNamePrefix: string,
  varNamePath: readonly string[]
): NamespaceMethodsResult => {
  const implementations: GeneratedMethod[] = []
  const subNamespaceResults = new Map<string, NamespaceMethodsResult>()

  // Generate methods for this namespace
  for (const method of namespace.methods) {
    const clientPath = `client.${clientBasePath}.${method.name}`
    const spanName = `${spanNamePrefix}.${safeMethodName(method.name)}`
    const varName = uniqueMethodVarName(varNamePath, method.name)

    implementations.push({
      implementation: generateMethodCode(method, clientPath, spanName, varName),
      varName,
      exportName: safeMethodName(method.name)
    })
  }

  // Generate nested sub-namespaces
  for (const subNs of namespace.subNamespaces) {
    const result = generateNamespaceMethods(
      subNs,
      `${clientBasePath}.${subNs.name}`,
      `${spanNamePrefix}.${subNs.name}`,
      [...varNamePath, subNs.name]
    )
    subNamespaceResults.set(subNs.name, result)
  }

  return { implementations, subNamespaceResults }
}

/**
 * Build the return object structure from generated methods
 */
export const buildReturnObject = (
  methods: readonly GeneratedMethod[],
  subNamespaces: ReadonlyMap<string, NamespaceMethodsResult>,
  indent: string
): string => {
  const parts: string[] = []

  // Add direct methods
  for (const m of methods) {
    if (m.exportName === m.varName) {
      parts.push(`${indent}${m.exportName}`)
    } else {
      parts.push(`${indent}${m.exportName}: ${m.varName}`)
    }
  }

  // Add nested namespaces
  for (const [nsName, nsResult] of subNamespaces) {
    const nestedObj = buildReturnObject(
      nsResult.implementations,
      nsResult.subNamespaceResults,
      indent + "  "
    )
    parts.push(`${indent}${nsName}: {\n${nestedObj}\n${indent}}`)
  }

  return parts.join(",\n")
}

/**
 * Collect all implementations from nested structure
 */
export const collectAllImplementations = (
  result: NamespaceMethodsResult
): readonly GeneratedMethod[] => {
  const all: GeneratedMethod[] = [...result.implementations]
  for (const subResult of result.subNamespaceResults.values()) {
    all.push(...collectAllImplementations(subResult))
  }
  return all
}

/**
 * Collect all types used in a namespace (for imports)
 */
const collectTypes = (
  namespace: NamespaceInfo
): { argTypes: Set<string>; responseTypes: Set<string> } => {
  const argTypes = new Set<string>()
  const responseTypes = new Set<string>()

  const collect = (ns: NamespaceInfo): void => {
    for (const method of ns.methods) {
      argTypes.add(method.argsType)
      responseTypes.add(method.responseType)
    }
    for (const subNs of ns.subNamespaces) {
      collect(subNs)
    }
  }

  collect(namespace)
  return { argTypes, responseTypes }
}

/**
 * Generate a complete service file for a namespace
 */
export const generateServiceFile = (namespace: NamespaceInfo): string => {
  const serviceName = `${toPascalCase(namespace.name)}Service`

  // Generate all methods
  const result = generateNamespaceMethods(namespace, namespace.name, serviceName, [])

  // Collect all implementations
  const allImplementations = collectAllImplementations(result)

  // Collect all import types
  const { argTypes, responseTypes } = collectTypes(namespace)

  // Build the return object
  const returnObj = buildReturnObject(result.implementations, result.subNamespaceResults, "      ")

  // Combine and dedupe types for cleaner imports
  const allTypes = new Set([...argTypes, ...responseTypes])
  const sortedAllTypes = [...allTypes].sort()

  return `/**
 * Generated Slack ${toPascalCase(namespace.name)} Service
 * DO NOT EDIT - This file is auto-generated by scripts/generate-services.ts
 */

import { Effect } from "effect"
import type {
  ${sortedAllTypes.join(",\n  ")}
} from "@slack/web-api"
import { SlackClient } from "../SlackClient.js"
import { mapSlackError, annotateSpanWithError, type SlackError } from "../internal/errors.js"

export class ${serviceName} extends Effect.Service<${serviceName}>()("effect-slack/${serviceName}", {
  effect: Effect.gen(function* () {
    const client = yield* SlackClient

${allImplementations.map((m) => m.implementation).join("\n\n")}

    return {
${returnObj}
    } as const
  }),
  dependencies: [SlackClient.Default]
}) {}
`
}

/**
 * Generate the barrel export index file
 */
export const generateIndexFile = (namespaces: readonly NamespaceInfo[]): string => {
  const exports = namespaces.map((ns) => {
    const serviceName = `${toPascalCase(ns.name)}Service`
    return `export { ${serviceName} } from "./${serviceName}.js"`
  })

  return `/**
 * Generated Slack Services
 * DO NOT EDIT - This file is auto-generated by scripts/generate-services.ts
 */

${exports.join("\n")}
`
}

/**
 * Generate all files for a set of namespaces
 */
export const generateAllFiles = (
  namespaces: readonly NamespaceInfo[]
): readonly GeneratedFile[] => {
  const files: GeneratedFile[] = []

  for (const namespace of namespaces) {
    const serviceName = `${toPascalCase(namespace.name)}Service`
    files.push({
      filename: `${serviceName}.ts`,
      content: generateServiceFile(namespace)
    })
  }

  files.push({
    filename: "index.ts",
    content: generateIndexFile(namespaces)
  })

  return files
}
