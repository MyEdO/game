import { describe, it, expect } from 'vitest';
import { fearSourceFor, agressifEnvers } from '../engine/psychology';
import { psychDRAdjust } from '../engine/combat';
import { collectHeroRoundStartPsych, collectHeroRoundEndPsych } from './combatFlow';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 35, force: 40, endurance: 40, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 } as const;

const mk = (id: string, kind: Combatant['kind'], over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, advantage: 0, conditions: [], talents: [], activeEffects: [], skills: [],
    traits: [], psychTraits: [], psychState: [], groups: [], weapons: [], engagedWith: [],
    characteristics: { ...CHARS }, wounds: { current: 10, max: 10, base: 10 }, size: 'moyenne',
    movement: 4, ...over,
  }) as unknown as Combatant;

/** `get` minimal des collectes de Round : elles ne lisent que la bataille et la scène. */
const getOf = (combatants: Combatant[], round = 1) =>
  (() => ({ battle: { combatants, round, log: [] }, scene: testScene() })) as never;

const at = (c: Combatant, x: number, y: number): Combatant => { c.pos = { x, y }; return c; };

describe('Peur — les DEUX portes du RAW (Trait LDB 85 l.264-266 / Taille LDB 85 l.381-383)', () => {
  it('TRAIT : un squelette ALLIÉ (Peur 2) est une source pour son invocateur — aucun camp', () => {
    const necro = mk('necro', 'hero');
    const skel = mk('skel', 'hero', { causesPeur: 2 }); // invoqué, donc du camp du lanceur
    expect(fearSourceFor(necro, skel)).toEqual({ kind: 'peur', indice: 2 });
    expect(fearSourceFor(skel, necro)).toBeNull(); // et jamais contre soi-même / une créature sans Indice
  });

  it('TAILLE : un allié NON agressif (cheval calme) n’effraie pas ; un adversaire de même Taille oui', () => {
    const hero = mk('h', 'hero', { size: 'moyenne' });
    const cheval = mk('cheval', 'hero', { size: 'grande' });
    expect(agressifEnvers(cheval, hero)).toBe(false);
    expect(fearSourceFor(hero, cheval)).toBeNull();
    const ogre = mk('ogre', 'enemy', { size: 'grande' }); // camp adverse = agressif par défaut
    expect(agressifEnvers(ogre, hero)).toBe(true);
    expect(fearSourceFor(hero, ogre)).toEqual({ kind: 'peur', indice: 1 });
  });

  it('TAILLE : deux alliés qui ÉCHANGENT des coups (lien Engagé SYMÉTRIQUE, LDB 13 l.169-171) sont agressifs l’un envers l’autre', () => {
    const hero = mk('h', 'hero', { size: 'moyenne', engagedWith: ['domine'] });
    const domine = mk('domine', 'hero', { size: 'grande', engagedWith: ['h'] });
    expect(agressifEnvers(domine, hero)).toBe(true);
    expect(fearSourceFor(hero, domine)).toEqual({ kind: 'peur', indice: 1 });
    // Symétrie : le héros aussi est agressif envers sa victime — sa Taille à elle reste plus grande,
    // donc c'est bien LUI qui teste. Rien ne remonte dans l'autre sens (il n'est pas plus grand).
    expect(agressifEnvers(hero, domine)).toBe(true);
    expect(fearSourceFor(domine, hero)).toBeNull();
  });

  it('TAILLE : le héros qui AGRESSE un allié Grand teste la Peur de sa victime (l’Engagement vaut des deux côtés)', () => {
    const victime = at(mk('victime', 'hero', { size: 'grande', engagedWith: ['h'] }), 11, 10);
    const agresseur = at(mk('h', 'hero', { size: 'moyenne', engagedWith: ['victime'] }), 10, 10);
    expect(collectHeroRoundEndPsych(getOf([agresseur, victime]), agresseur))
      .toEqual({ kind: 'peur', sourceId: 'victime', sourceName: 'victime', indice: 1, prevDR: 0 });
  });

  it('TAILLE : un allié FRÉNÉTIQUE ne vise que les ennemis — rien pour les siens', () => {
    const halfelin = mk('h', 'hero', { size: 'petite' });
    const ogre = mk('ogre', 'hero', { size: 'grande', psychState: [{ type: 'frenesie' }] as never });
    expect(agressifEnvers(ogre, halfelin)).toBe(false);
    expect(fearSourceFor(halfelin, ogre)).toBeNull();
  });

  it('−1 DR (LDB 21 l.27) contre la source portée, fût-elle un allié, tant que la Peur n’est pas vaincue', () => {
    const skel = mk('skel', 'hero', { causesPeur: 2 });
    const necro = mk('necro', 'hero', { psychState: [{ type: 'peur', sourceId: 'skel', indice: 2, calmeDR: 0 }] as never });
    expect(psychDRAdjust(necro, skel)).toBe(-1);
    const vaincue = mk('necro2', 'hero', { psychState: [{ type: 'peur', sourceId: 'skel', indice: 2, calmeDR: 2 }] as never });
    expect(psychDRAdjust(vaincue, skel)).toBe(0);
  });

  it('FIN DE ROUND : le Test étendu de Calme est dû face au squelette ALLIÉ ; le squelette ne teste pas contre soi', () => {
    const necro = at(mk('necro', 'hero'), 10, 10);
    const skel = at(mk('skel', 'hero', { causesPeur: 2 }), 11, 10);
    const get = getOf([necro, skel]);
    expect(collectHeroRoundEndPsych(get, necro)).toEqual({ kind: 'peur', sourceId: 'skel', sourceName: 'skel', indice: 2, prevDR: 0 });
    expect(collectHeroRoundEndPsych(get, skel)).toBeNull();
  });

  it('DÉBUT DE ROUND : une Terreur ALLIÉE (statbloc) est due ; un allié de grande Taille non agressif, non', () => {
    const hero = at(mk('h', 'hero', { size: 'moyenne' }), 10, 10);
    const spectre = at(mk('spectre', 'hero', { causesTerreur: 3 }), 11, 10);
    expect(collectHeroRoundStartPsych(getOf([hero, spectre]), hero))
      .toEqual({ kind: 'terreur', sourceId: 'spectre', sourceName: 'spectre', indice: 3, prevDR: 0 });
    const geant = at(mk('geant', 'hero', { size: 'enorme' }), 11, 10); // allié calme : aucune agression
    expect(collectHeroRoundStartPsych(getOf([hero, geant]), hero)).toBeNull();
    expect(collectHeroRoundEndPsych(getOf([hero, geant]), hero)).toBeNull();
  });

  it('CAMP ADVERSE : comportement inchangé (Peur de Taille de fin de Round face à un ennemi Grand)', () => {
    const hero = at(mk('h', 'hero', { size: 'moyenne' }), 10, 10);
    const ogre = at(mk('ogre', 'enemy', { size: 'grande' }), 11, 10);
    expect(collectHeroRoundEndPsych(getOf([hero, ogre]), hero))
      .toEqual({ kind: 'peur', sourceId: 'ogre', sourceName: 'ogre', indice: 1, prevDR: 0 });
  });
});
