/**
 * La manœuvre sur soi de l'IA par le geste du joueur (#5042) : la décision `manoeuvreSurSoi` se joue par le verbe
 * `manoeuvrerSurSoi`, sous le pilote IA ; elle n'est décidée que si la barre du joueur l'offre ouverte (`manoeuvre-sur-soi`).
 * Fixtures déclarées au seam des datasets : une forme `forme-de-test` octroyée par le trait `trait-de-forme-de-test`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { poserLeDataset } from '../data/datasetDeTest.testkit';
import { buildAiInput } from './combatFlow';
import { chooseEnemyAction } from './monde/ai';
import { heroFaceAUnEnnemi, reluDans } from './combatDeTest.testkit';
import { jouerLeTourDeLIA } from './ouvertureDuTour.testkit';
import { testScene } from '../scenes/test-fixture';
import { isFrenzied } from '../engine/psychology';
import type { Combatant } from '../engine/types';

const FORME = 'forme-de-test';
const MANOEUVRE = {
  id: 'manoeuvre-de-test', type: 'maneuvers', label: 'Manœuvre de test', kind: 'hurlement', activation: 'action', coutEnAvantage: 0,
  ciblage: 'soi',
  effects: [{ trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [
    { op: 'transform', tag: FORME, ops: [
      { op: 'charMod', characteristic: 'capacite-de-combat', mod: 60 }, { op: 'charMod', characteristic: 'force', mod: 60 },
      { op: 'charMod', characteristic: 'endurance', mod: 60 }, { op: 'charMod', characteristic: 'initiative', mod: 60 },
      { op: 'charMod', characteristic: 'agilite', mod: 60 },
    ] },
  ] } } }],
  source: { book: 'LDB', page: 0 },
} as never;
const TRAIT = { id: 'trait-de-forme-de-test', type: 'traits', label: 'Forme de test', grantsManeuvers: [{ id: 'manoeuvre-de-test' }], source: { book: 'LDB', page: 0 } } as never;

poserLeDataset('maneuvers', (livre) => [...livre, MANOEUVRE]);
poserLeDataset('traits', (livre) => [...livre, TRAIT]);

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();
const enForme = (c: Combatant) => (c.activeEffects ?? []).some((e) => e.effectId === FORME);

/** Le duel au contact, l'ennemi porteur du trait de forme, `frenetique` ou non ; rend la décision de son tour. */
function duel(frenetique: boolean): { H: Combatant; E: Combatant } {
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  E.traits = [{ id: 'trait-de-forme-de-test' }];
  if (frenetique) E.psychState = [{ type: 'frenesie' }] as never;
  banc.setState({ battle: { ...g().battle! } });
  return { H, E };
}

describe('IA — la manœuvre sur soi par le verbe du joueur (#5042)', () => {
  it('décidée hors Frénésie, le verbe la résout et prend l’Action', () => {
    const { H, E } = duel(false);
    expect(chooseEnemyAction(buildAiInput(E, g))).toEqual({ kind: 'manoeuvreSurSoi', maneuverId: 'manoeuvre-de-test' });
    const verbe = g().manoeuvrerSurSoi;
    const appels: string[] = [];
    banc.setState({ manoeuvrerSurSoi: (id) => { appels.push(id); verbe(id); } });
    let acted = false;
    const fin = banc.subscribe((etat) => { if (etat.battle?.order[etat.battle.turn] === E.id && etat.battle.acted) acted = true; });
    try { jouerLeTourDeLIA(banc, H.id, E.id); } finally { fin(); }
    expect(appels, 'le geste du joueur est joué').toEqual(['manoeuvre-de-test']);
    expect(enForme(reluDans(g, E))).toBe(true);
    expect(acted, 'l’Action du tour est prise').toBe(true);
  });

  it('en Frénésie, la barre ne la lui offre pas : il ne la décide pas et frappe', () => {
    const { H, E } = duel(true);
    expect(isFrenzied(E)).toBe(true);
    expect(chooseEnemyAction(buildAiInput(E, g))).toEqual({ kind: 'melee', targetId: H.id });
    jouerLeTourDeLIA(banc, H.id, E.id);
    expect(enForme(reluDans(g, E))).toBe(false);
    expect(g().pendingDefense?.attackerId, 'sa frappe attend la défense du héros').toBe(E.id);
  });
});
