"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlantImage from "./PlantImage";

type ImageGalleryProps = {
  photos: { src: string; attribution?: string }[];
  plantName: string;
};

export default function ImageGallery({ photos, plantName }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeIndex = Math.min(currentIndex, Math.max(0, photos.length - 1));
  const photo = photos[activeIndex];

  return (
    <figure className="min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
        <PlantImage
          src={photo?.src}
          alt={photo ? `${plantName}, photograph ${activeIndex + 1}` : plantName}
          fill
          priority
          sizes="(min-width: 1024px) 680px, (min-width: 640px) 90vw, 100vw"
          className="object-contain"
        />
        {photos.length > 1 && (
          <div className="absolute right-4 bottom-4 z-10 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full bg-card"
              aria-label="Previous plant photograph"
              onClick={() => setCurrentIndex(activeIndex === 0 ? photos.length - 1 : activeIndex - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full bg-card"
              aria-label="Next plant photograph"
              onClick={() => setCurrentIndex(activeIndex === photos.length - 1 ? 0 : activeIndex + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex items-start justify-between gap-4 text-xs leading-5 text-muted-foreground">
        <span className="min-w-0 break-words">
          {photo?.attribution ? `Photo: ${photo.attribution}` : !photo ? "No photograph available" : null}
        </span>
        {photos.length > 1 && (
          <span className="shrink-0 tabular-nums" aria-live="polite" aria-atomic="true">
            {activeIndex + 1} / {photos.length}
          </span>
        )}
      </figcaption>
      {photos.length > 1 && (
        <div className="mt-1 flex flex-wrap justify-center" role="group" aria-label="Choose a plant photograph">
          {photos.map((item, index) => (
            <button
              key={`${item.src}-${index}`}
              type="button"
              aria-label={`View photograph ${index + 1} of ${photos.length}`}
              aria-pressed={activeIndex === index}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => setCurrentIndex(index)}
            >
              <span className={`size-1.5 rounded-full ${activeIndex === index ? "bg-primary" : "bg-border"}`} />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
