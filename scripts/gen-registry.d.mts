/* eslint-disable no-irregular-whitespace */
/**
 * Surface TYPÉE de `gen-registry.mjs` consommée par les gardes (`src/**​/*.test.ts`).
 */
export function rendre(): Promise<Map<string, string>>;
/** Exports de premier niveau d'un def, lus à leur forme canonique — lève sur toute autre forme. */
export function lireExports(src: string, noms: readonly string[], def: string): Record<string, string | true | undefined>;
export function lireDefs(dir: string, noms: readonly string[]): ({ module: string } & Record<string, string | true | undefined>)[];
/** Vocabulaire d'art d'un registre (option `vocabulaire`) : `{ id: libellé }` de ses defs. */
export function vocabulaireDuRegistre(dir: string, vocabulaire: { readonly id: string; readonly libelle: string }): Record<string, string>;
