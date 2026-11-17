# Interoperability

## Supported SCORM player

Athenemy imports **single-SCO SCORM 1.2 HTML packages**. An instructor uploads the ZIP from a course's Interoperability screen, optionally assigning it to a lesson. The selected organization must have exactly one launchable item; multi-SCO sequencing, SCORM 2004, xAPI ingestion/LRS forwarding, and LTI launches are not implemented. Existing database fields for those standards are not working integrations.

Import validates the manifest and included HTML launch file, then extracts assets into private storage before marking the package READY. Limits: ZIP 20 MB, extracted content 80 MB, individual asset 16 MB, manifest 1 MB, and 1,500 ZIP entries. Asset paths must be relative; external launch URLs and document-type/entity declarations are rejected. The player expects UTF-8 HTML, package-relative assets, and the supported CMI subset below. Packages depending on external services, embedded frames, browser storage, popups, or same-origin access to their parent need adaptation. Test every publisher's export before assigning it to learners; this implementation is not a claim of full SCORM certification.

## Storage and deployment

Set `SCORM_STORAGE_DIR` to an **absolute private directory on a persistent volume**, outside `public/`. Every application instance must mount the same files at that path. Production imports fail closed if the variable is absent. Local development defaults to the ignored `.private/scorm` directory. Files use random package directory identifiers, restrictive permissions, and exclusive writes. Extraction failures remove their partial directory; a failed database registration removes the stored package.

The filesystem adapter targets self-hosted Node deployments. An ephemeral serverless filesystem is unsupported; R2/S3 delivery is not implemented by this adapter. Back up the private volume together with PostgreSQL, verify restore procedures, and monitor capacity. Do not expose the directory through a public web-server location. Database record deletion does not automatically remove historical package files: apply an operator-reviewed retention process that checks database references before deleting files.

Legacy manifest-only registrations have no extracted files and must be imported again. Migration 0018 marks their fabricated `scorm/...` storage keys INVALID; current extracted packages use UUID keys.

## Launch isolation and authorization

Opening the player page does not create a runtime session. The learner explicitly selects **Start package**, which performs an authenticated, same-origin POST. Active/completed enrolment or current course-management permission is required. Each launch creates an eight-hour session and a random scoped asset capability; only its SHA-256 hash is stored. A new launch supersedes the learner's previous launch for that package. Expired sessions are pruned when that learner relaunches.

The iframe uses `sandbox="allow-scripts"`, without `allow-same-origin`. Every asset response also sets a CSP sandbox, including direct HTML navigation, restrictive package-scoped content sources, no-store caching, and no-referrer policy. HTML receives a SCORM API adapter before publisher scripts. Assets use the capability in their URL so relative files work without authenticated cookies inside the opaque sandbox. Asset requests recheck package status, session expiry/current session, and current enrolment or management permission. Revocation therefore affects already-open packages as well as new launches.

Treat asset capabilities as bearer secrets during their short lifetime: redact the token segment of `/api/scorm/content/...` in reverse-proxy/access logs and monitoring. Never publish these URLs or enable shared caching. The parent accepts progress messages only from its current iframe, the opaque origin, and the expected channel/session. The commit endpoint separately requires the authenticated user and matching request origin. The course iframe never receives application credentials.

## Runtime and persistence

The local synchronous `window.API` implements `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, `LMSFinish`, and SCORM error-query methods. Supported writable fields are:

- `cmi.core.lesson_status`, `cmi.core.lesson_location`
- `cmi.core.score.raw`, `.min`, `.max`
- `cmi.core.session_time`, `cmi.core.exit`
- `cmi.suspend_data` (4,096 characters)

Read-only values include learner ID/name, entry/resume state, credit, lesson mode, total time, and supported core/score children. Unsupported CMI elements return error 401; read-only writes return 403. This version does not implement interactions, objectives, preferences, or comments.

API writes update local synchronous state. `LMSCommit`/`LMSFinish` returning `true` means the snapshot was queued to the parent, **not that the database has durably saved it**. The surrounding player shows saving/saved/failure status and offers Retry save. It also queues a snapshot every 30 seconds after initialization and on pagehide; last-second delivery is best effort. Learners should wait for **Progress saved** before leaving. Network errors and expired/replaced sessions remain visible; a replaced/expired session requires a fresh launch.

The authenticated save transaction validates the CMI snapshot, persists bookmark/suspend data, score and status, and advances an ordered sequence. Duplicate/older sequences do not overwrite newer data. Time uses a nondecreasing per-session total and adds only the new whole-second difference to the attempt. Resuming starts a new session with zero session time, preserving prior total time. Multiple tabs cannot overwrite the current session's state.

## Completion rules

All READY SCORM packages attached to a lesson must report `passed` or `completed` before the player completes that lesson. Manual lesson completion cannot bypass this requirement. Course-level packages without a lesson are optional. Importing a new lesson package reopens completed enrolments because it adds a new requirement. A package's later incomplete/failed status clears that lesson's completion and reconciles course status.

Course completion and certificate eligibility require completed lessons, all required assessments, and all required lesson SCORM packages. Cancelled/refunded enrolments cannot save progress. Instructor previews do not create enrolments or learner completion records.

## Verification

`tests/unit/scorm.test.ts` and `tests/unit/scorm-runtime.test.ts` cover manifest selection, private nested asset storage, supported package boundaries, CMI validation and API lifecycle. `tests/integration/scorm.test.ts` exercises real PostgreSQL import, resume, time accounting, duplicate saves, completion gates, revocation and previews against a disposable `_verify` database. `tests/workflows/scorm.spec.ts` exercises instructor upload and learner save/resume/completion through the isolated browser workflow harness; it checks the actual iframe and content response isolation headers.
