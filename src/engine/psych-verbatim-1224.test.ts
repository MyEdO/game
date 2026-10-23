/**
 * #1224 — les quatre écarts mécaniques révélés par la remise au VERBATIM de `psychology.json` (#1200),
 * re-mesurés au Source (`Warhammer v4 - Livre de base version corrigee/21 - Psychologie.md`) :
 *
 * · l.87 (Phobie) : « Traitez l'objet de la *Phobie* comme causant *Peur 1*. Vous pouvez vouloir
 *   augmenter l'*Indice* de *Peur* si la *Phobie* est particulièrement forte. »
 * · l.41 (Haine) : « êtes immunisé à *Peur* et *Intimidation* (mais pas *Terreur*) causés par ceux de
 *   ce groupe. »
 * · l.75 (Amour) : « Vous êtes immunisé à la *Peur* et l'*Intimidation* tant que vous défendez les
 *   êtres aimés »
 * · l.19 (Animosité) : « vous ne subirez qu'une pénalité de -20 à vos Tests de Sociabilité envers ce
 *   groupe » / l.48 (Préjugé) : « une pénalité de -10 à vos Tests de Sociabilité avec ce groupe ».
 *
 * Tout passe par la DONNÉE (`targetCauses`, `immuneToFromTarget`, `immuneWhileActive`,
 * `containedSocialMod`) et les résolveurs génériques — aucune entité nommée dans le moteur.
 */
import { describe, it, expect } from 'vitest';
import { fearSourceFor, psychImmuneToFrom, refreshDefendedPsych, targetedTrigger, targetCausedSourcesFor, psychBranchOps } from './psychology';
import { socialPsychMod, socialPsychLabel } from './skills';
import { findPsychologyById } from '../data';
import type { Combatant } from './types';

const C = (o: Partial<Combatant>): Combatant => o as unknown as Combatant;

/** Observateur nu : ni Taille effrayante, ni Indice de statbloc — seuls ses Traits psy parlent. */
const obs = (o: Partial<Combatant>): Combatant => C({ id: 'obs', kind: 'hero', size: 'moyenne', ...o });
const bete = (o: Partial<Combatant> = {}): Combatant =>
  C({ id: 'f', kind: 'enemy', size: 'moyenne', groups: ['homme-bete'], ...o });

describe('#1224 écart 1 — Phobie : l’objet du Trait CAUSE la Peur (LDB 21 l.87)', () => {
  it('la donnée porte le régime, pas le moteur : `targetCauses` = Peur d’Indice 1 par défaut', () => {
    expect(findPsychologyById('phobie')?.targetCauses).toEqual({ kind: 'peur', indice: 1 });
    expect(findPsychologyById('phobie')?.resolution, 'plus de résolution binaire propre').toBeUndefined();
  });

  it('un phobique voit l’objet de sa Phobie comme une SOURCE de Peur 1 — tout le régime de la Peur suit', () => {
    const self = obs({ psychTraits: [{ type: 'phobie', cible: 'homme-bete', indice: 1 }] });
    expect(targetCausedSourcesFor(self, bete())).toEqual([{ kind: 'peur', indice: 1 }]);
    expect(fearSourceFor(self, bete())).toEqual({ kind: 'peur', indice: 1 });
  });

  it('hors de sa Cible, rien ; et un observateur SANS Phobie ne craint rien', () => {
    const self = obs({ psychTraits: [{ type: 'phobie', cible: 'homme-bete', indice: 1 }] });
    expect(fearSourceFor(self, bete({ groups: ['elfe'] }))).toBeNull();
    expect(fearSourceFor(obs({}), bete())).toBeNull();
  });

  it('l’Indice est le CURSEUR laissé à la table (l.87) : celui de l’instance l’emporte sur le défaut', () => {
    const fort = obs({ psychTraits: [{ type: 'phobie', cible: 'homme-bete', indice: 3 }] });
    expect(fearSourceFor(fort, bete())).toEqual({ kind: 'peur', indice: 3 });
    // « Effrayé (Cible) » = Peur 0 (LDB 85) : un Indice nul reste inerte, aucune source posée.
    const zero = obs({ psychTraits: [{ type: 'phobie', cible: 'homme-bete', indice: 0 }] });
    expect(fearSourceFor(zero, bete())).toBeNull();
  });

  it('la Phobie n’ouvre PLUS de bande binaire à elle : `targetedTrigger` la laisse au régime de la Peur', () => {
    const self = obs({ psychTraits: [{ type: 'phobie', cible: 'homme-bete', indice: 1 }] });
    expect(targetedTrigger(self, [bete()])).toBeNull();
    // …alors qu’un Trait ciblé SANS `targetCauses` (Animosité) garde son Test de Psychologie.
    const haineux = obs({ psychTraits: [{ type: 'animosite', cible: 'homme-bete' }] });
    expect(targetedTrigger(haineux, [bete()])).toEqual({ type: 'animosite', cible: 'homme-bete', sourceId: 'f', indice: undefined });
  });

  it('la Peur de Phobie s’arbitre avec les AUTRES portes : le plus haut Indice, la Terreur prime', () => {
    const self = obs({ psychTraits: [{ type: 'phobie', cible: 'homme-bete', indice: 1 }] });
    expect(fearSourceFor(self, bete({ causesPeur: 4 }))).toEqual({ kind: 'peur', indice: 4 });
    expect(fearSourceFor(self, bete({ causesTerreur: 1 }))).toEqual({ kind: 'terreur', indice: 1 });
  });
});

describe('#1224 écarts 2 & 3 — immunités par CANAL (LDB 21 l.41 / l.75)', () => {
  /** L'aimé, présent aux côtés du porteur : « tant que vous défendez les êtres aimés » (l.75). */
  const aime = C({ id: 'a', kind: 'hero', groups: ['humain'], wounds: { current: 10, max: 10 }, conditions: [] });

  it('Haine : le canal Peur du groupe haï — jamais la Terreur, jamais un autre groupe', () => {
    expect(findPsychologyById('haine')?.immuneToFromTarget).toEqual(['peur']);
    const hater = obs({ psychState: [{ type: 'haine', cible: 'homme-bete', active: true }] });
    expect(psychImmuneToFrom(hater, bete(), 'peur')).toBe(true);
    expect(psychImmuneToFrom(hater, bete(), 'terreur')).toBe(false);
    expect(psychImmuneToFrom(hater, bete({ groups: ['elfe'] }), 'peur')).toBe(false);
  });

  it('Amour : immunité hors-groupe, PORTÉE par `active` que la présence de l’aimé décide (l.75)', () => {
    expect(findPsychologyById('amour')?.immuneWhileActive).toEqual(['peur']);
    const aimant = obs({ psychState: [{ type: 'amour', cible: 'humain', active: true }] });
    const foe = bete({ groups: ['elfe'], causesPeur: 3 });
    expect(refreshDefendedPsych(aimant, [aimant, aime]), 'aimé présent : rien à changer').toBe(false);
    expect(psychImmuneToFrom(aimant, foe, 'peur')).toBe(true);
    expect(refreshDefendedPsych(aimant, [aimant]), 'aimé parti : le verdict bascule').toBe(true);
    expect(psychImmuneToFrom(aimant, foe, 'peur'), 'plus personne à défendre').toBe(false);
  });

  it('… et la source de Peur suit le MÊME drapeau : coupée avec l’aimé, subie sans lui', () => {
    const aimant = obs({ psychState: [{ type: 'amour', cible: 'humain', active: true }] });
    refreshDefendedPsych(aimant, [aimant, aime]);
    expect(fearSourceFor(aimant, bete({ causesPeur: 3 }))).toBeNull();
    expect(fearSourceFor(aimant, bete({ causesTerreur: 3 })), 'la Terreur passe').toEqual({ kind: 'terreur', indice: 3 });
    refreshDefendedPsych(aimant, [aimant]);
    expect(fearSourceFor(aimant, bete({ causesPeur: 3 }))).toEqual({ kind: 'peur', indice: 3 });
  });

  it('une affliction INACTIVE (Test réussi) n’immunise pas', () => {
    const tiede = obs({ psychState: [{ type: 'haine', cible: 'homme-bete', active: false }] });
    expect(psychImmuneToFrom(tiede, bete(), 'peur')).toBe(false);
    const amourTiede = obs({ psychState: [{ type: 'amour', cible: 'humain', active: false }] });
    expect(psychImmuneToFrom(amourTiede, bete(), 'peur')).toBe(false);
  });
});

describe('#1224 écart 4 — la pénalité SUR SUCCÈS vit en DONNÉE (LDB 21 l.19 / l.48)', () => {
  it('les modificateurs sont déclarés par l’entrée, plus par le moteur', () => {
    expect(findPsychologyById('animosite')?.containedSocialMod).toBe(-20);
    expect(findPsychologyById('prejuge')?.containedSocialMod).toBe(-10);
  });

  it('la branche de RÉUSSITE pose le marqueur, et ce marqueur PORTE la pénalité de Sociabilité', () => {
    const stake = { kind: 'animosite' as const, cible: 'homme-bete', sourceId: 'f', indice: 0 };
    expect(psychBranchOps(stake, { success: true })).toEqual([
      { op: 'beginPsych', type: 'animosite', active: false, fromTest: true, cible: 'homme-bete', sourceId: 'f' },
    ]);
    // L'état RÉELLEMENT posé par cette branche (possédé + résisté) est celui que lit le Test social.
    const contenu = obs({
      psychTraits: [{ type: 'animosite', cible: 'homme-bete' }],
      psychState: [{ type: 'animosite', cible: 'homme-bete', active: false }],
    });
    expect(socialPsychMod(contenu, ['homme-bete'])).toBe(-20);
    expect(socialPsychLabel(contenu, ['homme-bete'])).toBe('Animosité −20');
  });

  it('cumul Animosité + Préjugé, et DISPARITION dès que l’affliction devient ACTIVE (compulsion, LDB 21 l.21)', () => {
    const deux = obs({
      psychTraits: [{ type: 'animosite', cible: 'homme-bete' }, { type: 'prejuge', cible: 'homme-bete' }],
      psychState: [],
    });
    expect(socialPsychMod(deux, ['homme-bete'])).toBe(-30);
    expect(socialPsychLabel(deux, ['homme-bete'])).toBe('Animosité −20 · Préjugé −10');
    deux.psychState = [{ type: 'animosite', cible: 'homme-bete', active: true }];
    expect(socialPsychMod(deux, ['homme-bete']), 'sous compulsion : plus de malus « contenu »').toBe(-10);
  });
});
