import { Badge } from "@/components/atoms/Badge";
import type { BadgeProps } from "@/components/atoms/Badge";

interface StatusBadgeProps {
  label: string;
  variant?: BadgeProps["variant"];
}

export function StatusBadge({ label, variant = "default" }: StatusBadgeProps) {
  return <Badge variant={variant}>{label}</Badge>;
}
