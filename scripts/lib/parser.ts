import { Either } from "effect"
/**
 * Pure TypeScript AST parsing for the code generator
 */
import * as ts from "typescript"

import { MethodsClassNotFoundError } from "./errors.js"
import type { MethodInfo, NamespaceInfo, JsDocInfo } from "./types.js"

/**
 * Extract JSDoc information from a TypeScript node's full text
 */
export const getJsDocInfo = (fullText: string): JsDocInfo => {
  const commentMatch = fullText.match(/\/\*\*[\s\S]*?\*\//)

  if (!commentMatch) {
    return {}
  }

  const comment = commentMatch[0]
  const result: { description?: string; deprecated?: boolean } = {}

  // Extract @description - capture until next @ tag, end of comment, or newline followed by *
  const descMatch = comment.match(/@description\s+([\s\S]*?)(?=\n\s*\*\s*@|\*\/)/s)
  if (descMatch) {
    // Clean up: remove leading/trailing whitespace, asterisks, and normalize spaces
    result.description = descMatch[1]
      .replace(/\s*\*\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  // Check for @deprecated
  if (comment.includes("@deprecated")) {
    result.deprecated = true
  }

  return result
}

/**
 * Parse a TypeScript source string into NamespaceInfo array
 * Returns Either to allow for parsing errors
 */
export const parseMethodsSource = (
  source: string,
  filename = "methods.d.ts"
): Either.Either<readonly NamespaceInfo[], MethodsClassNotFoundError> => {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)

  const namespaces: NamespaceInfo[] = []
  let foundMethodsClass = false

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === "Methods") {
      foundMethodsClass = true

      node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          const name = member.name.text
          // Skip apiCall and filesUploadV2 as they're abstract methods
          if (name !== "apiCall" && name !== "filesUploadV2") {
            const namespace = parseNamespace(member, name, name)
            if (namespace) {
              namespaces.push(namespace)
            }
          }
        }
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!foundMethodsClass) {
    return Either.left(
      new MethodsClassNotFoundError({
        message: "Could not find 'Methods' class in source"
      })
    )
  }

  return Either.right(namespaces)
}

/**
 * Parse a property declaration into a NamespaceInfo
 */
const parseNamespace = (
  member: ts.PropertyDeclaration,
  name: string,
  apiPathPrefix: string
): NamespaceInfo | null => {
  const typeNode = member.type
  if (!typeNode || !ts.isTypeLiteralNode(typeNode)) {
    return null
  }

  const methods: MethodInfo[] = []
  const subNamespaces: NamespaceInfo[] = []

  typeNode.members.forEach((typeMember) => {
    if (ts.isPropertySignature(typeMember) && typeMember.name && ts.isIdentifier(typeMember.name)) {
      const memberName = typeMember.name.text
      const memberType = typeMember.type

      if (memberType) {
        if (ts.isTypeReferenceNode(memberType)) {
          const typeText = memberType.getText()
          const isRequired = typeText.startsWith("MethodWithRequiredArgument")
          const isOptional = typeText.startsWith("MethodWithOptionalArgument")

          if ((isRequired || isOptional) && memberType.typeArguments?.length === 2) {
            const argsType = memberType.typeArguments[0].getText()
            const responseType = memberType.typeArguments[1].getText()
            const apiPath = `${apiPathPrefix}.${memberName}`
            const jsDoc = getJsDocInfo(typeMember.getFullText())

            methods.push({
              name: memberName,
              apiPath,
              argsType,
              responseType,
              isOptionalArgs: isOptional,
              description: jsDoc.description,
              deprecated: jsDoc.deprecated
            })
          }
        } else if (ts.isTypeLiteralNode(memberType)) {
          const subNamespace = parseSubNamespace(
            memberType,
            memberName,
            `${apiPathPrefix}.${memberName}`
          )
          if (subNamespace) {
            subNamespaces.push(subNamespace)
          }
        }
      }
    }
  })

  return {
    name,
    methods,
    subNamespaces
  }
}

/**
 * Parse a nested type literal into a sub-namespace
 */
const parseSubNamespace = (
  typeNode: ts.TypeLiteralNode,
  name: string,
  apiPathPrefix: string
): NamespaceInfo | null => {
  const methods: MethodInfo[] = []
  const subNamespaces: NamespaceInfo[] = []

  typeNode.members.forEach((member) => {
    if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
      const memberName = member.name.text
      const memberType = member.type

      if (memberType) {
        if (ts.isTypeReferenceNode(memberType)) {
          const typeText = memberType.getText()
          const isRequired = typeText.startsWith("MethodWithRequiredArgument")
          const isOptional = typeText.startsWith("MethodWithOptionalArgument")

          if ((isRequired || isOptional) && memberType.typeArguments?.length === 2) {
            const argsType = memberType.typeArguments[0].getText()
            const responseType = memberType.typeArguments[1].getText()
            const apiPath = `${apiPathPrefix}.${memberName}`
            const jsDoc = getJsDocInfo(member.getFullText())

            methods.push({
              name: memberName,
              apiPath,
              argsType,
              responseType,
              isOptionalArgs: isOptional,
              description: jsDoc.description,
              deprecated: jsDoc.deprecated
            })
          }
        } else if (ts.isTypeLiteralNode(memberType)) {
          const subNamespace = parseSubNamespace(
            memberType,
            memberName,
            `${apiPathPrefix}.${memberName}`
          )
          if (subNamespace) {
            subNamespaces.push(subNamespace)
          }
        }
      }
    }
  })

  if (methods.length === 0 && subNamespaces.length === 0) {
    return null
  }

  return {
    name,
    methods,
    subNamespaces
  }
}
