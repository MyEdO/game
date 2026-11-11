import { emplacementsNonOfferts, estSansBase, validerElement, type ManifesteDElement, type VerdictDElement } from './element.ts';
import { lireGlb } from './glb.ts';
import { estObjet } from '../../../src/lib/objet.mjs';
import { cheminsAbsolus, ligneDErreur } from './manifeste.ts';
import { validerManifesteDeBase, type ManifesteDeBase, type VerdictDeBase } from './manifesteDeBase.ts';
import { ecartsDeClips, ecartsDesPrisesOccupees, ecartsDesTablesDeuxMains } from './clips.ts';

export type ManifesteDeModele = ManifesteDeBase | ManifesteDElement;
export interface EntreeDeModele { readonly id: string; readonly brut: unknown }
export interface BaseLivree { readonly brut: unknown; readonly octets: Uint8Array }
export type VerdictDeModele = { readonly ok: true; readonly manifeste: ManifesteDeModele } | { readonly ok: false; readonly refus: readonly string[] };

/** Les fichiers du modèle `id` : dans le projet, le GLB (tiré de la Release, ignoré de git), le manifeste et la provenance
 *  (commités) ; à l'export, la scène que Godot fabrique du GLB (`hotes/godot/listage.mjs`, `deposerLesModeles`). */
export const fichiersDuModele = (id: string) => ({ glb: `${id}.glb`, manifeste: `${id}.manifeste.json`, provenance: `${id}.provenance.json`, scene: `${id}.scn` });

/** Une base porte son squelette (`ManifesteDeBase.os`), champ qu'aucune catégorie d'élément n'admet (`element.ts`). */
export const estBase = (m: unknown): boolean => estObjet(m) && Object.prototype.hasOwnProperty.call(m, 'os');
const identite = (base: unknown, cle: Record<string, unknown>): string => JSON.stringify([base ?? null, Object.entries(cle).sort(([a], [b]) => a.localeCompare(b))]);

/** L'index (base, clé) → élément et les bases, indépendants du nom de fichier et de l'ordre des champs de clé ; un
 *  élément sans base (`estSansBase`) s'y range sous sa seule clé. `refus` bloque l'import et la Release ; `rapport` ne
 *  bloque rien, et son élément sort de `elements` (`emplacementsNonOfferts`). */
export function indexerModeles(entrees: readonly EntreeDeModele[]): { bases: ReadonlyMap<string, EntreeDeModele>; elements: ReadonlyMap<string, EntreeDeModele>; refus: string[]; rapport: string[] } {
  const bases = new Map<string, EntreeDeModele>();
  const cles = new Map<string, EntreeDeModele>();
  const refus: string[] = [];
  for (const entree of entrees) {
    const m = entree.brut;
    if (!estObjet(m) || (!estSansBase(m) && (typeof m.base !== 'string' || !m.base))) { refus.push(`[forme] ${entree.id}.base : identité non vide attendue`); continue; }
    if (estBase(m)) {
      const nom = String(m.base);
      const precedente = bases.get(nom);
      if (precedente) refus.push(`[base-en-doublon] ${nom} : ${precedente.id}, ${entree.id}`);
      else bases.set(nom, entree);
    } else if (estObjet(m.cle)) {
      const cle = identite(m.base, m.cle);
      const precedent = cles.get(cle);
      if (precedent) refus.push(`[cle-en-doublon] ${cle} : ${precedent.id}, ${entree.id}`);
      else cles.set(cle, entree);
    }
  }
  for (const { id, brut: m } of entrees) if (estObjet(m) && !estBase(m) && !estSansBase(m) && typeof m.base === 'string' && !bases.has(m.base)) refus.push(`[base-absente] ${id} : ${m.base}`);
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

/** La base `brut` jugée contre son GLB `octets` : son schéma (`validerManifesteDeBase`), puis ses tables rôle → clip
 *  (`ecartsDeClips`, `ecartsDesTablesDeuxMains`) et les clips de ses prises occupées (`ecartsDesPrisesOccupees`). */
function validerBase(brut: unknown, octets: Uint8Array): VerdictDeBase {
  const v = validerManifesteDeBase(brut, octets);
  if (!v.ok) return v;
  const { animations } = lireGlb(octets);
  const ecarts = [...ecartsDeClips(v.manifeste.clips, animations), ...ecartsDesTablesDeuxMains(v.manifeste.clipsDeuxMains ?? {}, animations),
    ...ecartsDesPrisesOccupees(v.manifeste.prisesOccupees ?? {}, animations)];
  return ecarts.length ? { ok: false, ecarts } : v;
}

/** L'élément jugé (`validerElement`), puis sa table rôle → clip s'il en porte une (`ecartsDeClips`). */
function verdictDElement(v: VerdictDElement, octets: Uint8Array): VerdictDeModele {
  if (!v.ok) return { ok: false, refus: v.ecarts.map((e) => `[${e.code}] ${e.ou} : ${e.detail}`) };
  const clips = 'clips' in v.manifeste ? v.manifeste.clips : undefined;
  const ecarts = clips ? ecartsDeClips(clips, lireGlb(octets).animations) : [];
  return ecarts.length ? { ok: false, refus: ecarts.map((e) => `[${e.code}] ${e.ou} : ${e.detail}`) } : v;
}

/** Un validateur par contrat : base au schéma `VERSION_DU_SCHEMA_DE_BASE`, élément schéma 3 contre sa base validée, ou
 *  seul s'il est sans base (`estSansBase`). */
export function validerModele(brut: unknown, octets: Uint8Array, bases: ReadonlyMap<string, BaseLivree> = new Map()): VerdictDeModele {
  try {
    const fuites = cheminsAbsolus(brut, 'manifeste');
    if (fuites.length) return { ok: false, refus: fuites.map(ligneDErreur) };
    if (estBase(brut)) {
      const v = validerBase(brut, octets);
      return v.ok ? v : { ok: false, refus: v.ecarts.map(e => `[${e.code}] ${e.ou} : ${e.detail}`) };
    }
    if (estSansBase(brut)) return verdictDElement(validerElement(brut, null, octets, lireGlb(octets)), octets);
    const nom = estObjet(brut) ? brut.base : undefined;
    const base = typeof nom === 'string' ? bases.get(nom) : undefined;
    if (!base) return { ok: false, refus: [`[base-absente] ${String(nom)}`] };
    const vBase = validerBase(base.brut, base.octets);
    if (!vBase.ok) return { ok: false, refus: vBase.ecarts.map(e => `[${e.code}] base ${e.ou} : ${e.detail}`) };
    return verdictDElement(validerElement(brut, vBase.manifeste, octets, lireGlb(octets)), octets);
  } catch (e) {
    return { ok: false, refus: [`[glb-illisible] ${e instanceof Error ? e.message : String(e)}`] };
  }
}
