import { describe, it, expect } from 'vitest';
import { parseQualityInstance } from './qualities/normalize';
import { makeRNG } from './dice';
import { resolveMelee, resolveRanged } from './combat';
import type { Characteristics, Combatant, Weapon } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Fixture combattant déterministe (pas d'aléa de création). */
function mk(name: string, chars: Partial<Characteristics>, weapon: Weapon, armourCorps = 0): Combatant {
  const base: Characteristics = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  return blessuresSurLeProfil({
    id: name, name, kind: 'enemy',
    characteristics: { ...base, ...chars },
    wounds: blessuresDeBase(25),
    advantage: 0, conditions: [],
    weapons: [weapon],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: armourCorps, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;
}

/** Sérialisation compacte et stable d'un résultat d'attaque (champs déterministes). */
const ser = (r: ReturnType<typeof resolveMelee>) =>
  [r.hit, r.attackerRoll, r.defenderRoll ?? null, r.netSL, r.location ?? null, r.damage ?? null, r.woundsLost ?? null, r.critical, r.advantageTo].join('|');

// Combinaisons de qualités d'arme couvrant TOUS les sites migrés.
const QSETS: string[][] = [[], ['Précise'], ['Perforante'], ['Pointue'], ['Empaleuse'], ['Défensive'], ['À Enroulement'], ['Pistolet'], ['Précise', 'Pointue', 'Perforante'], ['Empaleuse', 'Pointue']];

describe('Golden master — combat (iso-comportement du registre de qualités)', () => {
  it('mêlée : Parade/Esquive/Subir × qualités × seeds — snapshot stable', () => {
    const out: string[] = [];
    for (const q of QSETS) {
      for (const defense of ['parade', 'esquive', 'none'] as const) {
        for (let seed = 1; seed <= 25; seed++) {
          const atk = mk('A', { 'capacite-de-combat': 55, force: 40 }, { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: q.map((s) => parseQualityInstance(s)!) });
          const def = mk('D', { 'capacite-de-combat': 45, endurance: 35 }, { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'defensive' }] }, 2);
          out.push(`${q.join(',')}|${defense}|${seed}=${ser(resolveMelee(atk, def, atk.weapons[0], makeRNG(seed), { defense }))}`);
        }
      }
    }
    expect(out).toMatchSnapshot();
  });

  it('distance : portée × qualités × seeds — snapshot stable', () => {
    const out: string[] = [];
    for (const q of [[], ['Perforante'], ['Pointue'], ['Empaleuse']]) {
      for (let seed = 1; seed <= 25; seed++) {
        const atk = mk('A', { 'capacite-de-tir': 55 }, { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 50, qualities: q.map((s) => parseQualityInstance(s)!) });
        const def = mk('D', { endurance: 35 }, { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }, 2);
        out.push(`${q.join(',')}|${seed}=${ser(resolveRanged(atk, def, atk.weapons[0], makeRNG(seed), 10))}`);
      }
    }
    expect(out).toMatchSnapshot();
  });
});
