# Default Course Library

Athenemy ships with editable starter courses so new organizations do not start from a blank catalogue.

## Available Templates

Template definitions live in `src/lib/course-templates.ts`.

Current templates:

- Cyber Security Awareness
- Incident Response Basics
- Acceptable Internet and Email Usage
- Phishing Awareness
- Password and MFA Hygiene
- Data Privacy and Confidential Information

The content is intentionally neutral and practical. It is not legal advice. Templates include placeholders such as `[Insert your reporting channel]` so admins can adapt training to local policies before publishing.

## Enabling Templates

Admins can enable templates in two places:

- `/onboarding/organization`: choose starter courses while creating an organization.
- `/dashboard/courses/library`: browse, search, preview outlines, and enable an editable copy later.

Enabling a template creates a normal organization-owned `Course` record with:

- `sourceTemplateId`
- `sourceTemplateVersion`
- `templateCategory`
- sections and lessons
- a default assessment
- certificate defaults
- required/recommended metadata
- auto-enrollment settings

Template courses are editable copies. Admins and instructors can change wording, lessons, assessments, prices, publishing state, and certificates like any other course.

## Auto-Enrollment

Template enablement supports:

- required-for-members state
- auto-enroll current members
- auto-enroll future members

Future-member enrollment is applied when an invitation is accepted. Archived courses disable future auto-enrollment so removed training does not keep assigning learners.

## Template Updates

Template updates do not overwrite organization content. A future reset/update workflow should require explicit admin confirmation and show what local customizations would change.
