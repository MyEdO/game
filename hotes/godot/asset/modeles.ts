import { emplacementsNonOfferts, validerElement, type ManifesteDElement } from './element.ts';
import { lireGlb } from './glb.ts';
import { estObjet } from '../../../src/hote/formes';
import { cheminsAbsolus, ligneDErreur, validerManifeste } from './manifeste.ts';
import { validerManifesteDeBase, type ManifesteDeBase } from './manifesteDeBase.ts';
import type { ManifesteMontable } from './montage';

export type ManifesteDeModele = ManifesteMontable | ManifesteDeBase | ManifesteDElement;
export interface EntreeDeModele { readonly id: string; readonly brut: unknown }
export interface BaseLivree { readonly brut: unknown; readonly octets: Uint8Array }
export type VerdictDeModele = { readonly ok: true; readonly manifeste: ManifesteDeModele } | { readonly ok: false; readonly refus: readonly string[] };

/** Les fichiers du modèle `id` dans le projet : le GLB (tiré de la Release, ignoré de git), le manifeste et la provenance (commités). */
export const fichiersDuModele = (id: string) => ({ glb: `${id}.glb`, manifeste: `${id}.manifeste.json`, provenance: `${id}.provenance.json` });

export const estSchema3 = (m: unknown): m is Record<string, unknown> => estObjet(m) && m.schema === 3;
/** Une base porte son squelette (`ManifesteDeBase.os`), champ qu'aucune catégorie d'élément n'admet (`element.ts`). */
export const estBase = (m: unknown): boolean => estSchema3(m) && Object.prototype.hasOwnProperty.call(m, 'os');
const identite = (base: unknown, cle: Record<string, unknown>): string => JSON.stringify([base, Object.entries(cle).sort(([a], [b]) => a.localeCompare(b))]);

/** L'index (base, clé) → élément et les bases, indépendants du nom de fichier et de l'ordre des champs de clé. `refus`
 *  bloque l'import et la Release ; `rapport` ne bloque rien, et son élément sort de `elements` (`emplacementsNonOfferts`). */
export function indexerModeles(entrees: readonly EntreeDeModele[]): { bases: ReadonlyMap<string, EntreeDeModele>; elements: ReadonlyMap<string, EntreeDeModele>; refus: string[]; rapport: string[] } {
  const bases = new Map<string, EntreeDeModele>();
  const cles = new Map<string, EntreeDeModele>();
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
      if (precedent) refus.push(`[cle-en-doublon] ${cle} : ${precedent.id}, ${entree.id}`);
      else cles.set(cle, entree);
    }
  }
  for (const { id, brut: m } of entrees) if (estSchema3(m) && !estBase(m) && typeof m.base === 'string' && !bases.has(m.base)) refus.push(`[base-absente] ${id} : ${m.base}`);
  const nonOfferts = emplacementsNonOfferts(new Map([...bases].map(([base, e]) => [base, e.brut])), [...cles.values()]);
  const rapportes = new Set(nonOfferts.map(({ id }) => id));
  const elements = new Map([...cles].filter(([, e]) => !rapportes.has(e.id)));
  return { bases, elements, refus, rapport: nonOfferts.map(({ ligne }) => ligne) };
}

/** Le verdict (`validerModele`) de chaque entrée dont `octets` porte le GLB, les bases d'abord : un élément se valide
 *  contre la base de `entrees` qui a ses octets. */
export function verdictsDesModeles(entrees: readonly EntreeDeModele[], octets: ReadonlyMap<string, Uint8Array>): { readonly id: string; readonly brut: unknown; readonly verdict: VerdictDeModele }[] {
  const livrees = entrees.flatMap((e) => { const o = octets.get(e.id); return o ? [{ ...e, octets: o }] : []; });
  const bases = new Map<string, BaseLivree>();
  for (const { brut, octets: o } of livrees) if (estBase(brut)) bases.set(String((brut as Record<string, unknown>).base), { brut, octets: o });
  return livrees.sort((a, b) => Number(estBase(b.brut)) - Number(estBase(a.brut))).map(({ id, brut, octets: o }) => ({ id, brut, verdict: validerModele(brut, o, bases) }));
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
    const v = validerElement(brut, vBase.manifeste, octets, lireGlb(octets));
    return v.ok ? v : { ok: false, refus: v.ecarts.map(e => `[${e.code}] ${e.ou} : ${e.detail}`) };
  } catch (e) {
    return { ok: false, refus: [`[glb-illisible] ${e instanceof Error ? e.message : String(e)}`] };
  }
}
