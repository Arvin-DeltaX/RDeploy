"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Upload, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/Button";
import type { EnvVar } from "@/types/project.types";

const envVarsSchema = z.object({
  vars: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      value: z.string(),
      isSecret: z.boolean(),
    })
  ),
});

type EnvVarsFormValues = z.infer<typeof envVarsSchema>;

interface EnvVarsFormProps {
  envVars: EnvVar[];
  canEdit: boolean;
  onSave: (vars: Array<{ id: string; value: string; isSecret: boolean }>) => void;
  isSaving: boolean;
}

export function EnvVarsForm({ envVars, canEdit, onSave, isSaving }: EnvVarsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());

  const { register, control, handleSubmit, setValue, watch } = useForm<EnvVarsFormValues>({
    resolver: zodResolver(envVarsSchema),
    defaultValues: {
      vars: envVars.map((v) => ({
        id: v.id,
        key: v.key,
        value: "",
        isSecret: v.isSecret,
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: "vars" });
  const watchedVars = watch("vars");

  // Re-initialize when envVars prop changes (e.g. after clone)
  useEffect(() => {
    envVars.forEach((v, i) => {
      setValue(`vars.${i}.id`, v.id);
      setValue(`vars.${i}.key`, v.key);
      setValue(`vars.${i}.isSecret`, v.isSecret);
    });
  }, [envVars, setValue]);

  function toggleVisible(index: number) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleUploadEnvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") return;
      const parsed: Record<string, string> = {};
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (key) parsed[key] = value;
      }
      fields.forEach((field, i) => {
        if (parsed[field.key] !== undefined) {
          setValue(`vars.${i}.value`, parsed[field.key]);
        }
      });
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = "";
  }

  function onSubmit(data: EnvVarsFormValues) {
    onSave(data.vars.map(({ id, value, isSecret }) => ({ id, value, isSecret })));
  }

  if (envVars.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          No environment variables found. Make sure your repo has a{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env.example</code>{" "}
          file.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {fields.map((field, i) => {
          const isVisible = visibleKeys.has(i);
          const currentValue = watchedVars?.[i]?.value ?? "";
          const isEmpty = currentValue.trim() === "";
          const isSecret = watchedVars?.[i]?.isSecret ?? field.isSecret;

          return (
            <div key={field.id} className="flex items-center gap-3 px-4 py-3">
              {/* Key label */}
              <div className="w-56 shrink-0 flex items-center gap-2">
                <span className="text-sm font-mono text-foreground truncate">{field.key}</span>
                {isEmpty && (
                  <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-400 shrink-0">
                    Not set
                  </span>
                )}
              </div>

              {/* Value input */}
              <div className="flex-1 flex items-center gap-2">
                <input
                  {...register(`vars.${i}.value`)}
                  type={isSecret && !isVisible ? "password" : "text"}
                  disabled={!canEdit}
                  placeholder={isSecret ? "••••••••" : "Enter value"}
                  className={cn(
                    "flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  )}
                />

                {/* Toggle secret visibility */}
                {isSecret && (
                  <button
                    type="button"
                    onClick={() => toggleVisible(i)}
                    disabled={!canEdit}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                    aria-label={isVisible ? "Hide value" : "Show value"}
                  >
                    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving} size="sm">
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload .env file
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".env,text/plain"
            className="hidden"
            onChange={handleUploadEnvFile}
          />
        </div>
      )}
    </form>
  );
}
