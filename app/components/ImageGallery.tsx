// ImageGallery.tsx
"use client";

import { useState } from "react";
import { IconButton } from "@mui/material";
import { ArrowBackIos, ArrowForwardIos } from "@mui/icons-material";

interface ImageGalleryProps {
  images: string[] | undefined;
  attributions?: string[] | undefined;
}

export default function ImageGallery({
  images,
  attributions = [],
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  if (!images || images.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Gallery Row */}
      <div className="flex items-center justify-center gap-4">
        
        {/* Left Arrow */}
        <IconButton
          onClick={handlePrev}
          className="text-white bg-black bg-opacity-50 hover:bg-opacity-75"
        >
          <ArrowBackIos />
        </IconButton>

        {/* Image Wrapper */}
        <div className="relative flex-1">
          <img
            src={images[currentIndex]}
            alt={`Gallery ${currentIndex + 1}`}
            className="w-full h-64 sm:h-96 object-contain rounded-lg shadow-md"
          />

          {/* Attribution */}
          {attributions[currentIndex] && (
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
              {attributions[currentIndex]}
            </div>
          )}
        </div>

        {/* Right Arrow */}
        <IconButton
          onClick={handleNext}
          className="text-white bg-black bg-opacity-50 hover:bg-opacity-75"
        >
          <ArrowForwardIos />
        </IconButton>

      </div>

      {/* Indicator Dots */}
      <div className="flex justify-center mt-3 space-x-2">
        {images.map((_, idx) => (
          <span
            key={idx}
            className={`w-2 h-2 rounded-full ${
              idx === currentIndex ? "bg-olive-500" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}