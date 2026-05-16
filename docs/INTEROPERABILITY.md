# Interoperability Foundation

Athenemy now has the first database and UI layer for standards-based learning content.

## SCORM 1.2

- Admins can register a SCORM 1.2 `.zip` from the course interoperability page.
- The upload path parses `imsmanifest.xml`, stores title, identifier, version, launch path, and manifest resource metadata.
- Packages can be attached at course level or to a specific lesson.
- Learner launch checks course enrollment or course management rights before creating an attempt row.
- Attempt rows are ready to hold completion status, score, time, suspend data, and the last runtime payload.

The current runtime intentionally stops at a secure launch checkpoint. Extracted package hosting, the JavaScript SCORM API adapter, and full LMSCommit handling should build on `ExternalPackage` and `ExternalPackageAttempt`.

## xAPI

`ExternalPackageAttempt.lastStatement` can hold statement snapshots for the first ingestion path. The next step is a dedicated xAPI endpoint that validates actor/course/lesson scope, stores statements, and optionally forwards to an external LRS.

## LTI

`ExternalPackageType.LTI` reserves the model path for tool configuration and lesson assignment. Before adding launch support, define signing, claims, redirect validation, key rotation, and tenant isolation rules.

## Security Boundary

Do not serve uploaded packages directly without authorization checks. Runtime launch pages must verify one of:

- the current user can manage the course, or
- the current user has an active/completed enrollment for the course.

Package files should be extracted into private or signed storage. Public URLs are acceptable only for non-sensitive demo packages.
