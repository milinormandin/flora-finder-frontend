"use client";

import { useEffect, useState } from "react";
import { getPlants } from "@/lib/plant-data";
import type { Plant } from "@/types/Plant";
import PlantCard from "./components/PlantCard";
import PageState from "./components/PageState";
import PlantGridSkeleton from "./components/PlantGridSkeleton";

export default function HomePage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getPlants()
      .then((data) => {
        if (!cancelled) setPlants(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  };

  return (
    <main id="main-content" tabIndex={-1} className="page-container pb-12 pt-10 sm:pb-16 sm:pt-14">
      <header className="mb-9 max-w-2xl sm:mb-11">
        <p className="eyebrow mb-3">The plant collection</p>
        <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight text-foreground sm:text-5xl">
          Explore native plants
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Get to know Hawaiʻi’s plants, their habitats, and their place in Hawaiian life.
        </p>
      </header>

      {loading ? (
        <PlantGridSkeleton />
      ) : error ? (
        <PageState
          kind="error"
          title="The collection couldn’t load"
          description="Please try again to explore the plants."
          onRetry={retry}
        />
      ) : plants.length === 0 ? (
        <PageState
          kind="empty"
          title="No plants to show yet"
          description="The collection is empty. Check back for plants to explore."
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => (
            <li key={plant.PLANT_ID} className="min-w-0">
              <PlantCard plant={plant} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
