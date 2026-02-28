// app/page.tsx or pages/index.tsx (simplified example)
"use client"; // Important for App Router client components

import { useEffect, useState } from "react";
import MediaCard from "./components/MediaCard";
import { Plant } from "@/types/Plant";


export default function HomePage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const response = await fetch("/api/plants");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPlants(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlants();
  }, []);

  if (loading) return <p>Loading plants...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <>
      <div className="min-h-screen flex items-center justify-center">
        <div className=" p-10 rounded-xl text-center max-w-2xl w-full">
<h1 className="mb-4 text-4xl font-bold tracking-tight text-heading md:text-5xl lg:text-6xl">Explore <span className="underline underline-offset-3 decoration-8 decoration-brand text-green-600">Native</span> Plants</h1>

          <ul className="border-olive-700 border-1 bg-olive-900 list-none p-6 grid grid-cols-2 gap-6 rounded-md">
            {plants.map((plant) => (
              <li key={plant.PLANT_ID} className="w-full">
                <MediaCard
                  name={`${plant.NAME}`}
                  commonName={plant.COMMON_NAME}
                  photo={`${plant.PHOTOS_FLAT?.split("*")[0]}`}
                  id={plant.PLANT_ID}
                  conservationStatus={plant.CONSERVATION_STATUS}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
