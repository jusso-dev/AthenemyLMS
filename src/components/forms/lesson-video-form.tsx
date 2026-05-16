"use client";

import { useState } from "react";
import { Upload, Video } from "lucide-react";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionFormState } from "@/lib/action-state";

type VideoDefaults = {
  videoUrl: string;
  videoProvider: "EXTERNAL" | "R2";
  videoAssetKey: string;
  videoMimeType: string;
  videoBytes: number | "";
};

export function LessonVideoForm({
  action,
  defaults,
  disabled = false,
}: {
  action: (
    previousState: ActionFormState,
    formData: FormData,
  ) => ActionFormState | Promise<ActionFormState>;
  defaults: VideoDefaults;
  disabled?: boolean;
}) {
  const [provider, setProvider] = useState(defaults.videoProvider);
  const [videoUrl, setVideoUrl] = useState(defaults.videoUrl);
  const [videoAssetKey, setVideoAssetKey] = useState(defaults.videoAssetKey);
  const [videoMimeType, setVideoMimeType] = useState(defaults.videoMimeType);
  const [videoBytes, setVideoBytes] = useState(defaults.videoBytes);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadVideo(file: File) {
    setUploading(true);
    setMessage(null);

    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "video/mp4",
          folder: "videos",
        }),
      });
      const upload = (await presign.json()) as {
        uploadUrl?: string;
        publicUrl?: string;
        key?: string;
        error?: string;
      };
      if (
        !presign.ok ||
        !upload.uploadUrl ||
        !upload.publicUrl ||
        !upload.key
      ) {
        throw new Error(upload.error ?? "Video upload could not be prepared.");
      }

      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "video/mp4" },
        body: file,
      });
      if (!put.ok) throw new Error("Video upload failed.");

      setProvider("R2");
      setVideoUrl(upload.publicUrl);
      setVideoAssetKey(upload.key);
      setVideoMimeType(file.type || "video/mp4");
      setVideoBytes(file.size);
      setMessage("Video uploaded. Save the lesson video to persist it.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Video upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <ActionForm action={action} className="grid gap-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="videoProvider">
          Video source
        </label>
        <select
          id="videoProvider"
          name="videoProvider"
          value={provider}
          disabled={disabled}
          onChange={(event) =>
            setProvider(event.target.value as "EXTERNAL" | "R2")
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="EXTERNAL">External URL</option>
          <option value="R2">R2 hosted file</option>
        </select>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="videoUrl">
          Playback URL
        </label>
        <Input
          id="videoUrl"
          name="videoUrl"
          type="url"
          value={videoUrl}
          disabled={disabled}
          onChange={(event) => setVideoUrl(event.target.value)}
          placeholder="https://youtu.be/... or https://cdn.example.com/videos/lesson.mp4"
        />
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
        <label className="text-sm font-medium" htmlFor="videoFile">
          Upload MP4/WebM to R2
        </label>
        <Input
          id="videoFile"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadVideo(file);
          }}
        />
        <Button type="button" variant="outline" className="w-fit" disabled>
          {uploading ? (
            <Upload className="h-4 w-4 animate-pulse" />
          ) : (
            <Video className="h-4 w-4" />
          )}
          {uploading ? "Uploading" : "Select a file above"}
        </Button>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
      <input type="hidden" name="videoAssetKey" value={videoAssetKey} />
      <input type="hidden" name="videoMimeType" value={videoMimeType} />
      <input type="hidden" name="videoBytes" value={videoBytes} />
      <PendingSubmitButton className="w-fit" disabled={disabled}>
        Save video
      </PendingSubmitButton>
    </ActionForm>
  );
}
