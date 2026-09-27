/* eslint-disable no-irregular-whitespace */
/**
 * Surface TYPÉE de `gen-registry.mjs` consommée par les gardes (`src/**​/*.test.ts`) et par la phase 2
 * (`scripts/gen-espaces.mts`) — le générateur reste écrit en `.mjs` (il tourne sous `node` nu, hors chaîne TS).
 */
export function genAll(verbose?: boolean, options?: { check?: boolean }): void;
/** Les sorties de la PHASE 2 (`scripts/gen-espaces.mts`). */
export const SORTIES_DES_ESPACES: { readonly ids: string; readonly cles: string; readonly racines: string };
/** Tous les fichiers que ce générateur écrit EN ENTIER, phase 2 comprise. */
export const SORTIES: readonly string[];
/** Le rouge d'un registre périmé en `--check`. */
export function MESSAGES_DE(out: string): { staleMsg: string; rerunMsg: string };
/** Exports de premier niveau d'un def, lus à leur forme canonique — lève sur toute autre forme. */
export function lireExports(src: string, noms: readonly string[], def: string): Record<string, string | true | undefined>;
export function lireDefs(dir: string, noms: readonly string[]): ({ module: string } & Record<string, string | true | undefined>)[];
/** Projection d'un registre de defs (option `projection`) : `[id]` ou `[id, valeur de champ]`, triés — lève par def fautif. */
export function projeterDefs(dir: string, projection: { nom: string; champ?: string }): string[][];
