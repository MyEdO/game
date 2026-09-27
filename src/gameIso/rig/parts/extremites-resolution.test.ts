import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveParts } from './resolve';
import { viewOrFront } from './types';
import { ARMOUR } from './armour';
import { CLAWFOOT, PLAINFOOT, HAND, NECK } from './bodies/extremites';
import { BOTTE_CUIR } from './tenues/botte-gabarit';
import type { EquipCtx } from './equipment';
import type { ItemInstance } from '../../../engine/types';

const empty: EquipCtx = { weapons: [], armour: [] };

// #633/#736 — pied/main/cou résolus par la MÊME table de priorité que tete/torse/jambes.

describe('extrémités — résolution uniforme (structure)', () => {
  const src = readFileSync(new URL('./resolve.ts', import.meta.url), 'utf8');

  it("pied/main/cou passent par la chaîne priorisée equipWinner (contrat positif)", () => {
    expect(src).toContain("equipWinner('pied'");
    expect(src).toContain("equipWinner('main'");
    expect(src).toContain("equipWinner('cou'");
  });

  it("plus aucune affectation directe d'un CONST à out.pied/main/cou", () => {
    // Le repli n'est plus branché en dur : ni P(BOTTE_CUIR/CLAWFOOT/PLAINFOOT) ni P(HAND) ni
    // P(NECK) en affectation directe — tout transite par equipWinner + repli d'espèce.
    expect(src).not.toMatch(/out\.pied\s*=\s*P\(\s*(BOTTE_CUIR|CLAWFOOT|PLAINFOOT)\s*\)/);
    expect(src).not.toMatch(/out\.main\s*=\s*P\(\s*HAND\s*\)/);
    expect(src).not.toMatch(/out\.cou\s*=\s*P\(\s*NECK\s*\)/);
  });

  it('NECK reste la sous-couche garantie du cou (surcouche)', () => {
    expect(src).toContain('viewOrFront(NECK, view) +');
  });
});

describe('extrémités — pilotables par une armure (chair ≠ repli)', () => {
  const MARK = { pied: '<g id="test-soleret"/>', main: '<g id="test-gantelet"/>', cou: '<g id="test-gorgerin"/>' };
  const ZONES = ['pied', 'main', 'cou'] as const;
  const plaque = () => ARMOUR.plaque as Record<string, unknown>;
  // `ARMOUR` est un registre de MODULE, partagé par tous les fichiers du worker (`isolate: false`,
  // vite.config.ts) : l'art d'origine de ces zones se CAPTURE et se REMET tel quel. Une suppression
  // sèche amputerait la plaque (gantelet/soleret/gorgerin) pour les fichiers suivants du worker.
  const ORIG: Partial<Record<(typeof ZONES)[number], unknown>> = {};
  beforeEach(() => { for (const z of ZONES) ORIG[z] = plaque()[z]; });
  afterEach(() => {
    for (const z of ZONES) {
      if (ORIG[z] === undefined) delete plaque()[z];
      else plaque()[z] = ORIG[z];
    }
  });

  it('une armure de plaque couvrant pied/main/cou pilote ces zones', () => {
    (ARMOUR.plaque as Record<string, unknown>).pied = MARK.pied;
    (ARMOUR.plaque as Record<string, unknown>).main = MARK.main;
    (ARMOUR.plaque as Record<string, unknown>).cou = MARK.cou;
    const item: ItemInstance = {
      uid: 'a', label: 'Harnois de plaque', kind: 'armor', qualities: [], pa: 5,
      locs: ['corps', 'brasG', 'brasD', 'jambeG', 'jambeD'], enc: 3, equipped: true,
    };
    const r = resolveParts('Humain', 'M', 'soldat', { weapons: [], armour: [item] }, {}, 1);

    expect(r.pied?.svg).toContain('test-soleret');
    expect(r.pied?.svg).not.toBe(viewOrFront(BOTTE_CUIR, 'front'));
    expect(r.main?.svg).toContain('test-gantelet');
    expect(r.main?.svg).not.toBe(viewOrFront(HAND, 'front'));
    // Cou = surcouche : NECK garanti DESSOUS + gorgerin par-dessus.
    expect(r.cou?.svg).toContain('test-gorgerin');
    expect(r.cou?.svg).toContain(viewOrFront(NECK, 'front'));
    expect(r.cou?.svg).not.toBe(viewOrFront(NECK, 'front'));
  });
});

describe('extrémités — sans équipement ni tenue : repli d\'espèce exact', () => {
  it('soldat (chaussé) → botte BOTTE_CUIR (habit, pas un repli), poing HAND, cou = NECK seul', () => {
    const r = resolveParts('Humain', 'M', 'soldat', empty, {}, 1);
    expect(r.pied?.svg).toBe(viewOrFront(BOTTE_CUIR, 'front'));
    expect(r.main?.svg).toBe(viewOrFront(HAND, 'front'));
    expect(r.cou?.svg).toBe(viewOrFront(NECK, 'front'));
  });

  it("squelette (tenue qui ne chausse pas) + espèce griffue → pied griffu CLAWFOOT (#736 Lot 1)", () => {
    const r = resolveParts('Mort-vivant', 'M', 'squelette', empty, {}, 1, 'front', 'griffues');
    expect(r.pied?.svg).toBe(viewOrFront(CLAWFOOT, 'front'));
  });

  it('nu (civilisé va-nu-pieds, espèce lisse par défaut) → pied lisse PLAINFOOT', () => {
    const r = resolveParts('Humain', 'M', 'nu', empty, {}, 1);
    expect(r.pied?.svg).toBe(viewOrFront(PLAINFOOT, 'front'));
  });
});
