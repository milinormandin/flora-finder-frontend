"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSavedPlants } from "@/lib/plant-data";
import { getPlantName } from "@/lib/plant-presentation";
import type { Plant } from "@/types/Plant";
import PlantCard from "../components/PlantCard";
import PageState from "../components/PageState";
import PlantGridSkeleton from "../components/PlantGridSkeleton";
import RemoveFromListButton from "../components/RemoveFromListButton";

export default function PlantListPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getSavedPlants()
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
      <header className="mb-9 sm:mb-11">
        <p className="eyebrow mb-3">Your collection</p>
        <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight text-foreground sm:text-5xl">
          My plant list
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          {loading || error
            ? "Keep the plants you’d like to come back to."
            : `${plants.length} ${plants.length === 1 ? "plant" : "plants"} saved for another look.`}
        </p>
      </header>

      {loading ? (
        <PlantGridSkeleton count={3} />
      ) : error ? (
        <PageState
          kind="error"
          title="Your plant list couldn’t load"
          description="Please try again to see your saved plants."
          onRetry={retry}
        />
      ) : plants.length === 0 ? (
        <PageState
          kind="empty"
          title="No saved plants yet"
          description="Save a plant from its detail page and you’ll find it here."
          action={
            <Button nativeButton={false} role="link" render={<Link href="/" />}>
              Explore plants <ArrowUpRight aria-hidden="true" />
            </Button>
          }
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => (
            <li key={plant.PLANT_ID} className="min-w-0">
              <PlantCard
                plant={plant}
                action={
                  <RemoveFromListButton
                    id={plant.PLANT_ID}
                    plantName={getPlantName(plant)}
                    onRemoved={() => {
                      setPlants((current) => current.filter((item) => item.PLANT_ID !== plant.PLANT_ID));
                    }}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
