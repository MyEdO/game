/**
 * CONTRAT DE DONNÉE du catalogue de spécialisations (#1466 L1a, #1897) — ce que l'INDEX DES IDS
 * (`IDS_PAR_ESPACE`, espace `<fichier>#[<id>].specs`, `npm run gen`) expose doit être CE QUE L'APPLICATION ADMET, et la donnée authorée doit y tenir.
 *
 *  1. une entrée à `specsSource` expose l'UNIVERS de sa source (`SOURCES_DE_SPECS`, déclaration unique
 *     lue par le générateur et par `SPEC_SOURCES`), qui contient son POOL de choix : un statbloc porte
 *     une spécialisation réelle hors du pool joueur (le Triton, `MDG 16 l.283`) ;
 *  2. toute spécialisation AUTHORÉE sur une entrée FERMÉE à `specsSource` appartient à cet univers —
 *     donc passe `specRef`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import { entreeOuverte, specRef, type TypeEntite } from './ref';
import { skills, talents, traits, creatures, specCatalogOf, specResolves } from '../../index';

const DATASETS: { fichier: string; type: TypeEntite; entrees: { id: string; specsSource?: string }[] }[] = [
  { fichier: 'skills.json', type: 'skill', entrees: skills as never },
  { fichier: 'talents.json', type: 'talent', entrees: talents as never },
  { fichier: 'traits.json', type: 'trait', entrees: traits as never },
];

describe('catalogue de spécialisations — le registre généré et le catalogue applicatif s’accordent', () => {
  it('une entrée à `specsSource` expose l’UNIVERS de sa source : il contient le pool, et chacun de ses ids résout', () => {
    let compares = 0;
    for (const { fichier, entrees } of DATASETS) {
      for (const e of entrees) {
        if (!e.specsSource) continue;
        compares++;
        const genere = IDS_PAR_ESPACE[`${fichier}#[${e.id}].specs`] ?? [];
        expect(genere.length, `${fichier} « ${e.id} »`).toBeGreaterThan(0);
        expect(specCatalogOf(e as never).filter((id) => !genere.includes(id)), `${fichier} « ${e.id} » : pool hors univers`).toEqual([]);
        expect(genere.filter((id) => !specResolves(e as never, id)), `${fichier} « ${e.id} » : univers non résolu`).toEqual([]);
      }
    }
    expect(compares).toBeGreaterThan(0);
  });

  it('le Triton (`MDG 16 l.283`) focalise « magie-des-mers-de-triton », hors du pool des Vents : admis ; une spec hors univers est refusée', () => {
    const triton = (creatures as unknown as { id: string; skills: { id: string; spec?: string }[] }[]).find((c) => c.id === 'triton')!;
    const focalisation = triton.skills.find((s) => s.id === 'focalisation')!;
    expect(focalisation.spec).toBe('magie-des-mers-de-triton');
    expect(specCatalogOf(skills.find((s) => s.id === 'focalisation')!)).not.toContain(focalisation.spec);
    expect(specRef('skill').safeParse({ id: 'focalisation', spec: focalisation.spec }).success).toBe(true);
    expect(specRef('skill').safeParse({ id: 'focalisation', spec: 'plate' }).success).toBe(false);
    expect(specRef('skill').safeParse({ id: 'corps-a-corps', spec: 'plate' }).success).toBe(false);
  });

  it('rend le MÊME catalogue que `specCatalogOf` pour une entrée à `specs[]` inline', () => {
    for (const { fichier, entrees } of DATASETS) {
      for (const e of entrees) {
        if (e.specsSource) continue;
        const applicatif = [...specCatalogOf(e as never)].sort();
        if (!applicatif.length) continue;
        expect([...(IDS_PAR_ESPACE[`${fichier}#[${e.id}].specs`] ?? [])].sort(), `${fichier} « ${e.id} »`).toEqual(applicatif);
      }
    }
  });
});

/** Paires `{ id, spec }` authorées, à toute profondeur, dans les datasets de `src/data`. */
function paitesAuthorees(): Map<string, Set<string>> {
  const R = 'src/data';
  const trouves = new Map<string, Set<string>>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      const o = v as { id?: unknown; spec?: unknown };
      if (typeof o.id === 'string' && typeof o.spec === 'string') {
        if (!trouves.has(o.id)) trouves.set(o.id, new Set());
        trouves.get(o.id)!.add(o.spec);
      }
      Object.values(v).forEach(walk);
    }
  };
  for (const f of listerDossier(R).filter((x) => x.endsWith('.json'))) {
    try { walk(JSON.parse(readFileSync(`${R}/${f}`, 'utf8'))); } catch { /* dataset illisible : couvert ailleurs */ }
  }
  return trouves;
}

describe('pool DÉRIVÉ — la donnée authorée passe la porte `specRef`', () => {
  const authorees = paitesAuthorees();

  /** Ids portés par PLUSIEURS datasets (Talent « haine » et Trait « haine ») : une paire `{id, spec}`
   *  brute ne dit pas lequel elle vise, la mesure serait ambiguë. La désambiguïsation par slot est le
   *  lot L2 (`ActorRef`/graphies historiques, #1463). */
  const homonymes = new Set(
    DATASETS.flatMap(({ entrees }) => entrees.map((e) => e.id)).filter((id, i, tous) => tous.indexOf(id) !== i),
  );

  it('toute spec authorée sur une entrée FERMÉE à `specsSource` appartient à l’univers exposé', () => {
    const rejets: string[] = [];
    let verifiees = 0;
    for (const { fichier, type, entrees } of DATASETS) {
      for (const e of entrees) {
        if (!e.specsSource || homonymes.has(e.id) || entreeOuverte(type, e.id)) continue;
        const pool = IDS_PAR_ESPACE[`${fichier}#[${e.id}].specs`] ?? [];
        for (const spec of authorees.get(e.id) ?? []) {
          verifiees++;
          if (!pool.includes(spec)) rejets.push(`${fichier} ${e.id} :: « ${spec} » (pool=${pool.length})`);
        }
      }
    }
    expect(verifiees).toBeGreaterThan(0);
    expect(rejets).toEqual([]);
  });

  it('les 4 Talents à pool dérivé passent `specRef(\'talent\')` avec leurs specs réelles', () => {
    for (const id of ['magie-des-arcanes', 'beni', 'invocation', 'magie-du-chaos']) {
      const specs = [...(authorees.get(id) ?? [])];
      expect(specs.length, `aucune spec authorée pour « ${id} »`).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(specRef('talent').safeParse({ id, spec }).success, `${id} :: ${spec}`).toBe(true);
      }
    }
  });
});
