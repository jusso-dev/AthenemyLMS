# Course Import and Export

Athenemy exports courses as portable JSON files with format marker `athenemy.course.v1`.

Exports include:

- course metadata and settings
- sections and lessons
- lesson content and video URLs
- resource metadata, file URLs, and file keys

Resource binaries are not copied into the JSON file. When moving between installs, copy R2 objects or ensure `fileUrl` values remain reachable.

## Export

Authenticated instructors and admins can export a course they manage:

```http
GET /api/courses/{courseId}/export
```

The response is an attachment named `{slug}.athenemy-course.json`.

## Import

Admins can import a course into a fresh install:

```http
POST /api/courses/import
Content-Type: application/json
```

Imports are validated, created as drafts, and assigned to the importing admin as instructor. If a slug already exists, Athenemy appends an import suffix instead of overwriting existing courses.
