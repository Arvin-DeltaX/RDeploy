"use client";

import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useDeployLogs } from "@/hooks/useProjects";
import { useSSELogs } from "@/hooks/useSSELogs";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/project.types";

interface LogsViewerProps {
  projectId: string;
  status: ProjectStatus;
}

function LogBox({
  lines,
  isLive,
}: {
  lines: string[];
  isLive: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="relative rounded-lg border border-border bg-black/40 overflow-hidden">
      {isLive && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      )}
      <pre className="p-4 text-xs text-green-400 max-h-80 overflow-y-auto whitespace-pre-wrap font-mono">
        {lines.length === 0 ? (
          <span className="text-muted-foreground">No logs yet</span>
        ) : (
          lines.join("\n")
        )}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}

function DeployLogsTab({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const isActive = status === "building" || status === "cloning";
  const { lines, done } = useSSELogs(projectId, "deploy", isActive);
  const { data: staticLogs } = useDeployLogs(projectId);

  if (isActive) {
    return <LogBox lines={lines} isLive={!done} />;
  }

  const logText = staticLogs?.logs ?? "";
  const staticLines = logText ? logText.split("\n") : [];

  return (
    <div className="rounded-lg border border-border bg-black/40">
      <pre className="p-4 text-xs text-green-400 max-h-80 overflow-y-auto whitespace-pre-wrap font-mono">
        {staticLines.length === 0 ? (
          <span className="text-muted-foreground">No deploy logs yet</span>
        ) : (
          staticLines.join("\n")
        )}
      </pre>
    </div>
  );
}

function AppLogsTab({
  projectId,
  status,
  isTabActive,
}: {
  projectId: string;
  status: ProjectStatus;
  isTabActive: boolean;
}) {
  const isRunning = status === "running";
  const { lines, done } = useSSELogs(projectId, "app", isRunning && isTabActive);

  if (!isRunning) {
    return (
      <p className="text-sm text-muted-foreground py-4">Container is not running.</p>
    );
  }

  return <LogBox lines={lines} isLive={!done} />;
}

export function LogsViewer({ projectId, status }: LogsViewerProps) {
  const [activeTab, setActiveTab] = useState("deploy");
  const isRunning = status === "running";

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List className="flex border-b border-border mb-4">
        <Tabs.Trigger
          value="deploy"
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "deploy"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Deploy Logs
        </Tabs.Trigger>
        <Tabs.Trigger
          value="app"
          disabled={!isRunning}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "app"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
            !isRunning && "opacity-40 cursor-not-allowed"
          )}
        >
          App Logs
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="deploy">
        <DeployLogsTab projectId={projectId} status={status} />
      </Tabs.Content>

      <Tabs.Content value="app">
        <AppLogsTab
          projectId={projectId}
          status={status}
          isTabActive={activeTab === "app"}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
