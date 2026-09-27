/**
 * LA LECTURE EN SEUIL d'un dé d'étape (#1508) — `lireEnSeuil`, jumelle de `lireEnTable` : le MÊME
 * tirage (`roulerDe`), lu contre un INDICE déclaré SUR l'étape.
 *
 * Ce que ces contrats tiennent :
 *  - le sens de la comparaison est celui du RAW — « obtient le nombre de l'*Indice* ou PLUS » (LDB 85
 *    l.98, Démoniaque), « résultat SUPÉRIEUR OU ÉGAL à *Indice* » (LDB 85 l.278, Protection) : l'égalité
 *    SAUVE ;
 *  - un dé JETÉ s'ÉCRIT, qu'il sauve ou non, à l'unique graphie du seuil (`formatWardSave`), et la
 *    PROVENANCE se dit quand une zone octroie le Trait (Dôme, LDB 47 l.410) ;
 *  - le seuil DÉCLARÉ à la porte voyage jusqu'à l'étape (`dieStep`), qui naît NON RÉSOLUE : c'est la
 *    fenêtre qui jette le dé, et la rangée peut MONTRER contre quoi il est tombé.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { lireEnSeuil, stepInteraction, stepReady, startCascade, registerCascadeApplier } from './cascade';
import { dieStep, freeCons } from './rollSeam';
import { fixtureText } from '../i18n/fixtureText';
import { useGame, type BattleState } from './store';
import type { SeuilDeSauvegarde } from './pendings';
import type { Combatant } from '../engine/types';

const PROTECTION: SeuilDeSauvegarde = { indice: 6, source: { kind: 'trait', id: 'protection' }, dome: false };
const DOME: SeuilDeSauvegarde = { indice: 6, source: { kind: 'trait', id: 'protection' }, dome: true };
const DEMONIAQUE: SeuilDeSauvegarde = { indice: 8, source: { kind: 'trait', id: 'demoniaque' }, dome: false };

describe('lireEnSeuil — la 3ᵉ lecture d’un dé d’étape', () => {
  it('SAUVE au-dessus de l’Indice, et À l’Indice (LDB 85 l.278 : « supérieur ou égal »)', () => {
    expect(lireEnSeuil(PROTECTION, { roll: 8, total: 8 }, 'Kurt').sauve).toBe(true);
    expect(lireEnSeuil(PROTECTION, { roll: 6, total: 6 }, 'Kurt').sauve).toBe(true);
    expect(lireEnSeuil(DEMONIAQUE, { roll: 8, total: 8 }, 'Démon').sauve).toBe(true);
  });

  it('NE SAUVE PAS sous l’Indice', () => {
    expect(lireEnSeuil(PROTECTION, { roll: 5, total: 5 }, 'Kurt').sauve).toBe(false);
    expect(lireEnSeuil(DEMONIAQUE, { roll: 7, total: 7 }, 'Démon').sauve).toBe(false);
  });

  it('lit le TOTAL (dé effectif), pas le naturel — même convention que le lookup d’une table', () => {
    expect(lireEnSeuil(PROTECTION, { roll: 4, total: 6 }, 'Kurt').sauve).toBe(true);
  });

  it('ÉCRIT sa ligne dans les deux cas, à la graphie unique du seuil', () => {
    const ok = lireEnSeuil(PROTECTION, { roll: 8, total: 8 }, 'Kurt');
    expect(ok.ligne).toContain('Protection (6+)');
    expect(ok.ligne).toContain('8');
    expect(ok.ligne).toContain('ignore le coup');
    const ko = lireEnSeuil(PROTECTION, { roll: 5, total: 5 }, 'Kurt');
    expect(ko.ligne).toContain('Protection (6+)');
    expect(ko.ligne).toContain('n’ignore pas le coup');
  });

  it('DIT la provenance quand une zone octroie le Trait (Dôme, LDB 47 l.410)', () => {
    expect(lireEnSeuil(DOME, { roll: 9, total: 9 }, 'Kurt').ligne).toContain('du Dôme');
    expect(lireEnSeuil(PROTECTION, { roll: 9, total: 9 }, 'Kurt').ligne).not.toContain('du Dôme');
  });
});

describe('le seuil DÉCLARÉ à la porte voyage jusqu’à l’étape', () => {
  it('dieStep porte le seuil sur la déclaration du dé, et l’étape naît NON RÉSOLUE', () => {
    const st = dieStep({
      id: 'sauvegarde-kurt', kind: 'sauvegarde', label: fixtureText('Sauvegarde'),
      spec: { n: 1, sides: 10 }, actorId: 'kurt', seuil: PROTECTION,
    })!;
    expect(st.de?.seuil).toEqual(PROTECTION);
    expect(stepInteraction(st)).toBe('de');
    expect(stepReady(st)).toBe(false);
  });
});

/**
 * F — UNE CONSÉQUENCE JOUÉE EN COMBAT S'ÉCRIT LÀ OÙ LE JOUEUR REGARDE (`battle.log`).
 *
 * Invariant : « Faut partir du fait que personne ne lit le journal » (fiche
 * `feedback-personne-ne-lit-le-journal`). Pendant un combat, `state.journal` n'est pas ouvrable : une
 * ligne de dénouement de cascade qui n'atterrit que là « finit en rien ». Le routage est porté par
 * `combatLog.journaliser`, consommé par `cascade.commitStep` (traces, conséquences, tests ratés).
 *
 * Ces contrats mordent sur le GESTE (la vraie séquence, le vrai `commitStep`) et sur la vraie ligne
 * du socle (`lireEnSeuil`) — jamais sur une chaîne recopiée.
 */
describe('F — le dénouement d’un dé joué EN COMBAT se montre dans le journal de COMBAT', () => {
  const PORTEUR: Combatant = {
    id: 'ilyanwe', label: 'Ilyanwe la Voilée', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant;

  /** Étape de sauvegarde telle que la porte la fabrique (`combatFlow.pousserSauvegarde`) : 1d10, seuil
   *  déclaré, porteur nommé — NON résolue, c'est la fenêtre (ici le test) qui jette ou POSE le dé. */
  const sauvegardeStep = () => dieStep({
    id: 'sauvegarde-ilyanwe', kind: 'seuilSpy', label: fixtureText('Sauvegarde'), icon: 'journal/critical',
    spec: { n: 1, sides: 10 }, actorId: PORTEUR.id, seuil: DOME,
  })!;

  /** Le combat ouvert, journal de combat vide — le seul état dont dépend le routage. */
  const ouvrirCombat = () => useGame.setState({
    battle: {
      combatants: [PORTEUR], order: [PORTEUR.id], baseOrder: [PORTEUR.id], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0,
      movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState,
  });

  /** Ouvre la séquence, POSE (`dePose`) ou LANCE le dé, valide l'étape — le geste de la fenêtre. */
  function jouerSauvegarde(dePose?: number): void {
    startCascade(useGame.getState, useGame.setState, { title: 'Sauvegarde', purpose: 'test', steps: [sauvegardeStep()] });
    if (dePose != null) useGame.getState().cascadeDieSetForcedRoll('sauvegarde-ilyanwe', dePose);
    else useGame.getState().cascadeDieRoll('sauvegarde-ilyanwe');
    useGame.getState().cascadeNext();
  }

  const logDeCombat = () => useGame.getState().battle?.log ?? [];

  beforeEach(() => {
    // L'applier de sauvegarde du combat vit dans `combatFlow` et RÉ-ENTRE dans le coup suspendu ; ce
    // qu'on mesure ici est le ROUTAGE d'une conséquence de cascade, avec la ligne réelle du socle.
    registerCascadeApplier('seuilSpy', (_g, _s, step, porteur) =>
      ({ consequences: freeCons([lireEnSeuil(step.de!.seuil!, step.de!.result!, porteur!.label).ligne]) }));
    useGame.setState({
      battle: null, party: [PORTEUR], journal: [], pendingCascade: null, suspendedCascades: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
  });

  it('F1 — combat OUVERT : la ligne est dans `battle.log`, et PAS dans `state.journal`', () => {
    ouvrirCombat();
    jouerSauvegarde(6);
    expect(logDeCombat().map((e) => e.text).join(' | '), 'la ligne du dé se lit là où le joueur regarde')
      .toMatch(/Ilyanwe la Voilée ignore le coup — sauvegarde 1d10 : 6 ≥ Protection \(6\+\) du Dôme\./);
    expect(useGame.getState().journal, 'rien ne part au journal d’exploration pendant un combat').toEqual([]);
  });

  it('F1 — l’événement porte le kind `info` et son ACTEUR (le bandeau sait de qui il parle)', () => {
    ouvrirCombat();
    jouerSauvegarde(6);
    expect(logDeCombat()[0].kind).toBe('info');
    expect(logDeCombat()[0].actorId).toBe(PORTEUR.id);
  });

  it('F1 — HORS combat : la MÊME étape écrit au `journal` (il n’y a pas d’autre surface)', () => {
    jouerSauvegarde(6);
    expect(useGame.getState().journal.join(' | ')).toContain('ignore le coup');
    expect(useGame.getState().battle).toBeNull();
  });

  it('F1’ — dé POSÉ en combat : la ligne de `battle.log` porte la mention « (dé fixé) »', () => {
    ouvrirCombat();
    jouerSauvegarde(6);
    expect(logDeCombat()[0].text, 'la transparence du dé posé ne se perd pas en passant au journal de combat')
      .toContain('(dé fixé)');
  });

  it('F1’ — dé NATUREL : aucune mention (marquer à tort serait un mensonge)', () => {
    ouvrirCombat();
    jouerSauvegarde();
    expect(logDeCombat()[0].text).not.toContain('dé fixé');
  });
});
