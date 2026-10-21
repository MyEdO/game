import type { Site } from './stock.mjs';

/** Un site de réexportation : son fichier, l'instruction repliée, sa ligne (1-based). */
export type SiteDeReexportation = Site & { ligne: number };

/** `rel` est-il sous une zone à zéro ? */
export function enZoneAZero(rel: string): boolean;

/** Le seul module des zones à zéro qui réexporte : la surface du noyau. */
export const PORTE_DU_NOYAU: string;

/** Une réexportation de `rel` est-elle refusée : sous une zone à zéro, hors de `PORTE_DU_NOYAU` ? */
export function estRefusee(rel: string): boolean;

/** Les sites de réexportation de chaque fichier. */
export function sitesDeReexportation(fichiers: Iterable<{ rel: string; text: string }>): SiteDeReexportation[];

/** La mesure du corpus : chemins lus et sites refusés. */
export function mesure(fichiers?: Iterable<{ rel: string; text: string }>): { lus: string[]; sites: SiteDeReexportation[] };
