/**
 * #3578 L2a — SENS du Tableau des Classes et Carrières aléatoires, lu sur `careers.json` et
 * `carrieres-aleatoires.json` ensemble (le refine d'un fichier n'en lit aucun autre) :
 *  - une portion (MDG 09 l.9) ne porte que des carrières d'UNE Classe, et l'étendue qu'elle couvre dans sa
 *    colonne ne porte que des carrières d'UNE autre Classe, la Classe remplacée ;
 *  - une carrière d'une variante (AA 02 l.109-128 ; VDM 03 l.17-31) ou qui se choisit à la place d'une autre (ADE I 07 l.11-23 ;
 *    Middenheim 09 l.57 ; AA 05 l.135-140 ; VDM 03 l.11) porte ses `races` (AA 02 l.137 ; ADE I 07 l.11 ; LDB 08 l.1676), qui
 *    l'admettent au tirage.
 */
import { describe, expect, it } from 'vitest';
import careersJson from './careers.json';
import carrieresAleatoiresJson from './carrieres-aleatoires.json';
import { tableDeCarrieres } from './schemas/defs/carrieres-aleatoires';

type Rangee = { id: string; min: number; max: number };
type Colonne = { id: string; kind: string; colonne?: string; carriere?: string; entries: Rangee[] };
type Carriere = { id: string; class: { id: string }; races?: string[]; aLaPlaceDe?: { id: string } };

/** Les écarts de sens de chaque portion de `documents`, nommés. */
function ecartsDeSens(documents: readonly Colonne[], careers: readonly Carriere[]): string[] {
  const classeDe = (id: string) => careers.find((c) => c.id === id)?.class.id;
  const ecarts: string[] = [];
  for (const p of documents.filter((d) => d.kind === 'portion')) {
    const parClasse = [...new Set(p.entries.map((r) => classeDe(r.id)))];
    if (parClasse.length !== 1) {
      ecarts.push(`${p.id} : ses carrières sont de ${parClasse.length} Classes (${parClasse.join(', ')}), une seule attendue`);
      continue;
    }
    const base = documents.find((d) => d.id === p.colonne && d.kind === 'colonne')!;
    const restantes = new Set(tableDeCarrieres(base.entries, p.entries));
    const remplacees = [...new Set(base.entries.filter((r) => !restantes.has(r)).map((r) => classeDe(r.id)))];
    if (remplacees.length !== 1 || remplacees[0] === parClasse[0])
      ecarts.push(`${p.id} : l'étendue remplacée dans « ${base.id} » est de ${remplacees.length} Classe(s) (${remplacees.join(', ')}), une seule autre que « ${parClasse[0]} » attendue`);
  }
  return ecarts;
}

/** Les carrières d'une variante, hors sa carrière détaillée, ou qui portent `aLaPlaceDe`, sans `races`. */
function sansRaces(documents: readonly Colonne[], careers: readonly Carriere[]): string[] {
  const offertes = new Set([
    ...documents.flatMap((d) => (d.kind !== 'variante' ? [] : d.entries.map((r) => r.id).filter((id) => id !== d.carriere))),
    ...careers.filter((c) => c.aLaPlaceDe !== undefined).map((c) => c.id),
  ]);
  return careers.filter((c) => offertes.has(c.id) && !c.races?.length).map((c) => c.id);
}

const DOCUMENTS = carrieresAleatoiresJson as Colonne[];
const CARRIERES = careersJson as Carriere[];

describe('portions du Tableau des Classes et Carrières aléatoires — remplacement d’une Classe (MDG 09 l.9)', () => {
  it('chaque portion est d’une Classe, et remplace une étendue d’une seule autre Classe', () => {
    expect(ecartsDeSens(DOCUMENTS, CARRIERES)).toEqual([]);
  });

  it('nomme une portion à deux Classes', () => {
    const docs = structuredClone(DOCUMENTS);
    docs.find((d) => d.id === 'cotiers-humain')!.entries[0].id = 'batelier';
    expect(ecartsDeSens(docs, CARRIERES)).toEqual([expect.stringMatching(/^cotiers-humain : ses carrières sont de 2 Classes \(riverains, cotiers\)/)]);
  });

  it('nomme une étendue remplacée qui porte une carrière d’une autre Classe', () => {
    const docs = structuredClone(DOCUMENTS);
    docs.find((d) => d.id === 'humain')!.entries.find((r) => r.min === 60)!.id = 'soldat';
    expect(ecartsDeSens(docs, CARRIERES)).toEqual([expect.stringMatching(/^cotiers-humain : l'étendue remplacée dans « humain » est de 2 Classe\(s\) \(guerriers, riverains\)/)]);
  });

  it('nomme une étendue remplacée de la Classe même de la portion', () => {
    const docs = structuredClone(DOCUMENTS);
    const portion = docs.find((d) => d.id === 'cotiers-humain')!;
    const base = docs.find((d) => d.id === 'humain')!;
    const restantes = new Set(tableDeCarrieres(base.entries, portion.entries));
    for (const r of base.entries) if (!restantes.has(r)) r.id = portion.entries[0].id;
    expect(ecartsDeSens(docs, CARRIERES)).toEqual([expect.stringMatching(/^cotiers-humain : l'étendue remplacée dans « humain » est de 1 Classe\(s\) \(cotiers\)/)]);
  });
});

describe('races des carrières offertes en plus du tirage (AA 02 l.109-137 ; ADE I 07 l.11-23)', () => {
  it('toute carrière d’une variante ou qui porte `aLaPlaceDe` a des `races`', () => {
    expect(sansRaces(DOCUMENTS, CARRIERES)).toEqual([]);
  });

  it('nomme une carrière de variante sans `races`, et une carrière à `aLaPlaceDe` sans `races`', () => {
    const carrieres = structuredClone(CARRIERES);
    delete carrieres.find((c) => c.id === 'piquier')!.races;
    delete carrieres.find((c) => c.id === 'gardechamps')!.races;
    expect(sansRaces(DOCUMENTS, carrieres)).toEqual(['gardechamps', 'piquier']);
  });
});

/** Bornes imprimées, `de-à` par colonne, `–` pour une carrière que la colonne ne tire pas. */
const LIVRE: readonly [ref: string, carriere: string, bornes: Record<string, string>][] = [
  ['Middenheim 09 l.15', 'apothicaire', { middenheim: '1-1', middenland: '1-1', nordland: '1-1' }],
  ['Middenheim 09 l.20', 'pretre', { middenheim: '7-11', middenland: '7-11', nordland: '7-10' }],
  ['Middenheim 09 l.46', 'villageois', { middenheim: '50-54', middenland: '46-50', nordland: '44-48' }],
  ['Middenheim 09 l.74', 'frere-loup', { middenheim: '66-68', middenland: '59-60', nordland: '57-58' }],
  ['Middenheim 09 l.75', 'batelier', { middenheim: '–', middenland: '61-62', nordland: '59-60' }],
  ['Middenheim 09 l.80', 'contrebandier', { middenheim: '69-69', middenland: '71-71', nordland: '71-72' }],
  ['Middenheim 09 l.96', 'soldat', { middenheim: '96-99', middenland: '96-99', nordland: '96-99' }],
  ['Middenheim 09 l.97', 'tueur', { middenheim: '–', middenland: '–', nordland: '–' }],
  ['Middenheim 09 l.98', 'pretre-guerrier', { middenheim: '100-100', middenland: '100-100', nordland: '100-100' }],
  ['NADJ 14 l.106', 'juriste', { gnome: '46-46' }],
  ['NADJ 14 l.107', 'erudit', { gnome: '47-48' }],
  ['NADJ 14 l.125', 'mineur', { gnome: '89-96' }],
];

describe('bornes des colonnes Middenheim et Gnome au livre (Middenheim 09 l.13-98 ; NADJ 14 l.81-125)', () => {
  it.each(LIVRE)('%s — %s', (_ref, carriere, bornes) => {
    for (const [colonne, attendu] of Object.entries(bornes)) {
      const rangee = DOCUMENTS.find((d) => d.id === colonne)!.entries.find((r) => r.id === carriere);
      expect(rangee ? `${rangee.min}-${rangee.max}` : '–', colonne).toBe(attendu);
    }
  });
});

/** Second lancer du VDM, `de-à:carrière` par rangée imprimée (VDM 03 l.23-31). */
const SECONDS_LANCERS: readonly [ref: string, carriere: string, rangees: string][] = [
  ['VDM 03 l.26', 'apothicaire', '1-15:alchimiste-ordinaire 16-100:apothicaire'],
  ['VDM 03 l.27', 'sorcier', '1-95:sorcier 96-100:magister-vigilant'],
  ['VDM 03 l.29', 'garde', '1-15:bedeau 16-100:garde'],
  ['VDM 03 l.31', 'mystique', '1-10:devin 11-100:mystique'],
];

describe('variantes du VDM au livre (VDM 03 l.17-31)', () => {
  it.each(SECONDS_LANCERS)('%s — %s', (_ref, carriere, rangees) => {
    const variante = DOCUMENTS.find((d) => d.kind === 'variante' && d.carriere === carriere);
    expect(variante, `aucune variante de « ${carriere} »`).toBeDefined();
    expect(variante!.entries.map((r) => `${r.min}-${r.max}:${r.id}`).join(' ')).toBe(rangees);
  });
});
