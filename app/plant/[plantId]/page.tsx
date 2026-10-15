
import PlantDetail from "@/app/components/PlantDetail";
import { getCatalogPlants } from "@/lib/plant-catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalogPlants().map((plant) => ({ plantId: plant.PLANT_ID }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  return <PlantDetail plantId={plantId} />;
}
