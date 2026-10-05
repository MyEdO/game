/**
 * hoverTargeting — source unique du tooltip/réticule de visée (IsoStage). Rejoue les MÊMES
 * prédicats que le clic : ok ⇔ le clic aboutirait ; invalid porte la raison (⛔ LdV / portée).
 */
import { describe, it, expect } from 'vitest';
import { hoverTargeting, spellAffinity } from './targeting';
import { findSpell, findSpellById } from '../data';
import { missileDamage } from '../engine/magic';
import { bonus } from '../engine/characteristics';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from './scene';
import { objetDeTest } from '../engine/objetDeTest.testkit';

const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'A', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const scene = (mur?: number): Scene => {
  const tiles = new Array(64).fill('herbe');
  if (mur != null) tiles[mur] = 'mur'; // sur la ligne y=0
  return { id: 's', name: 's', dimensions: { w: 8, h: 8 }, ambiance: 'jour', layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
};

const mkGet = (combatants: Combatant[], battleOver: Partial<Record<string, unknown>> = {}, sc = scene(), racine: Partial<Record<string, unknown>> = {}): (() => GameState) =>
  (() => ({
    scene: sc,
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, movementUsed: 0, action: null, selectedSpellId: null, acted: false, over: null, ...battleOver },
    facing: {}, gameTime: 0, log: () => {},
    // L'INTENTION ARMÉE fait partie du contexte que l'affordance lit (spec HUD § ARBITRAGE 2026-08-19) :
    // le survol dit ce que le CLIC fera, or le clic dépend désormais de la case Charge.
    localIntent: null, ...racine,
  })) as unknown as () => GameState;

const bow = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] }; // ×3 = 12 m = 6 cases

describe('hoverTargeting — mode neutre (attaque implicite)', () => {
  it('tir valide → ok pointillé : nom d’arme, compétence, base, dégâts d’ARME', () => {
    const a = combatant({ id: 'A', weapons: [bow] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 2, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b]), a, b);
    expect(ht).toMatchObject({ kind: 'ok', line: 'dashed', title: 'Arc', skill: 'Projectiles', base: 50, dmg: 8 });
  });

  it('mêlée adjacente → ok ligne PLEINE', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b]), a, b);
    expect(ht).toMatchObject({ kind: 'ok', line: 'solid', title: 'Épée', skill: 'Corps à corps', dmg: 7 }); // BF 3 + 4
  });

  it('cible hors d’Allonge, Charge NON armée → le réticule annonce le REFUS, pas une Charge', () => {
    // Spec HUD § ARBITRAGE 2026-08-19 : le clic ne s'approche plus tout seul. Le survol doit dire CE
    // QUE LE CLIC FERA — promettre « Charge (+1 Avantage) » et un chemin serait un mensonge d'affordance.
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 4, y: 0 } });
    expect(hoverTargeting(mkGet([a, b]), a, b)).toMatchObject({ kind: 'invalid', reason: 'approche-non-armee' });
  });

  it('cible chargeable, Charge ARMÉE → ok PLEINE (aperçu depuis l’arrivée)', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 4, y: 0 } });
    const get = mkGet([a, b], {}, scene(), { localIntent: { actionId: 'charge' } });
    expect(hoverTargeting(get, a, b)).toMatchObject({ kind: 'ok', line: 'solid', title: 'Épée' });
  });

  it('tir hors LdV → invalid los ; au-delà de ×3 → invalid range', () => {
    const a = combatant({ id: 'A', weapons: [bow] as never });
    const hidden = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    expect(hoverTargeting(mkGet([a, hidden], {}, scene(3)), a, hidden)).toMatchObject({ kind: 'invalid', reason: 'los' });
    const far = combatant({ id: 'C', kind: 'enemy', pos: { x: 7, y: 0 } }); // 14 m > 12 m
    expect(hoverTargeting(mkGet([a, far]), a, far)).toMatchObject({ kind: 'invalid', reason: 'range' });
  });

  it('survol d’un allié → none', () => {
    const a = combatant({ id: 'A' });
    const friend = combatant({ id: 'H2', pos: { x: 1, y: 0 } });
    expect(hoverTargeting(mkGet([a, friend]), a, friend).kind).toBe('none');
  });
});

describe('hoverTargeting — tir à Recharge / munition (affordance ≠ log silencieux)', () => {
  const xbow = { label: 'Arbalète', type: 'ranged', subType: 'arbalete', damage: { plusBF: false, flat: 8 }, range: 4, reload: 3, qualities: [] };
  const bolts = objetDeTest({ uid: 'am1', trappingId: 'carreau', kind: 'ammo', subType: 'arbalete', qty: 10, qualities: [] }); // munition sans modificateur de Dégâts (comme les vraies Flèches/Carreaux : damage absent)
  const enemy = () => combatant({ id: 'B', kind: 'enemy', pos: { x: 2, y: 0 } });

  it('arme à Recharge NON chargée → invalid unloaded (le réticule réclame le rechargement)', () => {
    const a = combatant({ id: 'A', weapons: [xbow] as never, items: [bolts] as never }); // loaded indéfini ⇒ déchargé
    expect(hoverTargeting(mkGet([a, enemy()]), a, enemy())).toMatchObject({ kind: 'invalid', reason: 'unloaded' });
  });

  it('même arme CHARGÉE + munition → ok pointillé (le tir part)', () => {
    const a = combatant({ id: 'A', weapons: [{ ...xbow, loaded: true }] as never, items: [bolts] as never });
    expect(hoverTargeting(mkGet([a, enemy()]), a, enemy())).toMatchObject({ kind: 'ok', line: 'dashed', title: 'Arbalète' });
  });

  it('arme à munition suivie, carquois VIDE → invalid noammo', () => {
    const a = combatant({ id: 'A', weapons: [{ ...xbow, loaded: true }] as never, items: [] as never });
    expect(hoverTargeting(mkGet([a, enemy()]), a, enemy())).toMatchObject({ kind: 'invalid', reason: 'noammo' });
  });
});

describe('hoverTargeting — mode incantation', () => {
  const castBattle = (spellId: string) => ({ action: 'cast', selectedSpellId: spellId });

  it('Projectile sur un ennemi visible → ok pointillé, Langue (Magick), dégâts sort + BFM', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 2, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b], castBattle('carreau')), a, b);
    const dmg = missileDamage(findSpell('Carreau')!)!.damage + bonus(40); // FM 40
    expect(ht).toMatchObject({ kind: 'ok', line: 'dashed', title: 'Carreau', skill: 'Langue (Magick)', dmg });
  });

  it('Projectile sur un ALLIÉ → none ; ennemi derrière un mur → invalid los', () => {
    const a = combatant({ id: 'A' });
    const friend = combatant({ id: 'H2', pos: { x: 2, y: 0 } });
    expect(hoverTargeting(mkGet([a, friend], castBattle('carreau')), a, friend).kind).toBe('none');
    const hidden = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    expect(hoverTargeting(mkGet([a, hidden], castBattle('carreau'), scene(3)), a, hidden)).toMatchObject({ kind: 'invalid', reason: 'los' });
  });

  it('sort « Vous » : sur soi → ok SANS ligne de dégâts ; sur un allié → invalid range', () => {
    const a = combatant({ id: 'A' });
    const friend = combatant({ id: 'H2', pos: { x: 2, y: 0 } });
    const self = hoverTargeting(mkGet([a, friend], castBattle('bouclier-magique')), a, a);
    expect(self).toMatchObject({ kind: 'ok', dmg: null });
    expect(hoverTargeting(mkGet([a, friend], castBattle('bouclier-magique')), a, friend)).toMatchObject({ kind: 'invalid', reason: 'range' });
  });

  it('Choc (offensif non-Projectile, Contact) sur un ennemi : adjacent → ok, hors portée → invalid range', () => {
    const a = combatant({ id: 'A' });
    const adj = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } }); // Contact = 1 case
    expect(hoverTargeting(mkGet([a, adj], castBattle('choc')), a, adj).kind).toBe('ok');
    const far = combatant({ id: 'C', kind: 'enemy', pos: { x: 5, y: 0 } });
    expect(hoverTargeting(mkGet([a, far], castBattle('choc')), a, far)).toMatchObject({ kind: 'invalid', reason: 'range' });
  });
});

describe('spellAffinity — côté visé DÉRIVÉ des effets modélisés (parité magie/tir)', () => {
  it('Choc (Contact, inflige Sonné) → enemy', () => expect(spellAffinity(findSpellById('choc')!)).toBe('enemy'));
  it('Fléchette (Projectile magique) → enemy', () => expect(spellAffinity(findSpellById('flechette')!)).toBe('enemy'));
  it('Enchevêtrement (État Empêtré) → enemy', () => expect(spellAffinity(findSpellById('enchevetrement')!)).toBe('enemy'));
  it('Armure aethyrique (apAll +1 sur la cible) → ally', () => expect(spellAffinity(findSpellById('armure-aethyrique')!)).toBe('ally'));
  it('Lumière (effet narratif seul) → any', () => expect(spellAffinity(findSpellById('lumiere')!)).toBe('any'));
  it('Poussée (op push on:caster, offensif positionnel) → enemy', () => expect(spellAffinity(findSpell('Poussée')!)).toBe('enemy'));
});
