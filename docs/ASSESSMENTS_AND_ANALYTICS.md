# Assessment attempts and reporting

Learners start an assessment explicitly. Its attempt number, server start time, deadline and submission identity are persisted. Starting again resumes the same unfinished attempt, including after a page refresh. Answers are submitted with the form; unsubmitted answers are not saved across refreshes.

A time limit applies to new attempts. A configured closing time also caps their deadline, and moving the closing time earlier immediately closes existing attempts. Closing times are entered as ISO timestamps with an explicit timezone, for example `2026-12-01T17:00:00+11:00`; the learner page displays UTC.

The countdown submits answers approximately two seconds before the deadline to allow ordinary network latency. The server decides whether a submission arrived in time. Unanswered questions receive no credit. Expired attempts are consumed and receive zero credit, including when the browser was closed or offline. A learner returning to an expired attempt records that result before starting another permitted attempt. Duplicate submissions with the same attempt identity return the existing outcome. An untimed submission without an attempt ID remains supported for compatibility with earlier clients; new forms always send the saved attempt ID.

Feedback settings control the displayed result:

- **Immediate:** display the latest score and pass/fail result after submission.
- **After passing:** display the result when that submission passed.
- **After close:** require a closing time and display the result only once server time reaches it.
- **Hidden:** withhold the displayed result.

Completion and certificate eligibility still use actual passing submissions. A feedback policy does not postpone completion, so learners can infer a passing result from completed course requirements. Correct-answer indexes are never passed to the learner's client form.

Public and organization catalogues show 24 courses per page with search retained across pages. Instructor analytics also show 24 course rows per page, while summary totals aggregate the entire authorized course scope. Stable secondary ordering prevents ties in update times from duplicating or dropping rows across unchanged pages.

Revenue totals are separated by currency. Paid amounts have recorded partial refunds deducted; fully refunded and disputed payments are excluded. No foreign-exchange conversion or mixed-currency total is implied. Lesson-completion counts are aggregated in PostgreSQL rather than loading every lesson or progress record into the application.

The focused verification suite uses an isolated database ending in `_verify`. It covers concurrent starts/submissions, server expiry, revoked enrollment, scheduled visibility, tenant boundaries, pagination across 58 fixture courses, complete summary totals, and partial/full refunds in multiple currencies.
