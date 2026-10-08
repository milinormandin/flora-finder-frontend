"use client";

import { useRef, useState } from "react";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { addPlantToList } from "@/lib/plant-data";

type AddToListButtonProps = {
  id: string;
};

export default function AddToListButton({ id }: AddToListButtonProps) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const requestInFlight = useRef(false);

  const savePlant = async () => {
    if (requestInFlight.current || added) return;
    requestInFlight.current = true;
    setPending(true);

    try {
      await addPlantToList(id);
      setAdded(true);
      toast.add({ title: "Added to your plant list", type: "success" });
    } catch {
      toast.add({ title: "This plant couldn’t be saved. Please try again.", type: "error" });
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Button onClick={savePlant} disabled={pending || added} aria-busy={pending} className="w-full sm:w-auto">
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : added ? (
        <Check aria-hidden="true" />
      ) : (
        <BookmarkPlus aria-hidden="true" />
      )}
      {pending ? "Saving…" : added ? "Added to your list" : "Add to my plant list"}
    </Button>
  );
}
