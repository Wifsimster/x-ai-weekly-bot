import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div data-slot="skeleton" ref={ref} className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
