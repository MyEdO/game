/**
 * La Rage (LDB 85 l.282) en deux manœuvres sur soi gratuites, octroyées par son trait (#5042, design jugé du 2026-11-28) :
 * « tous ses Avantages » (au moins 1) pour la Haine envers ses adversaires Engagés, (au moins 3) pour la Frénésie, sans
 * Test. Gratuite et jouable à tout moment du tour : arbitrage du 2026-11-26. Fixtures déclarées au seam des datasets :
 * le trait `rage-de-test`, ses manœuvres `haine-de-test` et `frenesie-de-test`, le Groupe `engages-de-test`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { poserLeDataset } from '../../data/datasetDeTest.testkit';
import { buildAiInput, collectRoundEndPsych } from '../combatFlow';
import { chooseEnemyAction, degatsDeLaFrappe } from '../monde/ai';
import { heroFaceAUnEnnemi, reluDans } from '../combatDeTest.testkit';
import { jouerLeTourDeLIA } from '../ouvertureDuTour.testkit';
import { projeter } from '../../hote/projection';
import { testScene } from '../../scenes/test-fixture';
import { isFrenzied } from '../../engine/psychology';
import { psychDRAdjust } from '../../engine/combat';
import { engage } from '../../engine/engagement';
import { ciblePsy } from '../../engine/psych/ciblage';
import { setRule, resetRule } from '../../engine/policy';
import { mirrorPools } from '../../engine/advantagePool';
import type { Combatant } from '../../engine/types';

const GROUPE = 'engages-de-test';
const pose = (type: string, cible?: string) => [{ trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [
  { op: 'beginPsych', type: { id: type }, ...(cible ? { cible: { id: cible } } : {}) },
] } } }];
const manoeuvre = (id: string, label: string, cout: number, effects: unknown) => ({
  id, type: 'maneuvers', label, kind: 'hurlement', activation: 'free', coutEnAvantage: cout, ciblage: 'soi', modeDAvantage: 'tout', effects,
  source: { book: 'LDB', page: 0 },
}) as never;
const HAINE = 'haine-de-test';
const FRENESIE = 'frenesie-de-test';
/** Une manœuvre sur soi gratuite qui renforce son porteur : sa valeur d'argmax serait positive. */
const FORME_GRATUITE = {
  ...(manoeuvre('forme-gratuite-de-test', 'Forme gratuite', 0, [{ trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [
    { op: 'transform', tag: 'forme-gratuite', ops: [{ op: 'charMod', characteristic: 'capacite-de-combat', mod: 60 }, { op: 'charMod', characteristic: 'force', mod: 60 }] },
  ] } } }]) as object),
  modeDAvantage: 'fixe',
} as never;

poserLeDataset('maneuvers', (livre) => [...livre, manoeuvre(HAINE, 'Haine de test', 1, pose('haine', GROUPE)), manoeuvre(FRENESIE, 'Frénésie de test', 3, pose('frenesie')), FORME_GRATUITE]);
poserLeDataset('traits', (livre) => [...livre,
  { id: 'rage-de-test', type: 'traits', label: 'Rage de test', grantsManeuvers: [{ id: HAINE }, { id: FRENESIE }], source: { book: 'LDB', page: 0 } } as never,
  { id: 'forme-gratuite-de-test', type: 'traits', label: 'Forme gratuite de test', grantsManeuvers: [{ id: 'forme-gratuite-de-test' }], source: { book: 'LDB', page: 0 } } as never,
]);
poserLeDataset('groups', (livre) => [...livre, { id: GROUPE, type: 'groups', label: 'Engagés de test', relatif: 'engagesAvecPorteur', source: { book: 'LDB', page: 0 } } as never]);

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => resetRule('combat-aa-avantage-groupe'));
const g = () => banc.getState();

/** Le duel au contact, le héros au tour, `porteur` portant le trait de Rage, Engagés l'un avec l'autre ou non. */
function duel(porteur: 'H' | 'E', avantage: number, engages = true): { H: Combatant; E: Combatant; P: Combatant } {
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  const P = porteur === 'H' ? H : E;
  P.traits = [{ id: 'rage-de-test' }];
  P.advantage = avantage;
  if (engages) engage(H, E);
  banc.setState({ battle: { ...g().battle! } });
  return { H, E, P };
}

/** L'offre `id` de la barre du héros, telle que la projection la rend. */
const offre = (id: string) => projeter(g(), 0, 0, { autres: 0, offres: 100, cibles: 0, gestes: 0, entites: 0 }).combat?.offres?.liste.find((o) => o.id === id);
/** Les manœuvres gratuites sur soi que la barre offre ouvertes au héros. */
const gratuitesOffertes = (): string[] => (offre('manoeuvre-sur-soi-gratuite')?.candidats ?? []).filter((k) => k.refus === null).map((k) => k.nom);
const haines = (c: Combatant) => (c.psychState ?? []).filter((p) => p.type === 'haine');

describe('Rage : la Haine (LDB 85 l.282, au moins 1 Avantage)', () => {
  it('F1 — offerte au héros porteur sous la part gratuite ; jouée, elle dépense TOUT l’Avantage et laisse l’Action', () => {
    const { H, E } = duel('H', 2);
    const vue = offre('manoeuvre-sur-soi-gratuite');
    expect(vue?.economie).toBe('gratuit');
    const candidat = vue?.candidats.find((k) => k.nom === 'Haine de test');
    expect(candidat?.refus).toBeNull();
    expect(candidat?.geste).toEqual({ verbe: 'manoeuvrerSurSoi', args: [HAINE] });
    g().manoeuvrerSurSoi(HAINE);
    const h = reluDans(g, H);
    expect(h.advantage, 'tous ses Avantages').toBe(0);
    expect(g().battle!.acted, 'l’Action du tour reste').toBe(false);
    expect(haines(h)).toEqual([expect.objectContaining({ cible: ciblePsy.groupe(GROUPE), active: true })]);
    expect(psychDRAdjust(h, reluDans(g, E))).toBe(1);
  });

  it('F3 — déjà subie, elle n’est plus offerte au Round suivant, même payable', () => {
    const { H } = duel('H', 1);
    g().manoeuvrerSurSoi(HAINE);
    const b = g().battle!;
    reluDans(g, H).advantage = 3;
    banc.setState({ battle: { ...b, round: b.round + 1, acted: false } });
    expect(gratuitesOffertes()).toEqual(['Frénésie de test']);
  });

  it('F4 — sans adversaire Engagé, sa Cible n’a aucun membre : elle n’est pas offerte', () => {
    duel('H', 2, false);
    expect(gratuitesOffertes()).toEqual([]);
  });

  it('F7 — en Avantage de groupe, elle débite la réserve du camp (AA 11 l.30-38)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const { H } = duel('H', 0);
    const b = g().battle!;
    b.advantagePools = { allies: 2, adversaires: 0 };
    mirrorPools(b.advantagePools, b.combatants);
    banc.setState({ battle: { ...b } });
    g().manoeuvrerSurSoi(HAINE);
    expect(g().battle!.advantagePools).toEqual({ allies: 0, adversaires: 0 });
    expect(haines(reluDans(g, H))).toHaveLength(1);
  });

  it('F8 — posée au Round N, elle n’est pas re-testée à la fin du Round N, elle l’est à la fin du Round N+1 (LDB 21 l.39)', () => {
    const { H } = duel('H', 1);
    const n = g().battle!.round;
    g().manoeuvrerSurSoi(HAINE);
    const dues = (round: number) => collectRoundEndPsych(g, reluDans(g, H), round).filter((d) => d.kind === 'haine');
    expect(dues(n)).toEqual([]);
    expect(dues(n + 1)).toHaveLength(1);
  });
});

describe('Rage : la Frénésie (LDB 85 l.282, au moins 3 Avantages, sans Test)', () => {
  it('F2 — offerte à 3 Avantages, pas à 2 ; jouée, le même état que la Frénésie par Test, l’Action gardée', () => {
    const { H } = duel('H', 2);
    expect(gratuitesOffertes()).toEqual(['Haine de test']);
    H.advantage = 3;
    banc.setState({ battle: { ...g().battle! } });
    expect(gratuitesOffertes()).toEqual(['Haine de test', 'Frénésie de test']);
    g().manoeuvrerSurSoi(FRENESIE);
    const h = reluDans(g, H);
    expect(isFrenzied(h)).toBe(true);
    expect(h.psychState).toEqual([{ type: 'frenesie' }]);
    expect(h.advantage).toBe(0);
    expect(g().battle!.acted).toBe(false);
    expect(g().pendingFrenzy, 'aucun Test de Force Mentale').toBeFalsy();
  });

  it('F5 — déjà en Frénésie, elle n’est plus offerte', () => {
    const { H } = duel('H', 3);
    H.psychState = [{ type: 'frenesie' }];
    banc.setState({ battle: { ...g().battle! } });
    expect(gratuitesOffertes()).not.toContain('Frénésie de test');
  });
});

describe('Rage : l’IA (#5042)', () => {
  it('F9 — une manœuvre sur soi gratuite ne concourt jamais dans l’argmax de la décision', () => {
    const { E } = duel('E', 0);
    E.traits = [{ id: 'forme-gratuite-de-test' }];
    banc.setState({ battle: { ...g().battle! } });
    const input = buildAiInput(E, g);
    expect(input.manoeuvresSurSoiOffertes).toEqual(['forme-gratuite-de-test']);
    expect(chooseEnemyAction(input).kind).not.toBe('manoeuvreSurSoi');
  });

  it('F10 — la mêlée gagne l’argmax : l’IA entre en Haine par le verbe du joueur, garde l’Action et frappe', () => {
    const { H, E } = duel('E', 1);
    // Sûr de toucher, il gagne plus au +1 DR de la Haine qu’au +10 de son Avantage.
    E.characteristics['capacite-de-combat'] += 40;
    banc.setState({ battle: { ...g().battle! } });
    expect(chooseEnemyAction(buildAiInput(E, g))).toEqual({ kind: 'melee', targetId: H.id });
    const verbe = g().manoeuvrerSurSoi;
    const appels: string[] = [];
    banc.setState({ manoeuvrerSurSoi: (id) => { appels.push(id); verbe(id); } });
    jouerLeTourDeLIA(banc, H.id, E.id);
    expect(appels).toEqual([HAINE]);
    const e = reluDans(g, E);
    expect(haines(e)).toHaveLength(1);
    expect(e.advantage).toBe(0);
    expect(g().pendingDefense?.attackerId, 'sa frappe attend la défense du héros').toBe(E.id);
  });

  it('l’espérance de frappe lit le +1 DR de la Haine (`degatsDeLaFrappe`)', () => {
    const { H, E } = duel('E', 0);
    const ctx = { combattants: g().battle!.combatants, mpt: 2, resolveTrapping: () => undefined } as never;
    const arme = E.weapons[0];
    const nu = degatsDeLaFrappe(ctx, E, H, arme);
    const enHaine: Combatant = { ...E, psychState: [{ type: 'haine', cible: ciblePsy.groupe(GROUPE), active: true }] };
    expect(degatsDeLaFrappe(ctx, enHaine, H, arme)).toBeGreaterThan(nu);
  });
});
