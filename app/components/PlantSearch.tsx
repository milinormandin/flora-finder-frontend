"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { ArrowUpRight, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlantSuggestions } from "@/lib/plant-data";
import { getPlantName } from "@/lib/plant-presentation";
import type { PlantSuggestion } from "@/types/PlantSuggestion";

export default function PlantSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlantSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timeout = useRef<number | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    request.current?.abort();
  }, []);

  function cancelSearch() {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    request.current?.abort();
  }

  function search(value: string, immediate = false) {
    cancelSearch();
    const searchQuery = value.trim();
    const canSearch = searchQuery.length >= 2;
    setQuery(value);
    setSuggestions([]);
    setStatus(canSearch ? "loading" : "idle");
    setOpen(canSearch);
    if (!canSearch) return;

    const controller = new AbortController();
    request.current = controller;
    const load = () => {
      getPlantSuggestions(searchQuery, controller.signal)
        .then((plants) => {
          if (controller.signal.aborted) return;
          setSuggestions(plants);
          setStatus("ready");
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    };
    if (immediate) load();
    else timeout.current = window.setTimeout(load, 250);
  }

  function selectPlant(plant: PlantSuggestion) {
    cancelSearch();
    setQuery("");
    setSuggestions([]);
    setStatus("idle");
    setOpen(false);
    input.current?.blur();
    router.push(`/plant/${encodeURIComponent(plant.PLANT_ID)}`);
  }

  return (
    <div role="search" aria-label="Plant search" className="min-w-0 w-full">
      <Autocomplete.Root
        items={suggestions}
        filter={null}
        autoHighlight="always"
        value={query}
        onValueChange={(value, details) => {
          if (details.reason !== "item-press") search(value);
        }}
        itemToStringValue={getPlantName}
        open={open && query.trim().length >= 2}
        onOpenChange={setOpen}
        openOnInputClick
      >
        <Autocomplete.InputGroup className="flex h-11 w-full items-center rounded-lg border border-input bg-card transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
          <Search className="ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Autocomplete.Input
            ref={input}
            aria-label="Search plants"
            placeholder="Search plants…"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground lg:text-sm"
          />
          {query && (
            <Autocomplete.Clear aria-label="Clear search" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
              <X className="size-4" aria-hidden="true" />
            </Autocomplete.Clear>
          )}
        </Autocomplete.InputGroup>
        <Autocomplete.Portal>
          <Autocomplete.Positioner sideOffset={8} align="start" className="z-50 w-[var(--anchor-width)] max-w-[var(--available-width)]">
            <Autocomplete.Popup className="max-h-[min(420px,var(--available-height))] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg" aria-busy={status === "loading"}>
              <Autocomplete.Status className="text-sm text-muted-foreground">
                {status === "loading" ? (
                  <p className="flex items-center gap-2 px-3 py-4">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Searching plants…
                  </p>
                ) : status === "error" ? (
                  <div className="space-y-3 px-3 py-4">
                    <p>Search couldn’t load. Please try again.</p>
                    <Button variant="outline" size="sm" onClick={() => {
                      search(query, true);
                      input.current?.focus();
                    }}>
                      Retry search
                    </Button>
                  </div>
                ) : status === "ready" && suggestions.length > 0 ? (
                  <span className="sr-only">{suggestions.length} plants found.</span>
                ) : null}
              </Autocomplete.Status>
              <Autocomplete.Empty className="text-sm text-muted-foreground">
                {status === "ready" && <p className="px-3 py-4">No plants found.</p>}
              </Autocomplete.Empty>
              <Autocomplete.List aria-label="Plant suggestions">
                {(plant: PlantSuggestion) => {
                  const name = getPlantName(plant);
                  const commonName = plant.COMMON_NAME?.trim();
                  return (
                    <Autocomplete.Item
                      key={plant.PLANT_ID}
                      value={plant}
                      onClick={() => selectPlant(plant)}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-3 data-highlighted:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium [overflow-wrap:anywhere]">{name}</span>
                        {commonName && commonName !== name && (
                          <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">{commonName}</span>
                        )}
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Autocomplete.Item>
                  );
                }}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    </div>
  );
}
