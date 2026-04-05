import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/**
 * ErrorState — shown when a data fetch fails (REL-04).
 * Displays the error message and a "Tentar novamente" button that triggers onRetry.
 * onRetry should be the execute() function from useApiCall, which cancels any
 * prior in-flight request before starting a new one (REL-05).
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
