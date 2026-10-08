"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { removePlantFromList } from "@/lib/plant-data";

type RemoveFromListButtonProps = {
  id: string;
  plantName?: string;
  onRemoved?: () => void;
};

export default function RemoveFromListButton({ id, plantName, onRemoved }: RemoveFromListButtonProps) {
  const [pending, setPending] = useState(false);
  const requestInFlight = useRef(false);

  const removePlant = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setPending(true);

    try {
      await removePlantFromList(id);
      toast.add({ title: "Removed from your plant list", type: "success" });
      onRemoved?.();
    } catch {
      toast.add({ title: "This plant couldn’t be removed. Please try again.", type: "error" });
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={removePlant}
      disabled={pending}
      aria-busy={pending}
      aria-label={plantName ? `Remove ${plantName} from your plant list` : "Remove from your plant list"}
      className="-ml-2 text-muted-foreground hover:text-foreground"
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
      {pending ? "Removing…" : "Remove from list"}
    </Button>
  );
}
