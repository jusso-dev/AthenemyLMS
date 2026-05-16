"use client";

import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Edit3,
  GripVertical,
  Layers3,
  Loader2,
  Monitor,
  Palette,
  Plus,
  Rocket,
  Settings2,
  Smartphone,
} from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { ActionMessage } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionFormState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type StatefulAction = (
  previousState: ActionFormState,
  formData: FormData,
) => ActionFormState | Promise<ActionFormState>;

type StudioBlock = {
  id: string;
  label: string;
  summary: string;
  position: number;
};

type BlockEditorSlot = {
  id: string;
  node: React.ReactNode;
};

type StudioPanel = "content" | "page" | "theme" | "publish";
type PreviewMode = "desktop" | "mobile";
type DropPlacement = "before" | "after";

export function PortalStudio({
  blocks,
  statusLabel,
  publicHref,
  pageSettings,
  addBlock,
  themeSettings,
  publishPanel,
  blockEditors,
  desktopPreview,
  mobilePreview,
  reorderAction,
  moveAction,
}: {
  blocks: StudioBlock[];
  statusLabel: string;
  publicHref: string;
  pageSettings: React.ReactNode;
  addBlock: React.ReactNode;
  themeSettings: React.ReactNode;
  publishPanel: React.ReactNode;
  blockEditors: BlockEditorSlot[];
  desktopPreview: React.ReactNode;
  mobilePreview: React.ReactNode;
  reorderAction: StatefulAction;
  moveAction: StatefulAction;
}) {
  const [panel, setPanel] = useState<StudioPanel>("content");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [selectedBlockId, setSelectedBlockId] = useState(blocks[0]?.id ?? "");
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    placement: DropPlacement;
  } | null>(null);
  const draggedInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const placementInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const moveBlockInputRef = useRef<HTMLInputElement>(null);
  const moveDirectionInputRef = useRef<HTMLInputElement>(null);
  const moveFormRef = useRef<HTMLFormElement>(null);
  const [reorderState, reorderFormAction, isReordering] = useActionState(
    reorderAction,
    initialActionState,
  );
  const [moveState, moveFormAction, isMoving] = useActionState(
    moveAction,
    initialActionState,
  );
  const [pendingReorderLabel, setPendingReorderLabel] = useState<string | null>(
    null,
  );
  const [pendingMoveLabel, setPendingMoveLabel] = useState<string | null>(null);
  const isOrdering = isReordering || isMoving;
  const selectedEditor = useMemo(
    () =>
      blockEditors.find((editor) => editor.id === selectedBlockId) ??
      blockEditors[0],
    [blockEditors, selectedBlockId],
  );
  const selectedBlock = useMemo(
    () =>
      blocks.find((block) => block.id === selectedBlockId) ?? blocks[0] ?? null,
    [blocks, selectedBlockId],
  );

  function submitReorder(targetBlockId: string, placement: DropPlacement) {
    if (!draggedBlockId || draggedBlockId === targetBlockId) return;
    if (!draggedInputRef.current || !targetInputRef.current) return;
    if (!placementInputRef.current || !formRef.current) return;
    const draggedBlock = blocks.find((block) => block.id === draggedBlockId);

    draggedInputRef.current.value = draggedBlockId;
    targetInputRef.current.value = targetBlockId;
    placementInputRef.current.value = placement;
    setSelectedBlockId(draggedBlockId);
    setPendingReorderLabel(
      draggedBlock ? `Saving ${draggedBlock.label} order` : "Saving order",
    );
    setDropTarget(null);
    setDraggedBlockId(null);
    formRef.current.requestSubmit();
  }

  function submitMove(blockId: string, direction: "up" | "down") {
    if (!moveBlockInputRef.current || !moveDirectionInputRef.current) return;
    if (!moveFormRef.current) return;
    const block = blocks.find((item) => item.id === blockId);
    moveBlockInputRef.current.value = blockId;
    moveDirectionInputRef.current.value = direction;
    setSelectedBlockId(blockId);
    setPendingMoveLabel(
      block
        ? `Moving ${block.label} ${direction === "up" ? "up" : "down"}`
        : "Moving block",
    );
    setDropTarget(null);
    setDraggedBlockId(null);
    moveFormRef.current.requestSubmit();
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusLabel === "Published" ? "success" : "outline"}>
            {statusLabel}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {blocks.length} homepage blocks
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={publicHref} target="_blank" rel="noreferrer">
              <Monitor className="h-4 w-4" />
              Published view
            </a>
          </Button>
          <Button
            type="button"
            variant={panel === "publish" ? "default" : "outline"}
            size="sm"
            onClick={() => setPanel("publish")}
          >
            <Rocket className="h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid min-h-[760px] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b bg-background xl:border-b-0 xl:border-r">
          <div
            className="flex overflow-x-auto border-b bg-muted/20 p-2"
            role="tablist"
          >
            {[
              { value: "content", label: "Blocks", icon: Layers3 },
              { value: "page", label: "Page", icon: Settings2 },
              { value: "theme", label: "Theme", icon: Palette },
              { value: "publish", label: "Publish", icon: Rocket },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = panel === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "inline-flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-background text-foreground shadow-sm",
                  )}
                  onClick={() => setPanel(item.value as StudioPanel)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="max-h-none overflow-y-auto p-4 xl:max-h-[calc(100vh-13rem)]">
            {panel === "content" ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold">Blocks</h2>
                      <p className="text-sm text-muted-foreground">
                        Select a block to edit its settings. Drag to reorder or
                        use the arrow controls on touch devices.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPanel("page")}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  <div className="mb-4 rounded-md border bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Editing
                        </p>
                        <h3 className="mt-1 text-sm font-semibold">
                          {selectedBlock
                            ? `${selectedBlock.position + 1}. ${selectedBlock.label}`
                            : "Select a block"}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {selectedBlock?.summary ??
                            "Choose a homepage block below to update its content, image URLs, links, and layout."}
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit">
                        Draft settings
                      </Badge>
                    </div>
                  </div>
                  <div className="mb-4 rounded-md border bg-card p-3">
                    <div className="mb-3 border-b pb-3">
                      <p className="text-sm font-semibold">
                        {selectedBlock
                          ? `${selectedBlock.label} settings`
                          : "Block settings"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Edit the selected block here, then save to refresh the
                        draft preview.
                      </p>
                    </div>
                    {selectedEditor?.node}
                  </div>
                  <div className="mb-3 min-h-9">
                    {isOrdering ? (
                      <div
                        className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        {isMoving
                          ? (pendingMoveLabel ?? "Moving block")
                          : (pendingReorderLabel ?? "Saving block order")}
                      </div>
                    ) : draggedBlockId ? (
                      <div
                        className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        Drop the block where it should appear.
                      </div>
                    ) : reorderState.status !== "idle" ? (
                      <ActionMessage state={reorderState} />
                    ) : moveState.status !== "idle" ? (
                      <ActionMessage state={moveState} />
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "space-y-2 transition-opacity",
                      isOrdering && "pointer-events-none opacity-70",
                    )}
                    aria-busy={isOrdering}
                  >
                    {blocks.map((block, index) => (
                      <div
                        key={block.id}
                        draggable={!isOrdering}
                        onDragStart={(event) => {
                          if (isOrdering) return;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", block.id);
                          setDraggedBlockId(block.id);
                        }}
                        onDragEnd={() => {
                          setDraggedBlockId(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(event) => {
                          if (isOrdering) return;
                          event.preventDefault();
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          const placement =
                            event.clientY > rect.top + rect.height / 2
                              ? "after"
                              : "before";
                          setDropTarget({ id: block.id, placement });
                        }}
                        onDrop={(event) => {
                          if (isOrdering) return;
                          event.preventDefault();
                          const placement = dropTarget?.placement ?? "before";
                          submitReorder(block.id, placement);
                        }}
                        className={cn(
                          "relative flex min-h-20 w-full items-start gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:border-ring",
                          selectedBlockId === block.id &&
                            "border-ring bg-muted/40",
                          draggedBlockId === block.id && "opacity-50",
                        )}
                      >
                        {dropTarget?.id === block.id ? (
                          <span
                            className={cn(
                              "absolute left-3 right-3 h-0.5 rounded-full bg-primary",
                              dropTarget.placement === "before"
                                ? "-top-1"
                                : "-bottom-1",
                            )}
                          />
                        ) : null}
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <button
                          type="button"
                          disabled={isOrdering}
                          onClick={() => setSelectedBlockId(block.id)}
                          aria-label={`Edit ${block.label} block`}
                          className="min-w-0 flex-1 text-left focus-visible:outline-none"
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block text-sm font-medium">
                              {block.label}
                            </span>
                            {selectedBlockId === block.id ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                Editing
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                            {block.summary}
                          </span>
                        </button>
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={isOrdering}
                            aria-label={`Edit ${block.label}`}
                            title="Edit block"
                            onClick={() => setSelectedBlockId(block.id)}
                            className={cn(
                              "inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
                              selectedBlockId === block.id &&
                                "border-primary/30 text-primary",
                            )}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isOrdering || index === 0}
                            aria-label={`Move ${block.label} up`}
                            title="Move up"
                            onClick={() => submitMove(block.id, "up")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isOrdering || index === blocks.length - 1}
                            aria-label={`Move ${block.label} down`}
                            title="Move down"
                            onClick={() => submitMove(block.id, "down")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <span className="hidden w-5 text-right text-xs text-muted-foreground sm:inline">
                            {block.position + 1}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <form
                    ref={formRef}
                    action={reorderFormAction}
                    className="sr-only"
                  >
                    <input
                      ref={draggedInputRef}
                      type="hidden"
                      name="draggedBlockId"
                    />
                    <input
                      ref={targetInputRef}
                      type="hidden"
                      name="targetBlockId"
                    />
                    <input
                      ref={placementInputRef}
                      type="hidden"
                      name="placement"
                    />
                    <button type="submit">Save order</button>
                  </form>
                  <form
                    ref={moveFormRef}
                    action={moveFormAction}
                    className="sr-only"
                  >
                    <input
                      ref={moveBlockInputRef}
                      type="hidden"
                      name="blockId"
                    />
                    <input
                      ref={moveDirectionInputRef}
                      type="hidden"
                      name="direction"
                    />
                    <button type="submit">Move block</button>
                  </form>
                </div>
              </div>
            ) : null}

            {panel === "page" ? (
              <div className="space-y-4">
                <PanelHeading
                  title="Page setup"
                  description="Add blocks and tune homepage metadata."
                />
                {addBlock}
                {pageSettings}
              </div>
            ) : null}

            {panel === "theme" ? (
              <div className="space-y-4">
                <PanelHeading
                  title="Theme"
                  description="Set the portal identity and navigation."
                />
                {themeSettings}
              </div>
            ) : null}

            {panel === "publish" ? (
              <div className="space-y-4">
                <PanelHeading
                  title="Publish"
                  description="Push the current draft to the public portal."
                />
                {publishPanel}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 bg-muted/20 p-3 sm:p-4 lg:p-6">
          <div className="space-y-4 xl:sticky xl:top-4">
            <div className="flex flex-col gap-3 rounded-md border bg-background p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Live preview</h2>
                <p className="text-sm text-muted-foreground">
                  Draft content renders as learners will see it.
                </p>
              </div>
              <div className="inline-flex w-full rounded-md border bg-muted p-1 sm:w-fit">
                {[
                  { value: "desktop", label: "Desktop", icon: Columns3 },
                  { value: "mobile", label: "Mobile", icon: Smartphone },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = previewMode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={isActive}
                      className={cn(
                        "inline-flex h-8 items-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "flex-1 justify-center sm:flex-none",
                        isActive && "bg-background text-foreground shadow-sm",
                      )}
                      onClick={() => setPreviewMode(item.value as PreviewMode)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border bg-background shadow-sm">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {publicHref}
                </span>
              </div>
              <div
                className={cn(
                  "mx-auto max-h-[680px] min-w-0 overflow-y-auto bg-background",
                  previewMode === "mobile"
                    ? "my-4 box-border w-[calc(100%-1.5rem)] max-w-[390px] rounded-[1.75rem] border-[8px] border-foreground/80 sm:my-5 sm:border-[10px]"
                    : "w-full max-w-full overflow-x-hidden",
                )}
              >
                {previewMode === "desktop" ? desktopPreview : mobilePreview}
              </div>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}

function PanelHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
