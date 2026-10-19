/**
 * LE REBOND d'« Attaques en chaîne » À LA PORTE (#1508) — `LDB 47 l.340` : « Si *Attaques en chaîne*
 * réduit la cible à 0 Blessure, il rebondit sur une autre cible dans la portée initiale du Sort […]
 * infligeant de nouveau les mêmes Dégâts. Il peut rebondir un nombre maximum de fois égal à votre
 * Bonus de Force Mentale. »
 *
 * « Réduit la cible à 0 Blessure » se juge sur l'état FRAIS. Une fenêtre en vol sur la cible — dé de
 * sauvegarde (`LDB 85 l.98`), Déviation Critique (`LDB 63 l.30`) — n'a encore rien appliqué : le rebond
 * ne se joue donc qu'APRÈS elle, depuis la charge où il voyage (`ToucheDeProjectile.rebond`).
 *
 * Contrats POSITIFS, exercés par le VRAI geste (`applyCast` + les coutures de fenêtre du store),
 * jumeaux de `sauvegardes-projectile-magique.test.ts` dont ils reprennent les fixtures.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from '../store';
import { applyCast } from '../combatFlow';
import { evaluateMissile, type CastResult } from '../../engine/magic';
import { seedBattleRng } from '../../noyau/battleRng';
import { draineCascade } from '../cascadeTestKit';
import { emptyScene } from '../../noyau/monde/scene';
import { findSpell } from '../../data';
import type { Combatant } from '../../engine/types';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const cr = (sl: number): CastResult =>
  ({ cast: true, roll: 44, target: 60, sl, isCritical: false, isFumble: false, log: '' });

/** Le Sort du catalogue (op `chain` authorée) lancé par le VRAI chemin, sur `cible`. */
function lancerLaChaine(caster: Combatant, cible: Combatant, sl = 4): void {
  const spell = findSpell('Attaques en chaîne')!;
  const res = evaluateMissile(caster, cible, spell, cr(sl));
  applyCast(useGame.getState, useGame.setState, caster, cible, spell, res, true, false);
}

/** Cible mourante à 1 PB : toute touche la « réduit à 0 Blessure ». */
const mourant = (id: string, x: number, over: Partial<Combatant> = {}): Combatant =>
  mk('enemy', id, { pos: { x, y: 0 }, wounds: { current: 1, max: 8 } as Combatant['wounds'], ...over });

/** L'étape ouverte pour ce porteur, telle que la porte la nomme (`pushDie` suffixe l'index d'append). */
const etapeDe = (kind: string, actorId: string) =>
  (useGame.getState().pendingCascade?.participants ?? []).find((s) => s.kind === kind && s.actorId === actorId);

/** POSE le dé de la fenêtre ouverte sur `actorId` — le geste du joueur, jamais un dé au hasard. */
function poserLeDe(actorId: string, n: number): void {
  const st = etapeDe('sauvegarde', actorId);
  expect(st, `aucune sauvegarde en vol sur ${actorId}`).toBeTruthy();
  useGame.getState().cascadeDieSetForcedRoll(st!.id, n);
}

const lu = (): string => (useGame.getState().battle?.log ?? []).map((e) => e.text).join(' | ');
const rebonds = (): number => lu().match(/rebondit sur/g)?.length ?? 0;

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null });
});

describe('LDB 47 l.340 — le rebond attend la fenêtre de SAUVEGARDE de la cible', () => {
  /** Dard chaîné sur une cible qui SAUVE (`LDB 85 l.98`, Indice 6) ; la voisine est à 1 case. */
  function poser() {
    const mage = mk('hero', 'mage', { pos: { x: 0, y: 0 } });
    const c1 = mourant('c1', 2, { traits: [{ id: 'demoniaque', value: 6 }] as never });
    const c2 = mk('enemy', 'c2', { pos: { x: 3, y: 0 } });
    setBattle([mage, c1, c2]);
    lancerLaChaine(mage, c1);
    return { mage, c1, c2 };
  }

  it('(a) la fenêtre EN VOL : rien n’est appliqué, et la voisine n’a AUCUNE étape', () => {
    const { c1, c2 } = poser();
    const etapes = useGame.getState().pendingCascade?.participants ?? [];
    expect(etapes.map((s) => `${s.kind}:${s.actorId}`), 'la seule fenêtre ouverte est la sauvegarde de la cible touchée').toEqual(['sauvegarde:c1']);
    expect(c1.wounds.current, 'aucune mutation avant le dé').toBe(1);
    expect(c2.wounds.current, 'le rebond n’a pas été joué par-dessus la fenêtre').toBe(30);
    expect(rebonds()).toBe(0);
  });

  it('(a) dé posé 6 — le coup est IGNORÉ : la cible n’est pas réduite à 0, AUCUN rebond', () => {
    const { c1, c2 } = poser();
    poserLeDe('c1', 6);
    draineCascade(useGame.getState);
    expect(c1.wounds.current, '1d10 ≥ 6 : le coup est ignoré').toBe(1);
    expect(c2.wounds.current, 'personne n’a été réduit à 0 : rien ne rebondit').toBe(30);
    expect(rebonds()).toBe(0);
  });

  it('(a) dé posé 5 — le coup porte : la cible tombe à 0 et le Projectile rebondit UNE fois', () => {
    const { c1, c2 } = poser();
    poserLeDe('c1', 5);
    draineCascade(useGame.getState);
    expect(c1.wounds.current, '1d10 < 6 : le coup porte').toBe(0);
    expect(c2.wounds.current, 'le rebond a frappé la voisine APRÈS la fenêtre').toBeLessThan(30);
    expect(rebonds(), 'une seule fois — la voisine survit, la chaîne s’arrête').toBe(1);
  });
});

describe('LDB 63 l.30 — le rebond attend l’issue de la DÉVIATION CRITIQUE de la cible', () => {
  /** Cible TENUE par un siège humain (héros non piloté) et BLINDÉE : le Critique lui est OFFERT. */
  function poser() {
    const mage = mk('enemy', 'mage', { pos: { x: 0, y: 0 } });
    const h1 = mk('hero', 'h1', {
      pos: { x: 2, y: 0 }, wounds: { current: 1, max: 8 } as Combatant['wounds'],
      armour: { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 },
    });
    const h2 = mk('hero', 'h2', { pos: { x: 3, y: 0 } });
    setBattle([mage, h1, h2]);
    lancerLaChaine(mage, h1, 6);
    return { mage, h1, h2 };
  }

  it('(b) la fenêtre de Déviation EN VOL : la voisine est intacte, aucun rebond', () => {
    const { h1, h2 } = poser();
    const etapes = useGame.getState().pendingCascade?.participants ?? [];
    expect(etapes.some((s) => s.kind === 'deviation'), `une Déviation Critique est offerte : ${etapes.map((s) => s.kind).join(',')}`).toBe(true);
    expect(h1.wounds.current, 'aucune mutation avant la dernière décision de Critique').toBe(1);
    expect(h2.wounds.current, 'le rebond attend l’issue').toBe(30);
    expect(rebonds()).toBe(0);
  });

  it('(b) la fenêtre tranchée : le Projectile rebondit sur la voisine', () => {
    const { h2 } = poser();
    draineCascade(useGame.getState);
    expect(useGame.getState().pendingCascade, 'la fenêtre est close').toBeNull();
    expect(h2.wounds.current, 'le rebond a frappé APRÈS la décision').toBeLessThan(30);
    expect(rebonds()).toBe(1);
  });
});

describe('LDB 47 l.340 — la chaîne complète survit à une fenêtre en son milieu', () => {
  it('(c) chaîne de 3 : la 2ᵉ cible suspend, résolue → la 3ᵉ est touchée, sans doublon', () => {
    const mage = mk('hero', 'mage', { pos: { x: 0, y: 0 } });
    const c1 = mourant('c1', 2);
    const c2 = mourant('c2', 3, { traits: [{ id: 'demoniaque', value: 6 }] as never });
    const c3 = mk('enemy', 'c3', { pos: { x: 4, y: 0 } });
    setBattle([mage, c1, c2, c3]);
    lancerLaChaine(mage, c1);
    expect(c1.wounds.current, 'la 1ʳᵉ cible tombe sans fenêtre').toBe(0);
    expect(rebonds(), 'le 1ᵉʳ rebond est parti').toBe(1);
    expect(c3.wounds.current, 'la 3ᵉ attend : la 2ᵉ a une sauvegarde en vol').toBe(30);
    poserLeDe('c2', 5);
    draineCascade(useGame.getState);
    expect(c2.wounds.current, 'le coup porte : la 2ᵉ tombe à 0').toBe(0);
    expect(c3.wounds.current, 'la chaîne reprend là où la fenêtre l’avait laissée').toBeLessThan(30);
    expect(rebonds(), 'deux rebonds, jamais le même maillon deux fois').toBe(2);
    expect(lu().match(/rebondit sur .*c2/g)?.length ?? 0, 'la 2ᵉ cible n’est touchée qu’une fois').toBe(1);
  });

  it('(c) « un nombre maximum de fois égal à votre Bonus de Force Mentale » : BFM 1 → un seul rebond', () => {
    const mage = mk('hero', 'mage', { pos: { x: 0, y: 0 }, characteristics: { ...CHARS, 'force-mentale': 10 } as never });
    const c1 = mourant('c1', 2);
    const c2 = mourant('c2', 3);
    const c3 = mourant('c3', 4);
    setBattle([mage, c1, c2, c3]);
    lancerLaChaine(mage, c1);
    expect(c1.wounds.current).toBe(0);
    expect(c2.wounds.current, 'le rebond unique a frappé').toBe(0);
    expect(c3.wounds.current, 'le plafond est atteint : la chaîne s’arrête').toBe(1);
    expect(rebonds()).toBe(1);
  });
});

describe('LDB 85 l.302 / LDB 10 l.1026 — « infligeant de nouveau les MÊMES Dégâts » : le jet du rebond est l’ORIGINAL', () => {
  it('(e) la Résistance à la Magie de la 1ʳᵉ cible ne change rien aux Dégâts de la 2ᵉ', () => {
    // « Le DR d'un Sort est uniquement modifié par le plus haut score du Talent […] dans la zone de sa
    // cible » : la cible d'un rebond est HORS de cette zone — elle est SA propre zone.
    const jouer = (resistante: boolean): number => {
      seedBattleRng(1);
      const mage = mk('hero', 'mage', { pos: { x: 0, y: 0 } });
      const c1 = mourant('c1', 2, resistante ? { talents: [{ talentId: 'resistance-a-la-magie', times: 1 }] as never } : {});
      const c2 = mk('enemy', 'c2', { pos: { x: 3, y: 0 } });
      setBattle([mage, c1, c2]);
      lancerLaChaine(mage, c1);
      draineCascade(useGame.getState);
      expect(c1.wounds.current, 'la 1ʳᵉ cible tombe dans les deux cas').toBe(0);
      expect(rebonds(), 'le rebond a bien eu lieu').toBe(1);
      return c2.wounds.current;
    };
    expect(jouer(true), 'le DR réduit CONTRE la 1ʳᵉ cible ne suit pas le Projectile').toBe(jouer(false));
  });

  it('(e) depuis la REPRISE : le DR réduit de la 1ʳᵉ cible ne suit pas le Projectile', () => {
    const jouer = (resistante: boolean): number => {
      seedBattleRng(1);
      const mage = mk('hero', 'mage', { pos: { x: 0, y: 0 } });
      const c1 = mourant('c1', 2, { traits: [{ id: 'demoniaque', value: 6 }] as never,
        ...(resistante ? { talents: [{ talentId: 'resistance-a-la-magie', times: 1 }] as never } : {}) });
      const c2 = mk('enemy', 'c2', { pos: { x: 3, y: 0 } });
      setBattle([mage, c1, c2]); lancerLaChaine(mage, c1);
      poserLeDe('c1', 5); draineCascade(useGame.getState);
      expect(c1.wounds.current).toBe(0); expect(rebonds()).toBe(1);
      return c2.wounds.current;
    };
    expect(jouer(true), 'la touche cuite par la fenêtre ne contamine pas le maillon').toBe(jouer(false));
  });
});
