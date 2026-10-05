import { cn } from "@/lib/utils";

export function Badge({ className, active = false, ...props }) {
  return <span className={cn("ui-badge", active && "ui-badge--active", className)} {...props} />;
}
