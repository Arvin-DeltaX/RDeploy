"use client";
import { useAllProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/organisms/ProjectCard";
import { Spinner } from "@/components/atoms/Spinner";
import { EmptyState } from "@/components/molecules/EmptyState";

export default function DashboardPage() {
  const { data: projects, isLoading, isError } = useAllProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">All projects across your teams.</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Failed to load projects"
          description="There was an error loading projects. Please refresh the page."
        />
      )}

      {!isLoading && !isError && projects && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Projects will appear here once your team creates them."
        />
      )}

      {!isLoading && !isError && projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
