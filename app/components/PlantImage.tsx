"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const placeholder = "/plant-placeholder.svg";

function imageSource(src?: string | null) {
  const value = src?.trim();
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

type PlantImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

export default function PlantImage({
  src,
  alt,
  className,
  fill = false,
  sizes,
  priority = false,
}: PlantImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const requestedSource = imageSource(src);
  const source = requestedSource && requestedSource !== failedSource ? requestedSource : placeholder;

  return (
    <Image
      src={source}
      alt={source === placeholder ? `Botanical illustration. Photograph unavailable for ${alt}.` : alt}
      fill={fill}
      width={fill ? undefined : 1000}
      height={fill ? undefined : 750}
      sizes={sizes}
      priority={priority}
      unoptimized={source.startsWith("http") || source.endsWith(".svg")}
      className={cn("object-cover", className)}
      onError={() => {
        if (source !== placeholder) setFailedSource(source);
      }}
    />
  );
}
