# Accessibility Audit

Date: 2026-05-15

## Scope

Audited the public catalogue, landing navigation, dashboard shell, course management list, and settings forms.

## Fixes

- Added a keyboard skip link that targets the app content wrapper.
- Added accessible names for compact logo links, primary navigation, and dashboard navigation.
- Added explicit accessible labels for search and settings form fields that previously relied on placeholders.
- Honored `prefers-reduced-motion: reduce` by disabling smooth scrolling and shortening animations/transitions.
- Added Playwright checks for skip-link focus, named search controls, and named navigation landmarks.

## Remaining Notes

Full automated axe coverage is not included to avoid adding another test dependency in this pass. The current checks cover the highest-risk MVP regressions and can be expanded with axe once the test dependency policy is settled.
