# Cache Implementation Plan (Temporary)

Status: draft for next session
Date: 2026-03-18

## Goal

Reduce waiting time in active class workflow by using session cache:
- attendance panel
- student panel
- solution panel

Assumptions:
- No stale-while-revalidate.
- Show explicit loading placeholder: "Laduję dane...".
- Manual reload button is available in each panel.
- Cache can be cleared when user goes back to course/group level.

## Scope Decisions

1. Read path:
- Cache-first.
- If cache exists: use it.
- If cache is empty: fetch from Moodle and store.

2. Write path:
- Write-through.
- Any user action update (attendance, solution grading parts) updates:
  - Moodle API
  - local cache (immediate UI consistency)

3. UX:
- No background refresh while showing old data.
- During fetch, show placeholder only.

## Proposed Architecture

### A. DataCacheService (in-memory, session-only)

Add service: `src/app/service/data-cache.service.ts`

Core API:
- `get<T>(key: string): T | undefined`
- `set<T>(key: string, value: T): void`
- `has(key: string): boolean`
- `delete(key: string): void`
- `clearByPrefix(prefix: string): void`
- `clearAll(): void`

Suggested cache keys:
- `students:${moodleUrl}:${courseId}:${groupId}`
- `attendance:${moodleUrl}:${classDateId}`
- `tasks:${moodleUrl}:${courseId}`
- `solutions:${moodleUrl}:${courseId}:${studentId}`
- `solution:${moodleUrl}:${studentId}:${taskId}`

### B. In-flight request deduplication

In `ApplicationDataService`, maintain map of in-flight requests by key.
If the same resource is requested while fetch is running, return the same observable.
Remove key when request completes/errors.

## Implementation Plan

### Stage 1 - Foundation (cache + loading)

Implement:
- `DataCacheService`
- Cache-first for:
  - `getStudents(groupId)`
  - `getAttendancesForClassDate(classDateId)`
  - `getTasks(courseId)`
  - `getSolutionsForStudentInCourse(studentId, courseId)`
- Add loading signals/placeholders in panels:
  - attendance
  - student
  - solution

Acceptance:
- First open fetches from Moodle and shows "Laduję dane...".
- Returning between panels in same session reuses cache.
- No duplicated requests for same key during concurrent UI reads.

### Stage 2 - Write-through consistency

Implement:
- On `updateAttendance(...)`: update attendance cache immediately after successful write.
- On `updateSolution(...)`: update single solution cache and list cache for that student/course.

Acceptance:
- After save, all relevant views are coherent without manual reload.
- On write error, do not leave false-success state in cache.

### Stage 3 - Reload button and invalidation

Implement:
- Add reload button (icon: circular arrow) next to Info in footer.
- Each panel reload clears only relevant cache scope and refetches.
- Clear full session cache when navigating back to course/group level.
- Clear cache when Moodle URL changes.

Acceptance:
- Reload always forces Moodle fetch.
- Normal navigation uses cache.
- Entering groups/courses resets session cache.

### Stage 4 - Hardening and docs

Implement:
- Minimal dev diagnostics (cache hit/miss counters).
- Update `MOODLE_DATA_FLOW.md` with cache keys and invalidation rules.

Acceptance:
- Behavior is documented and safe for future refactors.

## Notes for Next Session

Start with Stage 1 only (smallest risk).
Recommended first files:
- `src/app/service/data-cache.service.ts` (new)
- `src/app/service/application-data.service.ts`
- panel files for loading placeholders

Avoid introducing persistence storage for cache in first iteration.
Keep cache session-only in memory.
