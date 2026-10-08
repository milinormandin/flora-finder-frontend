import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getPlantName, getPlantPhotos } from "@/lib/plant-presentation";
import type { Plant } from "@/types/Plant";
import ConservationBadge from "./ConservationBadge";
import PlantImage from "./PlantImage";

export default function PlantCard({ plant, action }: { plant: Plant; action?: ReactNode }) {
  const name = getPlantName(plant);
  const photo = getPlantPhotos(plant)[0];
  const commonName = plant.COMMON_NAME?.trim();

  return (
    <Card className="group h-full gap-0 overflow-hidden rounded-xl border-border bg-card py-0 shadow-none transition-colors hover:border-primary/40">
      <Link href={`/plant/${encodeURIComponent(plant.PLANT_ID)}`} className="flex flex-1 flex-col rounded-xl" aria-label={`View ${name}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          <PlantImage
            src={photo?.src}
            alt={name}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
          />
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold leading-snug tracking-[-0.03em] [overflow-wrap:anywhere]">{name}</h2>
            <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.75} aria-hidden="true" />
          </div>
          {commonName && commonName !== name && (
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{commonName}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            {plant.FAMILY?.trim() && <p className="text-xs text-muted-foreground">{plant.FAMILY}</p>}
            <ConservationBadge status={plant.CONSERVATION_STATUS} />
          </div>
          {photo?.attribution && (
            <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">Photo: {photo.attribution}</p>
          )}
        </div>
      </Link>
      {action && <div className="border-t border-border px-5 py-3">{action}</div>}
    </Card>
  );
}
