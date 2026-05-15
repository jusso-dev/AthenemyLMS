# Roadmap

## GitHub Issues To Create

- Email integration: choose Resend, Postmark, or SES and replace `src/lib/email/index.ts` stubs.
- Rich lesson editor: add markdown or block editor support for lessons.
- Video processing: decide whether R2 stores originals only or integrates with Cloudflare Stream.
- Assessments: add quizzes, assignments, and completion gates.
- Certificates: generate course completion certificates.
- Organisation tenancy: add teams, invitations, and organisation-scoped roles.
- Billing portal: add Stripe customer portal support.
- Analytics hardening: replace mock summaries with persisted rollups.
- Accessibility audit: run keyboard, screen reader, contrast, and reduced-motion checks.
- Import/export: support course backup and migration between self-hosted installs.

## MVP Gaps

The current MVP establishes routes, schema, setup docs, and integration seams. Some management screens use mock data until Supabase is configured and the next persistence pass connects every form to Prisma mutations.
