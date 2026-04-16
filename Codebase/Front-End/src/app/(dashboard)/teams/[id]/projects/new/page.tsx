"use client";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useTeam } from "@/hooks/useTeams";
import { useCreateProject } from "@/hooks/useProjects";
import { FormField } from "@/components/molecules/FormField";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ROUTES } from "@/constants/routes";

const schema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name is too long"),
  repoUrl: z
    .string()
    .min(1, "GitHub URL is required")
    .url("Must be a valid URL")
    .refine((val) => val.includes("github.com"), "Must be a GitHub repository URL"),
  dockerfilePath: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: teamData, isLoading: teamLoading } = useTeam(id);
  const createProject = useCreateProject(id);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dockerfilePath: "" },
  });

  const isAdmin = user?.platformRole === "owner" || user?.platformRole === "admin";
  const currentUserMember = teamData?.team.members.find((m) => m.userId === user?.id);
  const isLeader = currentUserMember?.role === "leader";
  const canCreate = isAdmin || isLeader;

  function onSubmit(values: FormValues) {
    createProject.mutate(
      {
        name: values.name,
        repoUrl: values.repoUrl,
        dockerfilePath: values.dockerfilePath?.trim() || undefined,
      },
      {
        onSuccess: (project) => {
          router.push(ROUTES.PROJECT_DETAIL(project.id));
        },
      }
    );
  }

  if (teamLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!teamData) {
    return (
      <EmptyState title="Team not found" description="This team does not exist or you do not have access." />
    );
  }

  if (!canCreate) {
    return (
      <EmptyState
        title="Access denied"
        description="Only team leaders and admins can create projects."
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.TEAM_DETAIL(id)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Project</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add a project to <span className="text-foreground">{teamData.team.name}</span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Project Name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              placeholder="e.g. My Backend API"
              {...register("name")}
            />
          </FormField>

          <FormField label="GitHub Repository URL" htmlFor="repoUrl" error={errors.repoUrl?.message}>
            <Input
              id="repoUrl"
              placeholder="https://github.com/org/repo"
              {...register("repoUrl")}
            />
          </FormField>

          <FormField
            label="Dockerfile Path (optional)"
            htmlFor="dockerfilePath"
            error={errors.dockerfilePath?.message}
          >
            <Input
              id="dockerfilePath"
              placeholder="Dockerfile"
              {...register("dockerfilePath")}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to <code className="text-xs">Dockerfile</code> at repo root. For monorepos use e.g.{" "}
              <code className="text-xs">backend/Dockerfile</code>.
            </p>
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(ROUTES.TEAM_DETAIL(id))}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
