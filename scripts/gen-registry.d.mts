/* eslint-disable no-irregular-whitespace */
/**
 * Surface TYPÉE de `gen-registry.mjs` consommée par les gardes (`src/**​/*.test.ts`) — le générateur
 * reste écrit en `.mjs` (il tourne sous `node` nu, hors chaîne TS).
 */
export function genAll(verbose?: boolean): void;
/** Exports de premier niveau d'un def, lus à leur forme canonique — lève sur toute autre forme. */
export function lireExports(src: string, noms: readonly string[], def: string): Record<string, string | true | undefined>;
export function lireDefs(dir: string, noms: readonly string[]): ({ module: string } & Record<string, string | true | undefined>)[];
/** Projection d'un registre de defs (option `projection`) : `[id]` ou `[id, valeur de champ]`, triés — lève par def fautif. */
export function projeterDefs(dir: string, projection: { nom: string; champ?: string }): string[][];
