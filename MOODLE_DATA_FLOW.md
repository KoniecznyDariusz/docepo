# Moodle Data Flow and Integration Notes

This document describes how data is fetched from Moodle, merged in the app, and written back.
Use it as the first reference when changing API calls, parsing logic, or UI mapping.

## Scope

- App workspace: docepo
- Main orchestration service: src/app/service/application-data.service.ts
- Moodle API wrapper service: src/app/service/moodle.service.ts

## Read Flow (Solution loading)

Entry point for student solutions:
1. getSolutionsForStudentInCourse(studentId, courseId)
2. loadSolutionsFromMoodle(studentId, courseId)

Read sequence:
1. Read Moodle URL from storage.
2. Load tasks for the course (required before solution mapping):
   - getTasks(courseId)
   - loadTasksFromMoodle(courseId)
3. In loadTasksFromMoodle, fetch in parallel:
   - visible assign modules (visibility/availability filtering)
   - mod_assign_get_assignments
4. Build Task list (assignment id, max points, due date, parsed short name).
5. For assignment ids from tasks, fetch in parallel:
   - mod_assign_get_submissions
   - mod_assign_get_grades
   - mod_assign_get_submission_status
   - mod_assign_get_participant (optional fallback; usually disabled when no permissions)
6. Merge all sources into Solution objects.
7. Cache merged solutions in memory.

## Endpoint -> Data Mapping

### Tasks

Source:
- mod_assign_get_assignments

Mapped to Task:
- id <- assignment.id
- courseId <- requested course id
- name <- parsed from assignment name prefix
- description <- parsed suffix or full assignment name
- maxPoints <- assignment.grade (fallback 100)
- dueDate <- assignment.duedate

### Solutions

Sources:
- mod_assign_get_submissions
- mod_assign_get_grades
- mod_assign_get_submission_status
- mod_assign_get_participant (fallback)

Mapped to Solution:
- id <- studentId:assignmentId
- studentId <- requested student
- taskId <- assignmentId
- completedAt <- submission.timemodified or submission.timecreated
- points <- grades.assignments[].grades[].grade for matching userid
- status <- parsed from first line State: X
- comment <- parsed comment body (without first State line)

Attempt number tracking:
- solutionAttemptNumberByKey[studentId:assignmentId] <- submission.attemptnumber
- Used later for mod_assign_save_grade variants.

## Attendance Panel Navigation Note (important)

In attendance list rendering, initial student positioning is intentionally applied in two phases:
1. Initial position right after student list load (selected from URL, otherwise first student).
2. One additional reposition after attendance statuses are fetched and applied.

Why this exists:
- Applying statuses updates the student list model and can reset scroll/snap position in some browsers.
- The second reposition keeps focus on the selected student after that model update.

Implementation reference:
- src/app/component/attendance/student-list.component.ts

Do not remove this behavior unless replacing it with an equivalent mechanism that preserves return-to-selected behavior.

## Student List Role Filtering

Student list is built from `core_enrol_get_enrolled_users`, then filtered by role metadata when available.

Current behavior:
1. Keep users assigned to the selected group (`groupId`) when possible.
2. If role metadata is present (`user.roles`), include only student-like roles.
3. Exclude teacher/non-student roles (e.g. teacher, editingteacher, manager, admin, owner, and local language equivalents).
4. If role metadata is missing in response, keep fallback behavior (no role-based exclusion) to avoid dropping all users.

Why this exists:
- Attendance and grading panels should target learners only.
- Teachers/owners enrolled in the course should not appear in the student list.

Implementation references:
- `src/app/service/application-data.service.ts` (`getStudents`, role normalization and filters)
- `src/app/model/moodle/moodle-core.model.ts` (`MoodleEnrolledUserResponse.roles`)

## Comment Source Priority

Current priority when selecting raw comment text:
1. submission_status
2. submission
3. grades_feedbackplugins
4. participant

Notes:
- The selected source is logged as selectedCommentSource.
- Parser expects first line format: State: <token>.
- Remaining lines become comment body.
- HTML line breaks are normalized to plain text before parsing.

## Write Flow (Saving solution)

Entry point:
1. updateSolution(studentId, taskId, updates)

Write sequence:
1. Validate solution exists in local cache.
2. Clamp points to [0, task.maxPoints] if max points is known.
3. Build Moodle comment:
   - first line: State: <status>
   - next lines: user comment
   - converted to HTML-safe format
4. Read attempt number for studentId:taskId from solutionAttemptNumberByKey.
5. Call modAssignSaveGradeWithVariants with:
   - assignmentId
   - studentId
   - points
   - composed comment
   - attemptNumber
6. Save method tries multiple parameter variants until one succeeds.
7. On success, local solution state is updated in memory.

## Error Handling and Feature Flags

Behavior currently used:
- If mod_assign_get_grades returns access-control error for a course:
  - course id is stored in gradesAccessDeniedByCourseId
  - next reads for that course skip grades call
- If mod_assign_get_submission_status returns accessexception:
  - canUseAssignSubmissionStatusApi is set to false
  - future calls are skipped
- If mod_assign_get_participant returns accessexception:
  - canUseAssignParticipantApi is set to false
  - future calls are skipped

Policy:
- No silent fallback to synthetic/local fake values when API data is expected.
- Missing API values are logged with warnings.

## Logging Guide

Important debug logs:
- [Moodle API][Assignments Debug]
- [Moodle API][Grades JSON]
- [Moodle API][Comment Read JSON]

Fields to inspect first in Comment Read JSON:
- submissionStatusPayload
- rawSubmissionStatusComment
- selectedCommentSource
- rawComment
- parsedStatus
- parsedComment

## Typical Change Scenarios

### Moodle changes submission_status payload

Actions:
1. Check Comment Read JSON for new location of feedback text.
2. Update extractSubmissionComment traversal rules.
3. Keep parser contract (State in first line) stable if possible.
4. Re-test with at least one graded and one notgraded assignment.

### Moodle changes grade payload

Actions:
1. Verify grades.assignments[].grades[] shape.
2. Update mapping for points extraction.
3. Keep No grades found warnings visible for diagnostics.

### Need to change source priority

Actions:
1. Update commentCandidates order in loadSolutionsFromMoodle.
2. Keep selectedCommentSource in logs during validation.
3. Remove or reduce verbose logs after validation.

## Quick Validation Checklist

Use this after integration changes:
1. Graded assignment:
   - points loaded
   - status parsed from State line
   - comment body excludes State line
2. Not graded assignment:
   - no points
   - no comment/status
   - warning behavior is expected
3. Save flow:
   - save call succeeds
   - new comment can be read back
   - state round-trip works
4. Regression:
   - task list still filters by visibility and availability
   - no crash when one endpoint is unavailable

## Maintenance Recommendation

When a major Moodle update is deployed:
1. Keep verbose JSON logs enabled temporarily.
2. Capture one full graded and one notgraded payload.
3. Update this document with observed payload diffs.
4. Then reduce logs back to normal level.
