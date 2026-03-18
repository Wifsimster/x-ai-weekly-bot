import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical"; ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      data-slot="separator"
      role="separator"
      ref={ref}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className,
      )}
      {...props}
    />
  );
}
