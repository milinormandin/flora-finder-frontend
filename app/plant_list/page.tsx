"use client";

import { useEffect, useState } from "react";
import { Plant } from "@/types/Plant";
import RemoveFromListButton from "../components/RemoveFromListButton";
import { Card, CardContent, CardMedia, Typography, Box, Chip } from "@mui/material";
import Link from "next/link";

export default function Page() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlants = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plantList");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setPlants(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  if (loading) return <p className="text-center mt-10 text-lg text-gray-200">Loading plants...</p>;
  if (error) return <p className="text-center mt-10 text-red-400">Error: {error}</p>;

  return (
<div className="min-h-screen bg-olive-900 p-8">
  {/* Title + Plant Count */}
  <div className="text-center mb-6">
    <h1 className="text-3xl font-bold text-white">
      My Plant List
    </h1>
    <p className="text-gray-300 mt-1">
      {plants.length} {plants.length === 1 ? "plant" : "plants"} in your list
    </p>
  </div>

  {/* Plant Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {plants.map((plant) => (
      <Card
        key={plant.PLANT_ID}
        className="bg-olive-800 text-white shadow-lg hover:scale-105 transition-transform duration-200 flex flex-col"
        sx={{ height: 250 }}
      >
        {/* Plant Image */}
        <CardMedia
          component="img"
          image={plant.PHOTOS_FLAT?.split('*')[0] || "/placeholder-plant.jpg"}
          alt={plant.NAME}
          sx={{ height: 120, objectFit: 'cover' }}
        />

        {/* Content */}
        <CardContent className="flex flex-col flex-1 gap-1 p-2 overflow-hidden">
          <Typography variant="subtitle1" className="font-bold truncate">
            <Link href={`/plant/${plant.PLANT_ID}`}>{plant.NAME}</Link>
          </Typography>
          <Typography variant="body2" className="text-gray-300 italic truncate">
            {plant.COMMON_NAME}
          </Typography>

          <Box className="mt-auto flex items-center justify-between">
            <Chip
              label={plant.CONSERVATION_STATUS || "Unknown"}
              color={
                plant.CONSERVATION_STATUS === "Endangered"
                  ? "error"
                  : plant.CONSERVATION_STATUS === "Vulnerable"
                  ? "warning"
                  : "success"
              }
              size="small"
            />
            <RemoveFromListButton id={plant.PLANT_ID} onRemoved={fetchPlants} />
          </Box>
        </CardContent>
      </Card>
    ))}
  </div>
</div>
  );
}