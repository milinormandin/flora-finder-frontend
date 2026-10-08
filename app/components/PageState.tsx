import type { ReactNode } from "react";
import { CircleAlert, RefreshCw, SearchX, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageStateProps = {
  kind: "error" | "empty" | "not-found";
  title: string;
  description: string;
  onRetry?: () => void;
  action?: ReactNode;
};

export default function PageState({ kind, title, description, onRetry, action }: PageStateProps) {
  const Icon = kind === "error" ? CircleAlert : kind === "not-found" ? SearchX : Sprout;

  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center" role={kind === "error" ? "alert" : "status"}>
      <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {(onRetry || action) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
