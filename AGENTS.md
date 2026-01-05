# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Commands

```bash
bun run build          # Compile TypeScript
bun run dev            # Watch mode compilation
bun run test           # Run all tests
bunx vitest run <pat>  # Run tests matching pattern
bun run typecheck      # Type check without emit
bun run lint           # Lint with oxlint
bun run lint:fix       # Fix lint issues
bun run format         # Format with oxfmt
bun run format:check   # Check formatting
bun run generate       # Regenerate services from @slack/web-api types
bun run generate:check # Verify generated code is up-to-date
```

## Architecture

Effect-native Slack SDK wrapping `@slack/web-api` with typed errors, retry policies, and OpenTelemetry instrumentation.

### Core Files

- `src/SlackService.ts` - Main service with essential methods (postMessage, listUsers, etc.)
- `src/SlackConfig.ts` - Configuration via Effect Context.Tag, token stored as `Redacted<string>`
- `src/SlackClient.ts` - WebClient wrapper for dependency injection
- `src/Errors.ts` - 7 tagged error types using `Schema.TaggedError`
- `src/Retry.ts` - Pre-built retry schedules and helpers

### Generated Services

`src/generated/` contains 33 auto-generated services (272 methods total). Each service wraps WebClient methods with:

- `Effect.tryPromise` for Promise-to-Effect conversion
- `mapSlackError` for typed error mapping
- `Effect.withSpan` for OpenTelemetry tracing

Run `bun run generate` after updating `@slack/web-api` to regenerate.

### Code Generation

`scripts/` contains the generation system:

- `generate-services.ts` - Entry point
- `lib/parser.ts` - Extracts method signatures from @slack/web-api types
- `lib/generator.ts` - Creates Effect service files
- `lib/codegen.ts` - Code generation templates

## Key Patterns

**Effect Service pattern**: Services extend `Effect.Service<T>()` with `.Default` and `.Live` layer constructors.

**Tagged errors**: Use `catchTag`/`catchTags` for exhaustive error handling:

```typescript
Effect.catchTags({
  SlackRateLimitedError: (e) => ...,
  SlackPlatformError: (e) => ...,
})
```

**Dependency injection**: Mock `SlackClient` for testing via `SlackClient.make(mockWebClient)`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

## Release Process

Uses [Changesets](https://github.com/changesets/changesets) with automated GitHub Actions.

1. Create changeset: `bun run changeset` (select patch/minor/major, write description)
2. Commit changeset file and merge PR to main
3. GitHub Actions creates "chore: version packages" PR with version bump and CHANGELOG update
4. Merge version PR → automatically publishes to npm

Key files:

- `.changeset/config.json` - Changesets config (public access, GitHub changelog)
- `.github/workflows/release.yml` - Automated release workflow
