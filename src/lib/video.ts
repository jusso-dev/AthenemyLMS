const videoFilePattern = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;

export function getVideoPlayback(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const youtubeId = getYoutubeId(parsed);
    if (youtubeId) {
      return {
        kind: "iframe" as const,
        src: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
        title: "YouTube lesson video",
      };
    }

    const vimeoId = getVimeoId(parsed);
    if (vimeoId) {
      return {
        kind: "iframe" as const,
        src: `https://player.vimeo.com/video/${vimeoId}`,
        title: "Vimeo lesson video",
      };
    }

    return {
      kind: videoFilePattern.test(parsed.pathname) ? "video" as const : "iframe" as const,
      src: url,
      title: "Lesson video",
    };
  } catch {
    return null;
  }
}

export function formatVideoBytes(bytes: number | null | undefined) {
  if (!bytes) return "Unknown size";
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function getYoutubeId(url: URL) {
  if (url.hostname === "youtu.be") return url.pathname.slice(1);
  if (url.hostname.endsWith("youtube.com")) {
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
    return url.searchParams.get("v");
  }
  return null;
}

function getVimeoId(url: URL) {
  if (!url.hostname.endsWith("vimeo.com")) return null;
  const id = url.pathname.split("/").filter(Boolean).at(0);
  return id && /^\d+$/.test(id) ? id : null;
}
