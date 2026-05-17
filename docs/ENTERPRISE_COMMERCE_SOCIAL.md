# Enterprise, Commerce, And Social Learning

This document covers the foundation models and UI entry points added for the larger enterprise, commerce, and social learning roadmap.

## Enterprise Foundations

Admin visibility:

- `/dashboard/admin` now includes recent audit log records when platform admin access is available.

Models:

- `AuditLog`
- `CustomOrganizationRole`
- `OrganizationPrivacySettings`

Helpers:

- `src/lib/enterprise.ts`

Current capability presets map organization roles to practical capabilities:

- owner: organization, member, course, billing, developer, and audit management
- admin: member, course, developer, and audit management
- instructor: course, cohort, and discussion moderation
- member: learning access and discussion posting

Follow-up work should add UI for creating custom roles, assigning them, exporting audit/compliance records, and enforcing privacy settings such as retention and MFA policies.

## Commerce Foundations

Admin visibility:

- `/dashboard/commerce`

Models:

- `CourseBundle`
- `CourseBundleItem`
- `CommerceCoupon`

Helpers:

- `src/lib/commerce.ts`

Current helper coverage:

- create course bundle records
- validate coupon lifecycle state
- apply percentage or fixed-amount coupon discounts without negative totals

Existing Stripe checkout and billing portal flows still handle single-course purchases and customer billing sessions. Bundle checkout, subscription tiers, coupon redemption in checkout, and affiliate attribution are follow-up work.

## Social Learning Foundations

Admin/learning visibility:

- `/dashboard/courses/social`

Models:

- `Cohort`
- `CohortMembership`
- `DiscussionThread`
- `DiscussionPost`
- `LiveSession`

Helpers:

- `src/lib/social-learning.ts`

Current helper coverage:

- create cohorts for organization-owned courses
- create discussion threads with first post
- schedule live sessions

Follow-up work should add full dashboard forms, learner discussion UI, instructor moderation, announcements, attendance tracking, and calendar views.
