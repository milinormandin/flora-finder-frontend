
import PlantDetail from "@/app/components/PlantDetail"

export default async function Page({
  params,
}: {
  params: Promise<{ plantId: string }>
}) {
  const { plantId } = await params
  return (<PlantDetail plantId={plantId}/>)
}


