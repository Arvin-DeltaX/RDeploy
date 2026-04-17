"use client";

import { useState } from "react";
import { Webhook, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useWebhookInfo, useSetupWebhook, useDeleteWebhook } from "@/hooks/useProjects";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { CopyButton } from "@/components/molecules/CopyButton";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";

interface WebhookSetupProps {
  projectId: string;
  canManage: boolean;
}

export function WebhookSetup({ projectId, canManage }: WebhookSetupProps) {
  const { data: webhookInfo, isLoading } = useWebhookInfo(projectId);
  const setupMutation = useSetupWebhook(projectId);
  const deleteMutation = useDeleteWebhook(projectId);

  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  function handleSetup() {
    setOneTimeSecret(null);
    setupMutation.mutate(undefined, {
      onSuccess: (result) => {
        setOneTimeSecret(result.webhookSecret);
      },
    });
  }

  function handleDisable() {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setOneTimeSecret(null);
        setDisableDialogOpen(false);
      },
    });
  }

  const isActive = webhookInfo?.hasSecret === true;
  const webhookUrl = webhookInfo?.webhookUrl ?? "";

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">GitHub Webhook</h3>
        </div>

        {isLoading ? (
          <Spinner />
        ) : isActive ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Webhook active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            No webhook configured
          </span>
        )}
      </div>

      {/* Webhook URL (shown when info is loaded) */}
      {webhookInfo && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Payload URL</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <span className="flex-1 truncate font-mono text-xs text-foreground">
              {webhookUrl}
            </span>
            <CopyButton value={webhookUrl} />
          </div>
        </div>
      )}

      {/* One-time secret reveal */}
      {oneTimeSecret && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Save this secret — it will not be shown again
          </p>
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-background px-3 py-2">
            <span className="flex-1 truncate font-mono text-xs text-foreground break-all">
              {oneTimeSecret}
            </span>
            <CopyButton value={oneTimeSecret} />
          </div>
          <p className="text-xs text-amber-300/80">
            Copy this value and paste it into the GitHub webhook secret field. Once you navigate
            away, the secret cannot be retrieved.
          </p>
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {!isActive ? (
            <Button
              size="sm"
              onClick={handleSetup}
              disabled={setupMutation.isPending || isLoading}
            >
              {setupMutation.isPending ? (
                <>
                  <Spinner />
                  Setting up...
                </>
              ) : (
                "Setup Webhook"
              )}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSetup}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? (
                  <>
                    <Spinner />
                    Regenerating...
                  </>
                ) : (
                  "Regenerate Secret"
                )}
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDisableDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                Disable
              </Button>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-md border border-border bg-background/50 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Info className="h-3.5 w-3.5" />
          How to configure in GitHub
        </div>
        <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
          <li>Go to your repository on GitHub and open <strong className="text-foreground">Settings &rarr; Webhooks &rarr; Add webhook</strong>.</li>
          <li>
            Paste the <strong className="text-foreground">Payload URL</strong> shown above into the URL field.
          </li>
          <li>
            Set <strong className="text-foreground">Content type</strong> to{" "}
            <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">application/json</span>.
          </li>
          <li>
            Paste your webhook secret into the <strong className="text-foreground">Secret</strong> field.
            {!isActive && (
              <span className="ml-1 text-amber-400">(Click &ldquo;Setup Webhook&rdquo; above to generate one.)</span>
            )}
          </li>
          <li>
            Under <strong className="text-foreground">Which events...</strong> select{" "}
            <strong className="text-foreground">Just the push event</strong>.
          </li>
          <li>Click <strong className="text-foreground">Add webhook</strong>. RDeploy will auto-deploy on every push.</li>
        </ol>
      </div>

      {/* Disable confirm dialog */}
      <ConfirmDialog
        open={disableDialogOpen}
        onOpenChange={setDisableDialogOpen}
        title="Disable webhook?"
        description="This will remove the webhook secret. Auto-deploys from GitHub will stop working until you set up the webhook again."
        confirmLabel="Disable"
        onConfirm={handleDisable}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
