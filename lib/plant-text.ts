export function normalizePlantText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['\u02bb\u02bc\u2018\u2019\u201b]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
