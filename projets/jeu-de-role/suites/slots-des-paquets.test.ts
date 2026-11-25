/**
 * Registre des SLOTS sur les paquets livrés (#1466 L1a, volet A) : les branches que le commun prouve sur son
 * paquet de test (`src/data/slots-contrat.test.ts`) se JOIGNENT ici au scan des paquets du jeu.
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
  it('branche LISTE d’ids nus (`arene-projet.json › tiles`) : chaque liste est UNE occurrence, atteinte par ses éléments', () => {
    expect(couplesTouches(slotsAuPath('arene-projet.json', 'scenes[].layers[].tiles[]'))).toContain('arene-projet.json | tiles');
    const c = couple('arene-projet.json', 'tiles')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('RÉCURSION : un `test.skill` sous un flux de dialogue est un slot (`loup-et-saumure-projet.json › skill`, joint)', () => {
    expect(couplesTouches(slotsAuPath('loup-et-saumure-projet.json', 'scenes[].dialogues[].nodes[].choices[].flow.etapes[].effet.skill.id'))).toEqual([
      'loup-et-saumure-projet.json | skill',
    ]);
    const c = couple('loup-et-saumure-projet.json', 'skill')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('CORPS DE DÉCOR : la branche `prop` de `sceneEntitySchema` porte `ref(\'prop\')` (`diligence-projet.json › decor`, joint)', () => {
    expect(new Set(slotsAuPath('diligence-projet.json', 'scenes[].entities[].decor.id').map((s) => s.type))).toEqual(new Set(['prop']));
    const c = couple('diligence-projet.json', 'decor')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('PAYLOAD D’OP sous un flux de dialogue : le facteur de Manann est un slot de son catalogue (`loup-et-saumure-projet.json`)', () => {
    expect(SLOTS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dataset: 'loup-et-saumure-projet.json',
        path: 'scenes[].dialogues[].nodes[].choices[].flow.etapes[].effet.ops[].facteur.id',
        type: 'manannFactor',
      }),
    ]));
  });
});
