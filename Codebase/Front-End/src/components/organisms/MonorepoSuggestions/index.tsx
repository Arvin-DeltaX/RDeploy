"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, X, FileCode } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { RdeployYmlService } from "@/types/project.types";

interface MonorepoSuggestionsProps {
  teamId: string;
  repoUrl: string;
  services: RdeployYmlService[];
}

export function MonorepoSuggestions({ teamId, repoUrl, services }: MonorepoSuggestionsProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-sm font-medium text-blue-300">
            This repo contains an{" "}
            <code className="text-xs font-semibold">rdeploy.yml</code> with{" "}
            {services.length} service{services.length !== 1 ? "s" : ""}. You can create
            separate projects for each service below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-blue-400 hover:text-blue-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-2">
        {services.map((service) => {
          const href =
            ROUTES.TEAM_NEW_PROJECT(teamId) +
            `?repoUrl=${encodeURIComponent(repoUrl)}&dockerfilePath=${encodeURIComponent(service.dockerfile)}&name=${encodeURIComponent(service.name)}`;

          return (
            <li
              key={service.name}
              className={cn(
                "flex flex-col gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3",
                "sm:flex-row sm:items-center sm:justify-between"
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                <FileCode className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{service.name}</p>
                  {service.description && (
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {service.dockerfile}
                  </p>
                </div>
              </div>
              <Link href={href} className="shrink-0">
                <Button size="sm" variant="outline">
                  Create Project
                </Button>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
