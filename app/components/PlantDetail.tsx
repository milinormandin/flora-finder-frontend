"use client";

import { useState, useEffect } from "react";
import { Plant } from "@/types/Plant";
import ImageGallery from "./ImageGallery";
import AccordionExpand from "./AccordionExpand";
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Divider
} from "@mui/material";
import SpaIcon from "@mui/icons-material/Spa";
import NatureIcon from "@mui/icons-material/Nature";
import PublicIcon from "@mui/icons-material/Public";
import { PlaceRounded } from "@mui/icons-material";
import AddToListButton from "./AddToListButton";


export default function PlantDetail({ plantId }: { plantId: string }) {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;

    const fetchPlant = async () => {
      try {
        const res = await fetch(`/api/plant?plantId=${plantId}`);
        if (!res.ok) {
          throw new Error(`Error fetching plant: ${res.statusText}`);
        }
        const data = await res.json();
        setPlant(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlant();
  }, [plantId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!plant) return <p>No plant found.</p>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <ImageGallery
          images={plant.PHOTOS_FLAT?.split("*")}
          attributions={plant.PHOTOS_ATTRIBUTION_FLAT?.split("*")}
        />

<div className="mt-6 flex items-center justify-center space-x-2">
  <h1 className="text-4xl font-bold text-heading px-2">
    {plant.NAME}
  </h1>

<AddToListButton id={plant.PLANT_ID}/>
</div>

<p className="text-slate-500 font-medium text-2xl text-center mt-2">
  {plant.COMMON_NAME}
</p>

        {(plant.FAMILY ||
          plant.CONSERVATION_STATUS ||
          plant.NATIVE_STATUS ||
          plant.NATURAL_RANGE) && (
          <Card
            elevation={3}
            sx={{
              mt: 4,
              backgroundColor: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(8px)",
              borderRadius: 3
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                {plant.FAMILY && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SpaIcon color="success" />
                    <Typography variant="body1">
                      <strong>Family:</strong> {plant.FAMILY}
                    </Typography>
                  </Stack>
                )}

                {plant.CONSERVATION_STATUS && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <NatureIcon color="warning" />
                    <Typography variant="body1">
                      <strong>Conservation Status:</strong>{" "}
                      {plant.CONSERVATION_STATUS}
                    </Typography>
                  </Stack>
                )}

                {plant.NATIVE_STATUS && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PublicIcon color="info" />
                    <Typography variant="body1">
                      <strong>Native Status:</strong> {plant.NATIVE_STATUS}
                    </Typography>
                  </Stack>
                )}

                {plant.NATURAL_RANGE && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PlaceRounded color="secondary" />
                    <Typography variant="body1">
                      <strong>Island:</strong> {plant.NATURAL_RANGE}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        <div className="mt-6">
          <AccordionExpand
            title="General Information"
            content={plant.GENERAL_INFORMATION}
          />
          <AccordionExpand
            title="Habitat"
            content={plant.ADDITIONAL_HABITAT_INFORMATION}
          />
          <AccordionExpand title="Modern Use" content={plant.MODERN_USE} />
          <AccordionExpand
            title="Early Hawaiian Use"
            content={plant.EARLY_HAWAIIAN_USE}
          />
        </div>
      </div>
    </div>
  );
}
