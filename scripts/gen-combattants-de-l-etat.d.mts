/**
 * Surface TYPÉE de `gen-combattants-de-l-etat.mjs` consommée par sa garde (`src/noyau/combattantsDeLEtat.test.ts`) — le
 * générateur reste écrit en `.mjs` (il tourne sous `node` nu, hors chaîne TS).
 */
import type { SessionProgramme } from './guards/lib/tsProgram.mjs';

/** Le type racine et le type cherché, chacun dans son module. */
export const ETAT: { readonly module: string; readonly type: string };
export const COMBATTANT: { readonly module: string; readonly type: string };
/** Les chemins (listes de pas) de `EtatDeJeu` qui atteignent un `Combatant`, triés. */
export function cheminsDesCombattants(racine?: string): string[][];
/** `cheminsDesCombattants` sur une session ouverte, dont `racine` porte `src/noyau/etat.ts` et `src/engine/types.ts`. */
export function cheminsDeLaSession(session: SessionProgramme, racine: string): string[][];
/** Contrat `rendre()` de `GENERATORS` : cible → texte, sans écrire. */
export function rendre(): Map<string, string>;
