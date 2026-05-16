"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAVIGATION_TIMEOUT_MS = 8000;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

function isInternalNavigation(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const destination = new URL(href, window.location.href);
  const current = new URL(window.location.href);

  if (destination.origin !== current.origin) return false;
  return (
    destination.pathname !== current.pathname ||
    destination.search !== current.search
  );
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function clearPending() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsPending(false);
    }

    const frame = window.requestAnimationFrame(clearPending);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !isInternalNavigation(anchor)) return;

      setIsPending(true);

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setIsPending(false);
        timeoutRef.current = null;
      }, NAVIGATION_TIMEOUT_MS);
    }

    window.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("click", handleClick, true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden bg-transparent transition-opacity duration-150",
          isPending ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="h-full w-1/2 animate-pulse bg-primary shadow-[0_0_14px_rgba(30,58,138,0.45)]" />
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isPending ? "Loading page" : null}
      </div>
    </>
  );
}
