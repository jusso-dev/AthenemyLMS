"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { scormCommitSchema } from "@/lib/scorm-cmi";

type Props = {
  packageId: string;
  sessionId: string;
  token: string;
  launchPath: string;
};
type Commit = ReturnType<typeof scormCommitSchema.parse>;

export function ScormPlayer({
  packageId,
  sessionId,
  token,
  launchPath,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<Commit | null>(null);
  const saving = useRef(false);
  const dirty = useRef(false);
  const latestSequence = useRef(0);
  const [status, setStatus] = useState(
    "Ready to learn. Progress saves when the package commits, and every 30 seconds.",
  );
  const [failed, setFailed] = useState(false);
  const suffixIndex = launchPath.search(/[?#]/);
  const pathname =
    suffixIndex < 0 ? launchPath : launchPath.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : launchPath.slice(suffixIndex);
  const url = `/api/scorm/content/${encodeURIComponent(packageId)}/${token}/${pathname.split("/").map(encodeURIComponent).join("/")}${suffix}`;

  const flush = useCallback(async () => {
    if (saving.current || !pending.current) return;
    saving.current = true;
    setFailed(false);
    while (pending.current) {
      const payload = pending.current;
      pending.current = null;
      setStatus("Saving progress…");
      try {
        const response = await fetch("/api/scorm/commit", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Progress could not be saved.");
        frame.current?.contentWindow?.postMessage(
          {
            type: "athenemy:scorm:saved",
            channel: token,
            sequence: payload.sequence,
            ok: true,
          },
          "*",
        );
        setStatus(
          dirty.current
            ? "Unsaved progress. Keep this page open until it is saved."
            : payload.finish
              ? "Progress saved. You can return to your course."
              : "Progress saved",
        );
      } catch (error) {
        if (!pending.current) pending.current = payload;
        setFailed(true);
        setStatus(
          error instanceof Error
            ? error.message
            : "Progress could not be saved. Retry before leaving.",
        );
        frame.current?.contentWindow?.postMessage(
          {
            type: "athenemy:scorm:saved",
            channel: token,
            sequence: payload.sequence,
            ok: false,
          },
          "*",
        );
        break;
      }
    }
    saving.current = false;
  }, [token]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null" ||
        !event.data ||
        event.data.channel !== token
      )
        return;
      if (event.data.type === "athenemy:scorm:dirty") {
        dirty.current = true;
        setStatus("Unsaved progress. Keep this page open until it is saved.");
        return;
      }
      if (event.data.type !== "athenemy:scorm:commit") return;
      const { sessionId: receivedSession, sequence, cmi, finish } = event.data;
      const result = scormCommitSchema.safeParse({
        sessionId: receivedSession,
        sequence,
        cmi,
        finish,
      });
      if (!result.success || receivedSession !== sessionId) {
        setFailed(false);
        frame.current?.contentWindow?.postMessage(
          { type: "athenemy:scorm:saved", channel: token, ok: false },
          "*",
        );
        setStatus(
          "The package sent unsupported progress. Contact your instructor before leaving.",
        );
        return;
      }
      if (sequence <= latestSequence.current) return;
      latestSequence.current = sequence;
      pending.current = result.data;
      dirty.current = false;
      void flush();
    }
    function protectUnsaved(event: BeforeUnloadEvent) {
      if (dirty.current || pending.current || saving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("message", receive);
    window.addEventListener("beforeunload", protectUnsaved);
    if (frame.current) frame.current.src = url;
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("beforeunload", protectUnsaved);
    };
  }, [flush, sessionId, token, url]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
        <p role="status" aria-live="polite" className="flex-1 text-sm">
          {status}
        </p>
        {failed && (
          <Button size="sm" variant="outline" onClick={() => void flush()}>
            Retry save
          </Button>
        )}
      </div>
      <iframe
        ref={frame}
        title="SCORM course content"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="h-[70vh] min-h-96 w-full rounded-md border bg-white"
      />
      <p className="text-xs text-muted-foreground">
        Wait for “Progress saved” before leaving. Opening this package in
        another tab replaces this launch session.
      </p>
    </div>
  );
}

export function ScormLauncher({ packageId }: { packageId: string }) {
  const [launch, setLaunch] = useState<Omit<Props, "packageId"> | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/scorm/launch?packageId=${encodeURIComponent(packageId)}`,
        { method: "POST", credentials: "same-origin" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The player could not start.");
      setLaunch(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "The player could not start.",
      );
    } finally {
      setStarting(false);
    }
  }
  if (launch) return <ScormPlayer packageId={packageId} {...launch} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Start or resume this package. Your last saved progress will load
        automatically.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={() => void start()} disabled={starting}>
        {starting ? "Starting…" : "Start package"}
      </Button>
    </div>
  );
}
