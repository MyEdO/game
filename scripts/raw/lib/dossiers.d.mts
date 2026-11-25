// Types de `dossiers.mjs` pour ses consommateurs TypeScript — même convention que `scripts/source/projetLivre.d.mts`.
import type { FicheLue } from '../../../src/data/source/dossier';
export function chargerDossiers(dirs?: string | readonly string[]): FicheLue[];
