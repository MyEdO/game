export type SiteForme = { concept: string; dataset: string; champ: string; signature: string };
export type SiteSlot = { dataset: string; champ: string };
export function siteDeForme(f: SiteForme): string;
export function siteDeSlot(s: SiteSlot): string;
type CollectionOccurrences<T extends { occurrences: number }> = {
  texte: string; rel: string; nom: string; observe: readonly T[]; stock: readonly T[]; site: (e: T) => string;
};
export function actualiserOccurrences(collections: readonly (
  CollectionOccurrences<SiteForme & { occurrences: number }> | CollectionOccurrences<SiteSlot & { occurrences: number }>
)[]): { rel: string; texte: string; changements: string[] }[];
