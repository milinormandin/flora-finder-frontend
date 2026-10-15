"use client";

import { useRef, useState } from "react";
import type { PlantFilters } from "@/lib/plant-filters";
import CatalogFilters from "./components/CatalogFilters";
import PlantCollection from "./components/PlantCollection";

export default function HomePage() {
  const [filters, setFilters] = useState<PlantFilters>({});
  const letterSelect = useRef<HTMLSelectElement>(null);

  const clearFilters = () => {
    setFilters({});
    letterSelect.current?.focus();
  };

  return (
    <main id="main-content" tabIndex={-1} className="page-container pb-12 pt-10 sm:pb-16 sm:pt-14">
      <header className="mb-9 max-w-2xl sm:mb-11">
        <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight text-foreground sm:text-5xl">
          Explore native plants
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Get to know Hawaiʻi’s plants, their habitats, and their practical uses.
        </p>
      </header>

      <CatalogFilters filters={filters} onChange={setFilters} onClearFilters={clearFilters} letterSelectRef={letterSelect} />
      <PlantCollection
        key={`${filters.letter ?? ""}:${filters.island ?? ""}`}
        filters={filters}
        onClearFilters={clearFilters}
      />
    </main>
  );
}
