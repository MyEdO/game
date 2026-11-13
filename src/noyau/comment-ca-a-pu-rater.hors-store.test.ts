/**
 * « Comment ça a pu rater ? » (LDB 17 l.32) : le coup nié ne laisse rien sur le porteur — Blessures, Blessures
 * critiques, séquelles, historique des Critiques, États —, le Point de Destin reste dépensé ; « Meurs un autre jour »
 * (l.31) garde les effets du coup. #3988
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { frapper, horsBataille } from './coupHorsBataille.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { avanceEtapeCascade, poseSurDeNonTombe } from './cascade.testkit';
import { heroDuDuel, heroFaceAUnEnnemi, MELEE, ouvrirLeDuel } from './combatDeTest.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { applyCast } from './combatFlow';
import { createHero } from '../engine/character';
import { setEngaged } from '../engine/engagement';
import type { CastResult } from '../engine/magic';
import { testScene } from '../scenes/test-fixture';
import { addCondition, COND } from '../engine/conditions';
import { resetRule, setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import { findTrappingById } from '../data';

afterEach(() => { resetRule('combat-cible-inconsciente'); vi.restoreAllMocks(); });

/** Ce que le coup écrit sur le porteur. */
const etatDuPorteur = (c: Combatant) => ({
  wounds: c.wounds.current, criticalWounds: c.criticalWounds ?? 0, traumas: structuredClone(c.traumas ?? []),
  critEntriesSuffered: [...(c.critEntriesSuffered ?? [])], conditions: structuredClone(c.conditions),
});

/** En bataille, le héros à 1 Blessure frappé d'un double qui le dépasse : deux Blessures critiques (LDB 18 l.53),
 *  Mâchoire fracturée (Tête 51-55) puis Décapitation (100), la mort suspendue au Destin. */
function coupADeuxCritiques(poser: (h: Combatant, e: Combatant) => void = () => {}) {
  const banc = ouvrirLeBanc();
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  H.wounds.current = 1;
  poser(H, E);
  const avant = { ...etatDuPorteur(H), fate: H.fate ?? 0 };
  expect(avant.fate).toBeGreaterThan(0);
  frapper(banc, E, H, [11, 90, 1], MELEE);
  // Les deux fenêtres de Blessure critique, chaque sévérité posée, puis « Subir ».
  expect(avanceEtapeCascade(banc.getState, poseSurDeNonTombe(53), () => 'subir')).toBe('deviation');
  expect(avanceEtapeCascade(banc.getState, poseSurDeNonTombe(100), () => 'subir')).toBe('deviation');
  expect(H.critEntriesSuffered, 'chemin : les deux Critiques subis').toHaveLength(2);
  expect(H.traumas?.length, 'chemin : la séquelle du premier posée').toBeGreaterThan(0);
  expect(banc.getState().pendingFateSave, 'chemin : la mort suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit', foeId: E.id });
  return { banc, H, E, avant, apresLeCoup: etatDuPorteur(H) };
}

/** Le porteur vivant du combat (après `eviter`). */
const vivant = (banc: ReturnType<typeof ouvrirLeBanc>, id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

/** Chaque lien Engagé, « au contact » et Empoigné du héros, porté aussi par l'autre côté. */
function liensReciproques(banc: ReturnType<typeof ouvrirLeBanc>, h: Combatant): void {
  for (const cle of ['engagedWith', 'contactWith', 'grapplingWith'] as const) {
    for (const id of h[cle] ?? []) expect(vivant(banc, id)[cle], `${cle} réciproque de ${id}`).toContain(h.id);
  }
}

describe('« Comment ça a pu rater ? » rend au porteur son état d’avant le coup : LDB 17 l.32', () => {
  it('mort-auto d’un Inconscient qui portait déjà un Critique (LDB 16 l.113) : son Critique et ses séquelles d’avant restent', () => {
    const { banc, H, E } = horsBataille(testScene());
    setRule('combat-cible-inconsciente', 'mort-auto');
    frapper(banc, E, H, [22, 12, 1, 53]);
    expect(banc.getState().pendingFateSave).toBeNull();
    expect([H.criticalWounds, H.critEntriesSuffered], 'chemin : un Critique antérieur porté').toEqual([1, ['machoire-fracturee']]);
    expect(H.traumas?.length, 'chemin : sa séquelle portée').toBeGreaterThan(0);
    H.wounds.current = 0;
    if (!H.conditions.some((c) => c.id === COND.inconscient)) addCondition(H, COND.inconscient);
    const avant = etatDuPorteur(H);
    const fate = H.fate ?? 0;
    frapper(banc, E, H, [30]);
    expect(banc.getState().pendingFateSave, 'chemin : la mort-auto suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit' });
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    expect(etatDuPorteur(H)).toEqual(avant);
    expect(H.fate).toBe(fate - 1);
    expect(H.dead).toBeFalsy();
  });

  it('coup à deux Critiques, létal : Blessures, Critiques, séquelles, historique et États d’avant le coup ; Destin −1', () => {
    const { banc, H, avant } = coupADeuxCritiques();
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    expect(banc.getState().pendingFateSave).toBeNull();
    expect({ ...etatDuPorteur(H), fate: H.fate }).toEqual({ ...avant, fate: avant.fate - 1 });
    expect(H.dead).toBeFalsy();
  });

  it('« Meurs un autre jour » (l.31) : les effets du coup restent sur le porteur, Destin −1', () => {
    const { banc, H, avant, apresLeCoup } = coupADeuxCritiques();
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    const { conditions, ...reste } = etatDuPorteur(H);
    const { conditions: conditionsDuCoup, ...resteDuCoup } = apresLeCoup;
    expect(reste).toEqual(resteDuCoup);
    expect(conditions).toEqual(expect.arrayContaining(conditionsDuCoup));
    expect(H.fate).toBe(avant.fate - 1);
    expect(H.outOfRencontre).toBe(true);
  });
});

describe('« Comment ça a pu rater ? » en bataille : les liens du héros rétablis des deux côtés (LDB 13 l.169-171), son Avantage d’avant le coup', () => {
  it('mort-auto (LDB 16 l.113) : Engagé H↔E des deux côtés', () => {
    const banc = ouvrirLeBanc();
    const { H, E } = heroFaceAUnEnnemi(banc, testScene());
    setRule('combat-cible-inconsciente', 'mort-auto');
    H.wounds.current = 0;
    addCondition(H, COND.inconscient);
    frapper(banc, E, H, [30]);
    expect(banc.getState().pendingFateSave, 'chemin : la mort-auto suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit' });
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    const h = vivant(banc, H.id);
    expect(h.engagedWith, 'chemin : le héros reste Engagé').toContain(E.id);
    liensReciproques(banc, h);
  });

  it('coup à deux Critiques sur un Hémorragique, hors de combat à 0 Blessure : Engagé H↔E des deux côtés', () => {
    const { banc, H, E } = coupADeuxCritiques((h) => addCondition(h, COND.hemorragique));
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    const h = vivant(banc, H.id);
    expect(h.engagedWith, 'chemin : le héros reste Engagé').toContain(E.id);
    liensReciproques(banc, h);
  });

  const AVANT = 3;
  for (const [cas, poser] of [
    ['attaquant sans Renversement', () => {}],
    ['attaquant à Renversement (LDB 10)', (_h: Combatant, e: Combatant) => { e.talents = [...e.talents, { talentId: 'renversement', times: 1 }]; }],
    ['héros Porte-Bouclier paré au Bouclier (LDB 10 l.972)', (h: Combatant) => {
      h.talents = [...h.talents, { talentId: 'porte-bouclier', times: 1 }];
      h.weapons = [weaponFromItem(itemFromTrappingById('bouclier', idsDeTest, findTrappingById)!)];
    }],
  ] as const) it(`${cas} : l’Avantage d’avant le coup rendu`, () => {
    const { banc, H } = coupADeuxCritiques((h, e) => { h.advantage = AVANT; poser(h, e); });
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    expect(vivant(banc, H.id).advantage).toBe(AVANT);
  });
});

/** Six Points d'Armure à chaque Localisation : un Critique sur le héros tenu s'y suspend à l'étape Dévier/Subir (LDB 63 l.30). */
const blinde = (c: Combatant) => { c.armour = { tete: 6, brasG: 6, brasD: 6, corps: 6, jambeG: 6, jambeD: 6 }; };

/** Chaque étape de la séquence jouée en « Subir » jusqu'à la mort suspendue au Destin ; rend le nombre d'étapes
 *  Dévier/Subir `self` (Critique sec suspendu) jouées. */
function subirJusquAuDestin(banc: ReturnType<typeof ouvrirLeBanc>): number {
  let self = 0;
  for (let i = 0; i < 8 && banc.getState().pendingCascade && !banc.getState().pendingFateSave; i++) {
    const p = banc.getState().pendingCascade!;
    if (p.participants[p.cursor]?.deviation?.mode === 'self') self++;
    avanceEtapeCascade(banc.getState, poseSurDeNonTombe(100), () => 'subir');
  }
  expect(banc.getState().pendingFateSave, 'chemin : la mort suspendue au Destin').toMatchObject({ source: 'hit' });
  return self;
}

describe('« Comment ça a pu rater ? » ne dépend pas du chemin du Critique : subi d’office ou suspendu à l’étape Dévier/Subir (LDB 17 l.32)', () => {
  for (const [cas, armer, etapesSelf] of [['nu, Critique subi d’office', () => {}, 0], ['blindé, Critique suspendu à l’étape Dévier/Subir', blinde, 1]] as const) {
    it(`${cas} : l’Avantage d’avant le coup rendu`, () => {
      const banc = ouvrirLeBanc();
      const { H, E } = heroFaceAUnEnnemi(banc, testScene());
      H.advantage = 3;
      armer(H);
      frapper(banc, E, H, [22, 5, 1, 100, 100, 100], MELEE);
      expect(subirJusquAuDestin(banc), 'chemin : étapes Dévier/Subir du Critique sec').toBe(etapesSelf);
      banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
      expect(vivant(banc, H.id).advantage).toBe(3);
      expect(banc.getState().critiquesSuspendus, 'aucune Blessure critique restée suspendue').toEqual([]);
    });
  }
});

/** Sort à Dégâts hors Projectile : 3 Blessures, BE et PA ignorées. */
const SORT_A_DEGATS = {
  id: 'sort-a-degats-test', label: 'Sort à Dégâts', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '',
  source: { book: 'LDB', page: 0 },
  effects: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'wounds', ignoreTB: true, ignoreAP: true, amount: 3 }] } }] },
} as never;
const INCANTATION_CRITIQUE: CastResult = { cast: true, roll: 22, target: 90, sl: 4, isCritical: true, isFumble: false, log: 'jet' };

/** Deux héros blindés, H et T, face au lanceur E (Diction instinctive : aucune Imparfaite, LDB 46 l.32). */
function deuxHerosBlindes() {
  const banc = ouvrirLeBanc();
  const { H, E, T } = ouvrirLeDuel(banc, { scene: testScene(), party: [heroDuDuel(), createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'T', seed: 2 })] }, 'enc-mutants', 'heros');
  E.talents = [...E.talents, { talentId: 'diction-instinctive', times: 1 }];
  for (const c of [H, T!]) blinde(c);
  return { banc, H, E, T: T! };
}

/** L'Incantation critique du Sort à Dégâts de E sur `cibles` (LDB 46 l.30), chaque Critique à la Tête (01) et Décapitation (100). */
function sortCritique(banc: ReturnType<typeof ouvrirLeBanc>, E: Combatant, [cible, ...autres]: Combatant[]): void {
  imposerLesD100(...[cible, ...autres].flatMap(() => [1, 100]));
  applyCast(banc.getState, banc.setState, E, cible, SORT_A_DEGATS, INCANTATION_CRITIQUE, false, false, 'critique', autres.length ? { extraTargets: autres } : undefined);
}

describe('« Comment ça a pu rater ? » sur le Critique d’un Sort à Dégâts suspendu à l’étape Dévier/Subir (LDB 46 l.30 ; LDB 17 l.32)', () => {
  it('un héros : `eviter` rend aussi les Blessures d’avant le Sort', () => {
    const { banc, H, E } = deuxHerosBlindes();
    const avant = etatDuPorteur(H);
    sortCritique(banc, E, [H]);
    expect(vivant(banc, H.id).wounds.current, 'chemin : les Dégâts du Sort posés').toBe(avant.wounds - 3);
    expect(subirJusquAuDestin(banc), 'chemin : le Critique suspendu à l’étape Dévier/Subir').toBe(1);
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    expect(etatDuPorteur(vivant(banc, H.id))).toEqual(avant);
  });

  it('deux héros, deux Critiques en attente dans la même séquence : chaque `eviter` rend son propre instantané', () => {
    const { banc, H, E, T } = deuxHerosBlindes();
    T.wounds.current -= 2;
    const avant = { [H.id]: etatDuPorteur(H), [T.id]: etatDuPorteur(T) };
    sortCritique(banc, E, [H, T]);
    expect(banc.getState().critiquesSuspendus.map((c) => c.porteurId), 'chemin : deux Critiques suspendus').toEqual([H.id, T.id]);
    for (const c of [H, T]) {
      subirJusquAuDestin(banc);
      expect(banc.getState().pendingFateSave?.heroId).toBe(c.id);
      banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
      expect(etatDuPorteur(vivant(banc, c.id)), c.label).toEqual(avant[c.id]);
    }
    expect(banc.getState().critiquesSuspendus).toEqual([]);
  });
});

describe('« Comment ça a pu rater ? » : un lien vers un combattant tombé dans l’échange n’est pas rétabli (LDB 13 l.169-171)', () => {
  it('Engagé à E et à T, T hors de combat avant `eviter` : seul E↔H revient, aucun lien unilatéral', () => {
    const banc = ouvrirLeBanc();
    const { H, E, T } = ouvrirLeDuel(banc, { scene: testScene(), party: [heroDuDuel()] }, 'enc-mutants', 'ennemi');
    setEngaged(H, E);
    setEngaged(H, T!);
    H.wounds.current = 1;
    frapper(banc, E, H, [11, 90, 1], MELEE);
    expect(avanceEtapeCascade(banc.getState, poseSurDeNonTombe(53), () => 'subir')).toBe('deviation');
    expect(avanceEtapeCascade(banc.getState, poseSurDeNonTombe(100), () => 'subir')).toBe('deviation');
    expect(banc.getState().pendingFateSave, 'chemin : la mort suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit' });
    vivant(banc, T!.id).dead = true;
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    const h = vivant(banc, H.id);
    expect(h.engagedWith).toEqual([E.id]);
    liensReciproques(banc, h);
  });
});
