"use client";

import { useState } from "react";
import { Globe, Pencil, X, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useUpdateCustomDomain } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project.types";

interface CustomDomainProps {
  project: Project;
  canManage: boolean;
}

export function CustomDomain({ project, canManage }: CustomDomainProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.customDomain ?? "");

  const mutation = useUpdateCustomDomain(project.id);

  function handleEdit() {
    setValue(project.customDomain ?? "");
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setValue(project.customDomain ?? "");
  }

  function handleSave() {
    const trimmed = value.trim();
    mutation.mutate(trimmed === "" ? null : trimmed, {
      onSuccess: () => setEditing(false),
    });
  }

  function handleRemove() {
    mutation.mutate(null, {
      onSuccess: () => {
        setEditing(false);
        setValue("");
      },
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Custom Domain</span>
        </div>
        {canManage && !editing && (
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. api.mycompany.com"
            className={cn(
              "w-full rounded-md border border-border bg-background px-3 py-2",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
            )}
          />
          <p className="text-xs text-muted-foreground">
            Point your domain's A record to this server's IP. If the project is running, it will
            restart automatically.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
            {project.customDomain && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                disabled={mutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={mutation.isPending}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {project.customDomain ? (
            <p className="text-sm text-foreground font-mono">{project.customDomain}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No custom domain configured</p>
          )}
          <p className="text-xs text-muted-foreground">
            Point your domain's A record to this server's IP. If the project is running, it will
            restart automatically.
          </p>
        </div>
      )}
    </div>
  );
}
