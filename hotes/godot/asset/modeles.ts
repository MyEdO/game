import { validerElement, type ManifesteDElement } from './element.ts';
import { lireGlb } from './glb.ts';
import { cheminsAbsolus, estObjet, ligneDErreur, validerManifeste } from './manifeste.ts';
import { validerManifesteDeBase, type ManifesteDeBase } from './manifesteDeBase.ts';
import type { ManifesteMontable } from './montage';

export type ManifesteDeModele = ManifesteMontable | ManifesteDeBase | ManifesteDElement;
export interface EntreeDeModele { readonly id: string; readonly brut: unknown }
export interface BaseLivree { readonly brut: unknown; readonly octets: Uint8Array }
export type VerdictDeModele = { readonly ok: true; readonly manifeste: ManifesteDeModele } | { readonly ok: false; readonly refus: readonly string[] };

export const estSchema3 = (m: unknown): m is Record<string, unknown> => estObjet(m) && m.schema === 3;
/** Une base porte son squelette (`ManifesteDeBase.os`), champ qu'aucune catégorie d'élément n'admet (`element.ts`). */
export const estBase = (m: unknown): boolean => estSchema3(m) && Object.prototype.hasOwnProperty.call(m, 'os');
const identite = (base: unknown, cle: Record<string, unknown>): string => JSON.stringify([base, Object.entries(cle).sort(([a], [b]) => a.localeCompare(b))]);

/** L'index (base, clé) et les bases, indépendants du nom de fichier et de l'ordre des champs de clé. */
export function indexerModeles(entrees: readonly EntreeDeModele[]): { bases: ReadonlyMap<string, EntreeDeModele>; refus: string[] } {
  const bases = new Map<string, EntreeDeModele>();
  const cles = new Map<string, string>();
  const refus: string[] = [];
  for (const entree of entrees) {
    const m = entree.brut;
    if (!estSchema3(m)) continue;
    if (typeof m.base !== 'string' || !m.base) { refus.push(`[forme] ${entree.id}.base : identité non vide attendue`); continue; }
    if (estBase(m)) {
      const precedente = bases.get(m.base);
      if (precedente) refus.push(`[base-en-doublon] ${m.base} : ${precedente.id}, ${entree.id}`);
      else bases.set(m.base, entree);
    } else if (estObjet(m.cle)) {
      const cle = identite(m.base, m.cle);
      const precedent = cles.get(cle);
      if (precedent) refus.push(`[cle-en-doublon] ${cle} : ${precedent}, ${entree.id}`);
      else cles.set(cle, entree.id);
    }
  }
  for (const { id, brut: m } of entrees) if (estSchema3(m) && !estBase(m) && typeof m.base === 'string' && !bases.has(m.base)) refus.push(`[base-absente] ${id} : ${m.base}`);
  return { bases, refus };
}

/** Un validateur par contrat : personnage schéma 2, base schéma 3, élément schéma 3 contre sa base validée. */
export function validerModele(brut: unknown, octets: Uint8Array, bases: ReadonlyMap<string, BaseLivree> = new Map()): VerdictDeModele {
  try {
    if (!estSchema3(brut)) {
      const v = validerManifeste(brut, lireGlb(octets));
      return v.ok ? v : { ok: false, refus: v.erreurs.map(ligneDErreur) };
    }
    const fuites = cheminsAbsolus(brut, 'manifeste');
    if (fuites.length) return { ok: false, refus: fuites.map(ligneDErreur) };
    if (estBase(brut)) {
      const v = validerManifesteDeBase(brut, octets);
      return v.ok ? v : { ok: false, refus: v.ecarts.map(e => `[${e.code}] ${e.ou} : ${e.detail}`) };
    }
    const base = typeof brut.base === 'string' ? bases.get(brut.base) : undefined;
    if (!base) return { ok: false, refus: [`[base-absente] ${String(brut.base)}`] };
    const vBase = validerManifesteDeBase(base.brut, base.octets);
    if (!vBase.ok) return { ok: false, refus: vBase.ecarts.map(e => `[${e.code}] base ${e.ou} : ${e.detail}`) };
    lireGlb(octets);
    const v = validerElement(brut, vBase.manifeste, octets);
    return v.ok ? v : { ok: false, refus: v.ecarts.map(e => `[${e.code}] ${e.ou} : ${e.detail}`) };
  } catch (e) {
    return { ok: false, refus: [`[glb-illisible] ${e instanceof Error ? e.message : String(e)}`] };
  }
}
