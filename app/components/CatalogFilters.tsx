"use client";

import { useId, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { plantIslands, type PlantFilters } from "@/lib/plant-filters";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function CatalogFilters({ filters, onChange, onClearFilters, letterSelectRef }: {
  filters: PlantFilters;
  onChange: (filters: PlantFilters) => void;
  onClearFilters: () => void;
  letterSelectRef: Ref<HTMLSelectElement>;
}) {
  const letterId = useId();
  const islandId = useId();
  const hasFilters = Boolean(filters.letter || filters.island);

  return (
    <section aria-label="Browse plants" className="mb-8 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Browse plants</h2>
        {hasFilters && <Button variant="ghost" size="sm" onClick={onClearFilters}>Clear filters</Button>}
      </div>
      <div>
        <label htmlFor={letterId} className="mb-2 block text-sm font-medium">Browse by letter</label>
        <select
          ref={letterSelectRef}
          id={letterId}
          value={filters.letter ?? ""}
          onChange={(event) => onChange({ ...filters, letter: event.target.value || undefined })}
          aria-describedby={`${letterId}-description`}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 sm:max-w-xs lg:text-sm"
        >
          <option value="">All letters</option>
          {letters.map((letter) => <option key={letter} value={letter}>{letter}</option>)}
        </select>
        <p id={`${letterId}-description`} className="mt-2 text-xs leading-5 text-muted-foreground">Letters follow the plant names shown on the cards.</p>
      </div>
      <div className="mt-5 border-t border-border pt-5">
        <label htmlFor={islandId} className="mb-2 block text-sm font-medium">Browse by island</label>
        <select
          id={islandId}
          value={filters.island ?? ""}
          onChange={(event) => onChange({ ...filters, island: (event.target.value || undefined) as PlantFilters["island"] })}
          aria-describedby={`${islandId}-description`}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 sm:max-w-xs lg:text-sm"
        >
          <option value="">All islands</option>
          {plantIslands.map((island) => <option key={island.id} value={island.id}>{island.label}</option>)}
          <option value="unrecorded">Not recorded</option>
        </select>
        <p id={`${islandId}-description`} className="mt-2 text-xs leading-5 text-muted-foreground">
          Island filters use listed natural ranges, including historical ranges. Choose “Not recorded” for plants without range information.
        </p>
      </div>
    </section>
  );
}
