/**
 * #3578 L2a — SENS du Tableau des Classes et Carrières aléatoires, lu sur `careers.json` et
 * `carrieres-aleatoires.json` ensemble (le refine d'un fichier n'en lit aucun autre) :
 *  - une portion (MDG 09 l.9) ne porte que des carrières d'UNE Classe, et l'étendue qu'elle couvre dans sa
 *    colonne ne porte que des carrières d'UNE autre Classe, la Classe remplacée ;
 *  - une carrière d'une variante (AA 02 l.109-128) ou qui se choisit à la place d'une autre (ADE I 07 l.11-23)
 *    porte ses `races` (AA 02 l.137 ; ADE I 07 l.11), qui l'admettent au tirage.
 */
import { describe, expect, it } from 'vitest';
import careersJson from './careers.json';
import carrieresAleatoiresJson from './carrieres-aleatoires.json';
import { tableDeCarrieres } from './schemas/defs/carrieres-aleatoires';

type Rangee = { id: string; min: number; max: number };
type Colonne = { id: string; colonne?: string; carriere?: string; entries: Rangee[] };
type Carriere = { id: string; class: { id: string }; races?: string[]; aLaPlaceDe?: string };

/** Les écarts de sens de chaque portion de `documents`, nommés. */
function ecartsDeSens(documents: readonly Colonne[], careers: readonly Carriere[]): string[] {
  const classeDe = (id: string) => careers.find((c) => c.id === id)?.class.id;
  const ecarts: string[] = [];
  for (const p of documents.filter((d) => d.colonne !== undefined)) {
    const parClasse = [...new Set(p.entries.map((r) => classeDe(r.id)))];
    if (parClasse.length !== 1) {
      ecarts.push(`${p.id} : ses carrières sont de ${parClasse.length} Classes (${parClasse.join(', ')}), une seule attendue`);
      continue;
    }
    const base = documents.find((d) => d.id === p.colonne && d.colonne === undefined)!;
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
    ...documents.flatMap((d) => (d.carriere === undefined ? [] : d.entries.map((r) => r.id).filter((id) => id !== d.carriere))),
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
