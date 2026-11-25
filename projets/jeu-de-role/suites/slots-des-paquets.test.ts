/**
 * Registre des SLOTS sur les paquets livrés (#1466 L1a, volet A) : la RÉCURSION sous un flux de dialogue, que le commun
 * prouve au slot sur son paquet de test (`src/data/slots-contrat.test.ts`), se JOINT ici à une référence observée.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { couplesDeReference, occurrencesTouchees, slotsDuParse, type Slot } from '../../../scripts/docs/lib/slots-registre.mjs';
import { scanDuCorpus } from '../../../scripts/docs/lib/structures-scan.mjs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const { defs, scan } = scanDuCorpus(ROOT, cheminsDesProjetsLivres(ROOT));
const SLOTS = slotsDuParse(scan, defs);
const couple = (dataset: string, champ: string) => couplesDeReference(scan, SLOTS).find((c) => c.dataset === dataset && c.champ === champ);
const slotsAuPath = (dataset: string, path: string) => SLOTS.filter((s) => s.dataset === dataset && s.path === path);
const couplesTouches = (slots: readonly Slot[]) => [...new Set([...occurrencesTouchees(scan, slots)].map((o) => `${o.dataset} | ${o.champ}`))].sort();

describe('registre des SLOTS — les paquets livrés, joints (#1466 L1a, volet A)', () => {
  it('RÉCURSION : un `test.skill` sous un flux de dialogue est un slot (`loup-et-saumure-projet.json › skill`, joint)', () => {
    expect(couplesTouches(slotsAuPath('loup-et-saumure-projet.json', 'scenes[].dialogues[].nodes[].choices[].flow.etapes[].effet.skill.id'))).toEqual([
      'loup-et-saumure-projet.json | skill',
    ]);
    const c = couple('loup-et-saumure-projet.json', 'skill')!;
    expect(c.atteintes).toBe(c.occurrences);
  });
});
