export interface PlantListItem {
  plant_list_item_id: number;
  plant_list_id: number;
  plant_id: string;
  seen_at?: Date; // optional because in Prisma it's nullable

}