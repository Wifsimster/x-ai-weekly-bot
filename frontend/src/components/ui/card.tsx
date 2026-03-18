import { cn } from "@/lib/utils";

export function Card({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div data-slot="card" ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow", className)} {...props} />;
}

export function CardHeader({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div data-slot="card-header" ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div data-slot="card-title" ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardContent({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div data-slot="card-content" ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardDescription({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return <p data-slot="card-description" ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
