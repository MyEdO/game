// Types des poses des objets rangés et de la tenue d'un preset : mêmes signatures que posesDesRanges.mjs.

import type { PorteeDeComposition } from '../../../src/noyau/index';

export function manifesteVoisin(glb: string): string | undefined;

export function silhouettesSousLePreset(preset: string, silhouettes?: Record<string, number>): Promise<Record<string, number>>;

export function lireLocales(paires?: readonly string[]): Record<string, string>;

export function porteeDuPreset(preset: string): Promise<PorteeDeComposition>;

export function tenueDesGlb(demande: { manifeste: string; portee: PorteeDeComposition; locales?: Record<string, string> }): Promise<string[]>;

type Instant = { gabarit?: unknown; morphes: Record<string, number>; clip: string; t: number };
type Pose = number[] | null;

export function montageDesElements(demande: { base: string; manifeste: string; elements: readonly string[]; portee: PorteeDeComposition }): Promise<{
  modeles: unknown; montes: unknown[]; fichiers: Record<string, string>;
  lignes: (string | undefined)[]; palettes: Record<string, string>[]; sans: string[];
}>;

export function posesDesRanges(demande: { base: string; manifeste: string; elements: readonly string[]; preset: string; instants: readonly Instant[] }): Promise<{
  elements: ({ ligne: string; meshes: Record<string, Pose[]>; offrants: number[]; os: string } | null)[];
  palettes: Record<string, string>[];
  sans: string[];
}>;

export function posesALInstant(demande: {
  base: string; manifeste: string; elements: readonly string[]; preset: string;
  facteurs?: Record<string, number>; silhouettes?: Record<string, number>; clip?: string; t?: number;
}): Promise<{ elements: ({ ligne: string; meshes: Record<string, Pose> } | null)[]; palettes: Record<string, string>[]; sans: string[]; silhouettes: Record<string, number> }>;
