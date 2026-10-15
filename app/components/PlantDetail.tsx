"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlant, PlantDataError } from "@/lib/plant-data";
import { getPlantName, getPlantPhotos } from "@/lib/plant-presentation";
import type { Plant } from "@/types/Plant";
import ImageGallery from "./ImageGallery";
import AccordionExpand from "./AccordionExpand";
import AddToListButton from "./AddToListButton";
import ConservationBadge from "./ConservationBadge";
import PageState from "./PageState";

type PlantDetailState = {
  plantId: string;
  plant: Plant | null;
  error: "error" | "not-found" | null;
  loading: boolean;
};

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-10" role="status" aria-label="Loading plant details">
      <Skeleton className="aspect-[4/3] rounded-2xl" />
      <div className="space-y-5 py-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-11 w-52" />
        <Skeleton className="mt-8 h-56 w-full rounded-2xl" />
      </div>
      <span className="sr-only">Loading plant details…</span>
    </div>
  );
}

export default function PlantDetail({ plantId }: { plantId: string }) {
  const [state, setState] = useState<PlantDetailState>({ plantId: "", plant: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);
  const loading = state.loading || state.plantId !== plantId;

  useEffect(() => {
    let cancelled = false;

    getPlant(plantId)
      .then((plant) => {
        if (!cancelled) setState({ plantId, plant, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            plantId,
            plant: null,
            error: error instanceof PlantDataError && error.status === 404 ? "not-found" : "error",
            loading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [plantId, attempt]);

  const retry = () => {
    setState({ plantId, plant: null, error: null, loading: true });
    setAttempt((value) => value + 1);
  };

  const plant = state.plant;
  const plantName = plant ? getPlantName(plant) : "";
  const information = plant
    ? [
        { value: "general", title: "General information", content: plant.GENERAL_INFORMATION },
        { value: "habitat", title: "Habitat", content: plant.ADDITIONAL_HABITAT_INFORMATION },
        { value: "modern-use", title: "Modern use", content: plant.MODERN_USE },
        { value: "hawaiian-use", title: "Early Hawaiian use", content: plant.EARLY_HAWAIIAN_USE },
      ].filter((section) => section.content?.trim())
    : [];
  const facts = plant
    ? [
        { label: "Family", value: plant.FAMILY },
        { label: "Native status", value: plant.NATIVE_STATUS },
        { label: "Natural range", value: plant.NATURAL_RANGE },
      ].filter((fact) => fact.value?.trim())
    : [];

  return (
    <main id="main-content" tabIndex={-1} className="page-container pb-12 pt-6 sm:pb-16 sm:pt-8">
      <Button nativeButton={false} role="link" variant="ghost" size="sm" className="mb-7 -ml-2 text-muted-foreground" render={<Link href="/" />}>
        <ArrowLeft aria-hidden="true" /> Back to plants
      </Button>

      {loading ? (
        <DetailSkeleton />
      ) : state.error === "not-found" || !plant ? (
        <PageState
          kind={state.error === "error" ? "error" : "not-found"}
          title={state.error === "error" ? "This plant couldn’t load" : "Plant not found"}
          description={state.error === "error" ? "Please try again to see this plant’s details." : "This plant may no longer be available. Explore the collection to find another."}
          onRetry={state.error === "error" ? retry : undefined}
          action={state.error !== "error" ? <Button nativeButton={false} role="link" render={<Link href="/" />}>Explore plants</Button> : undefined}
        />
      ) : (
        <>
          <div className="grid items-start gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-10">
            <ImageGallery key={plant.PLANT_ID} photos={getPlantPhotos(plant)} plantName={plantName} />

            <div className="min-w-0 lg:pt-2">
              <h1 className="text-3xl leading-tight font-semibold tracking-tight break-words text-foreground sm:text-4xl">
                {plantName}
              </h1>
              {plant.COMMON_NAME?.trim() && plant.COMMON_NAME.trim().toLocaleLowerCase() !== plantName.toLocaleLowerCase() && (
                <p className="mt-2 text-lg leading-7 text-muted-foreground">{plant.COMMON_NAME}</p>
              )}
              <div className="mt-4">
                <ConservationBadge status={plant.CONSERVATION_STATUS} />
              </div>
              <div className="mt-6">
                <AddToListButton key={plant.PLANT_ID} id={plant.PLANT_ID} />
              </div>

              {facts.length > 0 && (
                <Card className="mt-8 gap-0 border-border py-0 shadow-none">
                  <dl className="divide-y divide-border px-5">
                    {facts.map((fact) => (
                      <div key={fact.label} className="grid grid-cols-[7rem_1fr] gap-4 py-4">
                        <dt className="text-sm leading-6 text-muted-foreground">{fact.label}</dt>
                        <dd className="min-w-0 text-sm leading-6 break-words text-foreground">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}
            </div>
          </div>

          {information.length > 0 && (
            <section className="mt-10 border-t border-border pt-8 sm:mt-14 sm:pt-10">
              <div className="grid gap-4 lg:grid-cols-[0.6fr_1fr] lg:gap-16">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">About this plant</h2>
                </div>
                <Accordion defaultValue={[information[0].value]} className="w-full">
                  {information.map((section) => (
                    <AccordionExpand key={section.value} {...section} />
                  ))}
                </Accordion>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
