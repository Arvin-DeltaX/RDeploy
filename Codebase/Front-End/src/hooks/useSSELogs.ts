"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";

/**
 * Streams SSE log lines from the backend logs/stream endpoint.
 *
 * NOTE: This hook intentionally uses the native `fetch` API instead of the
 * project-wide `lib/api.ts` (axios) instance. This is the only valid exception
 * to the axios-only rule: `EventSource` does not support custom headers (such
 * as `Authorization`), so `fetch` with a `ReadableStream` reader is required
 * to attach the JWT token to the SSE request.
 */
export function useSSELogs(
  projectId: string,
  type: "deploy" | "app",
  active: boolean
): { lines: string[]; done: boolean } {
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setLines([]);
      setDone(false);
      return;
    }

    const token = useAuthStore.getState().token;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    const url =
      type === "app"
        ? `${apiUrl}/api/projects/${projectId}/logs/stream?type=app`
        : `${apiUrl}/api/projects/${projectId}/logs/stream`;

    let cancelled = false;
    const controller = new AbortController();

    async function stream() {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone || cancelled) break;

          const chunk = decoder.decode(value, { stream: true });
          const rawLines = chunk.split("\n");

          for (const raw of rawLines) {
            if (raw.startsWith("data: ")) {
              const content = raw.slice(6).trim();
              if (content === "[DONE]") {
                setDone(true);
                return;
              }
              if (content) {
                setLines((prev) => [...prev, content]);
              }
            }
          }
        }
      } catch {
        // aborted or network error — silently ignore
      }
    }

    void stream();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, type, active]);

  return { lines, done };
}
