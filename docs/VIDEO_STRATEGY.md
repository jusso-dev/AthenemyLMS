# Video Strategy

Athenemy uses a hybrid MVP strategy for lesson videos.

## Decision

- Use external video URLs for creators who already host on YouTube, Vimeo, Loom, or a private video provider.
- Use Cloudflare R2 direct file hosting for self-hosted MP4/WebM lesson videos.
- Defer Cloudflare Stream until adaptive bitrate encoding, signed playback, captions workflow, or DRM becomes required.

## Tradeoffs

External URLs are the fastest and cheapest path. Privacy and playback controls depend on the external provider.

R2 direct files keep storage under the app owner account and work well for short MP4/WebM lessons. R2 does not transcode, so instructors must upload web-ready files. Large audiences or long videos should move to Cloudflare Stream or another streaming provider.

Cloudflare Stream adds transcoding, adaptive playback, and stronger delivery controls, but also adds provider-specific asset state and cost.

## Setup

For R2 uploads, configure the Cloudflare R2 env group in `.env.local` and set bucket CORS to allow browser `PUT` uploads from `NEXT_PUBLIC_APP_URL`.

Instructors can attach either an external playback URL or upload a direct R2 video file from the lesson video screen. Video metadata is stored on `Lesson.videoProvider`, `Lesson.videoAssetKey`, `Lesson.videoMimeType`, and `Lesson.videoBytes`.
