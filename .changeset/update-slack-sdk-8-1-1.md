---
"effect-slack": major
---

Update @slack/web-api from 7.18.0 to 8.1.1

Breaking changes from regenerating the service wrappers:

- Removed `RtmService.start`, `FilesService.upload` and `WorkflowsService.stepCompleted` / `stepFailed` / `updateStep` (deprecated upstream)
- Added `AgentsService`, `BlocksService` and `AdminService.usersGetExpiration`
- Minimum supported Node version is now 20, matching `@slack/web-api` 8
