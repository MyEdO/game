/**
 * Deltas d'incantation des Vents de Magie sous l'option `magic-vdm-incantation` :
 * Influences malveillantes (`VDM 02 l.157-159`), Tableaux des Incantations Imparfaites
 * (`VDM 02 l.218-263`) et Surincantation révisée (`VDM 02 l.194-215`).
 *
 * Chaque cas est mesuré OPTION OFF puis ON sur le MÊME appel : le volet OFF est la garde de
 * non-régression du Livre de base, le volet ON rougit si le point de lecture est débranché.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { malevolentInfluenceSeverity, focusCriticalDR, dispelOwnSpellDR, malepierreDR, malepierreCharge, malepierreReserveOf, consumeMalepierre } from './magic';
import type { Combatant } from './types';
import { rollMiscast } from './miscast';
import type { RNG } from './dice';
import {
  overcastBudget,
  extraTargetCapacity,
  overcastDurationParts,
  effectiveRangeMetres,
  zoneDiameterMultiplier,
  missileOvercastDamageBonus,
} from './overcast';
import { domains, findEffectTableById } from '../data';
import miscastJson from '../data/miscast.json';
import { objetDeTest } from './objetDeTest.testkit';

const RULE = 'magic-vdm-incantation';

afterEach(() => resetRule(RULE));

describe('Influences malveillantes — `VDM 02 l.157-159`', () => {
  it('option OFF : seul le dé des unités à 8 déclenche (LDB 46 l.89)', () => {
    expect(malevolentInfluenceSeverity(37, false, true, false)).toBeNull();
    expect(malevolentInfluenceSeverity(38, false, true, false)).toBe('mineure');
  });

  it('option ON : TOUT lancer raté près d’une Corruption déclenche une Mineure', () => {
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(37, false, true, false)).toBe('mineure');
  });

  it('option ON : un lancer RÉUSSI ne déclenche plus rien, même en 8', () => {
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(38, true, true, false)).toBeNull();
  });

  it('option ON : escalade en Majeure si une Mineure est déjà due au même Test', () => {
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(37, false, true, true)).toBe('majeure');
  });

  it('hors proximité d’une Corruption : rien, quelle que soit l’option', () => {
    expect(malevolentInfluenceSeverity(38, false, false, false)).toBeNull();
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(37, false, false, false)).toBeNull();
  });
});

describe('Tableaux des Incantations Imparfaites — `VDM 02 l.218-263`', () => {
  const docs = miscastJson as unknown as { id: string; entries: { min: number; max: number }[] }[];
  /** Rangées d'un tableau par son id STABLE — FAIL-FAST : un id absent rendrait le contrat vide. */
  const rowsOf = (id: string) => {
    const d = docs.find((x) => x.id === id);
    if (!d) throw new Error(`tableau « ${id} » absent de miscast.json`);
    return d.entries;
  };

  it('20 rangées par table, fourchettes contiguës de 01 à 00', () => {
    for (const rows of [rowsOf('miscast-mineure-vdm'), rowsOf('miscast-majeure-vdm')]) {
      expect(rows).toHaveLength(20);
      expect(rows[0].min).toBe(1);
      expect(rows[rows.length - 1].max).toBe(100);
      rows.forEach((r, i) => { if (i > 0) expect(r.min).toBe(rows[i - 1].max + 1); });
    }
  });

  /** Jet figé sur 88 : la rangée 86-90 de la table Mineure VDM (« Marqué par la Magie »). */
  const rngOn88 = (): RNG => ({ int: () => 88 });

  it('option OFF : 88 tire « Double problème » (table du Livre de base)', () => {
    expect(rollMiscast('mineure', rngOn88()).label).toBe('Double problème');
  });

  it('option ON : 88 tire « Marqué par la Magie »', () => {
    setRule(RULE, true);
    expect(rollMiscast('mineure', rngOn88(), 0, 'feu').label).toBe('Marqué par la Magie');
  });

  it('option ON, lanceur d’un Domaine de Couleur : la rangée tire sur la table de MARQUES de SON Vent', () => {
    setRule(RULE, true);
    for (const d of domains.filter((x) => x.tables?.arcaneMark)) {
      const ops = rollMiscast('mineure', rngOn88(), 0, d.id).ops;
      expect(ops, `${d.id} : aucune op de tirage`).toContainEqual({ op: 'rollTable', tableId: d.tables!.arcaneMark });
      expect(findEffectTableById(d.tables!.arcaneMark).rows).toHaveLength(10);
    }
  });

  it('option ON, tradition sans table de Marques : nouveau lancer sur le Tableau Majeur (`VDM 02 l.238`)', () => {
    setRule(RULE, true);
    // Jet figé sur 88 : la rangée « Marqué par la Magie », puis 88 sur le Majeur (« Puanteur infernale »).
    const sansTable = rollMiscast('mineure', rngOn88(), 0, 'necromancie');
    expect(sansTable.label).toBe('Marqué par la Magie → Puanteur infernale');
    expect(sansTable.rolls).toEqual([88, 88]);
    expect(rollMiscast('mineure', rngOn88()).label).toBe('Marqué par la Magie → Puanteur infernale');
  });

  it('option ON : AUCUN Domaine sans table de Marques ne reste sans conséquence', () => {
    setRule(RULE, true);
    const sansMarque = domains.filter((d) => !d.tables?.arcaneMark);
    expect(sansMarque.length).toBeGreaterThan(0);
    for (const d of sansMarque) {
      expect(rollMiscast('mineure', rngOn88(), 0, d.id).label, d.id).toMatch(/^Marqué par la Magie → /);
    }
  });
});

describe('Surincantation révisée — `VDM 02 l.194-215`', () => {
  it('budget : option OFF = +2 DR par pas (LDB 47) ; ON = le surplus DR par DR', () => {
    expect(overcastBudget('arcane', 12, 4)).toBe(4);
    setRule(RULE, true);
    expect(overcastBudget('arcane', 12, 4)).toBe(8);
  });

  it('Bénédictions et Miracles restent au barème du Livre de base sous l’option', () => {
    setRule(RULE, true);
    expect(overcastBudget('blessing', 12, 0)).toBe(6);
    expect(overcastBudget('miracle', 12, 0)).toBe(6);
  });

  it('Tableau de Surincantation : les paliers 1/2/3/5/8/13/21 de chaque colonne', () => {
    setRule(RULE, true);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => extraTargetCapacity('arcane', dr, 3))).toEqual([1, 1, 1, 2, 2, 2, 3]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => effectiveRangeMetres('arcane', 10, dr))).toEqual([20, 20, 20, 30, 30, 30, 40]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => zoneDiameterMultiplier('arcane', dr))).toEqual([1, 1, 2, 2, 2, 2, 3]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => overcastDurationParts('arcane', dr).mult)).toEqual([1, 2, 2, 2, 3, 3, 3]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => missileOvercastDamageBonus('arcane', dr))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('option OFF : le barème du Livre de base est intact (×initial par pas)', () => {
    expect(extraTargetCapacity('arcane', 2, 3)).toBe(6);
    expect(effectiveRangeMetres('arcane', 10, 2)).toBe(30);
    expect(zoneDiameterMultiplier('arcane', 2)).toBe(3);
    expect(overcastDurationParts('arcane', 2)).toEqual({ mult: 3, bonusRounds: 0 });
    expect(missileOvercastDamageBonus('arcane', 2)).toBe(0); // LDB : pas de colonne Dégât, le DR s'ajoute ailleurs
  });

  it('0 DR dépensé sur une colonne : aucun effet, quelle que soit l’option', () => {
    setRule(RULE, true);
    expect(extraTargetCapacity('arcane', 0, 3)).toBe(0);
    expect(effectiveRangeMetres('arcane', 10, 0)).toBe(10);
    expect(zoneDiameterMultiplier('arcane', 0)).toBe(1);
    expect(overcastDurationParts('arcane', 0)).toEqual({ mult: 1, bonusRounds: 0 });
    expect(missileOvercastDamageBonus('arcane', 0)).toBe(0);
  });
});

describe('Focalisation Critique — `VDM 02 l.145`', () => {
  const caster = (fm: number): Combatant => ({ characteristics: { 'force-mentale': fm } } as unknown as Combatant);

  it('option OFF : le sort devient lançable au NI, quel que soit le DR déjà accumulé (LDB 46 l.136)', () => {
    expect(focusCriticalDR(caster(30), 1, 8)).toBe(8);
    expect(focusCriticalDR(caster(30), 12, 8)).toBe(12); // déjà au-delà du NI : inchangé
  });

  it('option ON : un DR bonus = Bonus de Force Mentale s’ajoute, SANS compléter au NI', () => {
    setRule(RULE, true);
    expect(focusCriticalDR(caster(35), 1, 8)).toBe(1 + 3); // BFM 3, loin sous le NI 8
    expect(focusCriticalDR(caster(30), 12, 8)).toBe(12 + 3); // s'ajoute aussi au-delà du NI
  });
});

describe('Dissiper son propre Sort — `VDM 02 l.186`', () => {
  it('option OFF : aucun bonus, propre Sort ou non (absent du Livre de base, LDB 46 l.154-162)', () => {
    expect(dispelOwnSpellDR(true)).toBe(0);
    expect(dispelOwnSpellDR(false)).toBe(0);
  });

  it('option ON : +1 DR seulement quand le lanceur dissipe son PROPRE Sort', () => {
    setRule(RULE, true);
    expect(dispelOwnSpellDR(true)).toBe(1);
    expect(dispelOwnSpellDR(false)).toBe(0);
  });
});

describe('Malepierre — `LDB 46 l.173`, règle INCONDITIONNELLE du Livre de base', () => {
  it('le doublement du DR ne dépend JAMAIS de l’option — actif dès qu’une réserve existe', () => {
    expect(malepierreDR(3, 20)).toBe(3); // bonus à AJOUTER : DR 3 → 6
    expect(malepierreDR(5, 1)).toBe(5); // un reliquat suffit à déclencher le plein doublement
    setRule(RULE, true);
    expect(malepierreDR(3, 20)).toBe(3); // identique sous VDM : même règle, aucun gate
  });

  it('réserve à 0 : plus de doublement, quelle que soit l’option', () => {
    expect(malepierreDR(4, 0)).toBe(0);
    setRule(RULE, true);
    expect(malepierreDR(4, 0)).toBe(0);
  });

  it('la réserve se décrémente du bonus qu’elle vient d’accorder, plancher à 0', () => {
    expect(malepierreCharge(20, 6)).toBe(14);
    expect(malepierreCharge(4, 6)).toBe(0); // le bonus (6) dépasse la réserve : plancher, jamais négatif
  });

  it('DR NÉGATIF (jet raté ajusté par la pénalité d’armure) : aucun doublement, la réserve NE CROÎT JAMAIS', () => {
    expect(malepierreDR(-2, 20)).toBe(0);
    expect(malepierreCharge(20, malepierreDR(-2, 20))).toBe(20); // réserve INTACTE, jamais un gain
  });
});

describe('Malepierre — réserve FINIE de NI (`VDM 02 l.165`, seul apport de l’option)', () => {
  const caster = (niReserve: number | undefined): Combatant => ({
    items: [objetDeTest({ uid: 'u1', kind: 'misc', qualities: [], enc: 0, equipped: false, trappingId: 'malepierre-brute', ...(niReserve != null ? { niReserve } : {}) })],
  } as unknown as Combatant);

  it('option OFF : réserve `Infinity` tant qu’un objet est porté — ARBITRAGE MAISON (`data/trappings.json` `maison`), `LDB 46 l.173` ne dit RIEN sur un épuisement', () => {
    expect(malepierreReserveOf(caster(undefined))).toBe(Infinity);
    expect(malepierreReserveOf(caster(1))).toBe(Infinity); // même à 1 NI restant : cf. `trappings.json` `malepierre-brute` (champ `maison`)
  });

  it('option ON : réserve RÉELLEMENT finie (`niPerGram`/`niReserve`)', () => {
    setRule(RULE, true);
    expect(malepierreReserveOf(caster(undefined))).toBe(20); // niPerGram du catalogue, réserve encore INTACTE
    expect(malepierreReserveOf(caster(6))).toBe(6);
  });

  it('option OFF : `consumeMalepierre` ne décrémente RIEN (réserve `Infinity`, aucune finitude à consommer)', () => {
    const c = caster(20);
    consumeMalepierre(c, 6);
    expect(c.items![0].niReserve).toBe(20);
  });

  it('option ON : `consumeMalepierre` décrémente la réserve réelle', () => {
    setRule(RULE, true);
    const c = caster(20);
    consumeMalepierre(c, 6);
    expect(c.items![0].niReserve).toBe(14);
  });

  it('pas d’objet porté : réserve 0, `consumeMalepierre` no-op', () => {
    const c = { items: [] } as unknown as Combatant;
    setRule(RULE, true);
    expect(malepierreReserveOf(c)).toBe(0);
    consumeMalepierre(c, 6); // ne doit pas jeter
  });
});
