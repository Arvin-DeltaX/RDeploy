export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  cloning: "Cloning",
  ready: "Ready",
  building: "Building",
  running: "Running",
  failed: "Failed",
  stopped: "Stopped",
};

export const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-500/20 text-green-400 border-green-500/30",
  building: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cloning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  stopped: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  ready: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export const HEALTH_COLORS: Record<string, string> = {
  healthy: "text-green-400",
  unhealthy: "text-red-400",
  unknown: "text-gray-400",
};
