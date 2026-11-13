/**
 * Option de confort « Dés fixés » (#939) : saisir soi-même la valeur du d100 d'un jet qu'on CONTRÔLE,
 * avant de le lancer comme après. Ce n'est PAS une règle de WFRP — c'est du confort, et le jet saisi est
 * évalué au NATUREL (réussite, DR, double → Critique), contrairement au dé CHOISI de la Résilience
 * (LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat », qui garantit la
 * réussite). Deux affordances distinctes, UN seul sélecteur — et un seul prédicat de contrôle,
 * `canFixDie`, qui compose `pilotedByHuman`/`controlsCombatant`/`seatOwns`. L'option gate l'affordance du siège
 * local, jamais le verbe : le dé d'un siège émetteur s'applique chez l'hôte qui ne l'a pas.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { seedBattleRng } from './battleRng';
import { FLOWS } from './rollFlowSpecs';
import { canFixDie, intentAllowedFor } from './netOwnership';
import { setDesFixes, resetDesFixes, FIXED_ROLL_MAX, clampFixedRoll } from '../engine/fixedDie';
import { bestForcedRoll, evaluateTest } from '../engine/tests';
import { startCascade } from './cascade';
import { spyApplier } from './cascade.testkit';
import { freeCons } from './rollSeam';
import type { CascadeStep } from './pendings';
import type { Combatant } from '../engine/types';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { deDeLaTableTiree } from '../engine/tables';

let banc: Banc;
/** Les lignes du journal de combat (`journaliser` : combat ouvert → `battle.log`). */
const lignesDeCombat = (): string[] => (banc.getState().battle?.log ?? []).map((e) => e.text);
beforeEach(() => {
  banc = ouvrirLeBanc();
});

const C = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'X', name: 'X', label: 'X', kind: 'heros',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  })) as unknown as Combatant;

/** Attaque RATÉE d'un héros (dé 88 vs cible 45), prête à être re-dérivée. */
function setupAttack(attackerOver: Partial<Combatant> = {}, targetOver: Partial<Combatant> = {}) {
  seedBattleRng(7);
  const attacker = C({ id: 'A', label: 'Att', resilience: 2, ...attackerOver });
  const target = C({ id: 'B', label: 'Cible', kind: 'ennemi', pos: { x: 1, y: 0 }, ...targetOver });
  banc.setState({
    battle: { combatants: [attacker, target], log: [], order: [attacker.id, target.id], turn: 0, round: 1 } as never,
    pendingAttack: {
      attackerId: attacker.id, targetId: target.id, location: null,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: null,
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      } as never,
    },
  });
}

const attackRoll = () => banc.getState().pendingAttack!.result!.attackerRoll;

beforeEach(() => {
  resetDesFixes();
  banc.setState({
    pendingAttack: null, pendingDefense: null, pendingCast: null, battle: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
});
afterEach(() => resetDesFixes());

describe('registre — l’option est une PRÉFÉRENCE de confort (zéro ligne d’UI)', () => {
  it('la saisie est bornée aux faces du d100', () => {
    expect(clampFixedRoll(0)).toBe(1);
    expect(clampFixedRoll(999)).toBe(FIXED_ROLL_MAX);
    expect(clampFixedRoll(33.7)).toBe(33);
  });
});

describe('option ON + héros piloté — le dé se saisit AVANT et APRÈS le jet', () => {
  beforeEach(() => setDesFixes(true));

  it('APRÈS le jet : le dé saisi remplace le jet et l’issue se re-dérive AU NATUREL (33 = double → Critique)', () => {
    setupAttack();
    banc.getState().jetImposerLeResultat('attaque', 33);
    const res = banc.getState().pendingAttack!.result!;
    expect(res.attackerRoll).toBe(33);
    expect(res.hit).toBe(true);
    expect(res.critical).toBe(true); // 33 = double réussi → Coup Critique, comme un vrai dé
    expect(res.attackerDetail!.sl).toBe(1); // dizaine(45) − dizaine(33)
    expect(banc.getState().pendingAttack!.fixed).toBe(true);
  });

  it('un dé fixé peut ÉCHOUER (≠ Résilience, qui garantit la réussite)', () => {
    setupAttack();
    banc.getState().jetImposerLeResultat('attaque', 99);
    const res = banc.getState().pendingAttack!.result!;
    expect(res.attackerRoll).toBe(99);
    expect(res.hit).toBe(false);
    expect(res.attackerDetail!.success).toBe(false);
  });

  it('ne dépense NI Résilience NI Chance', () => {
    setupAttack();
    const before = banc.getState().battle!.combatants.find((c) => c.id === 'A')!;
    const resil = before.resilience;
    banc.getState().jetImposerLeResultat('attaque', 33);
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience).toBe(resil);
  });

  it('le journal de combat porte la mention « dé fixé »', () => {
    setupAttack();
    banc.getState().jetImposerLeResultat('attaque', 33);
    const log = lignesDeCombat().join('\n');
    expect(log).toContain('dé fixé');
    // La valeur JOURNALISÉE est celle RÉELLEMENT appliquée au jet, relue sur le slot après commit.
    expect(log).toContain(String(attackRoll()));
    expect(log).toContain('33');
  });
});

describe('contrôle — `canFixDie` décrit l’AFFORDANCE LOCALE (jamais le geste d’autrui)', () => {
  beforeEach(() => setDesFixes(true));

  it('siège MJ d’un AUTRE joueur → l’ennemi ne s’affiche pas comme fixable ici', () => {
    setupAttack({ id: 'A', kind: 'ennemi' }, { id: 'B', kind: 'heros' });
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1, gmSeat: 0 } as never });
    expect(canFixDie(banc.getState(), 'A')).toBe(false);
  });

  it('étape MONDE (sans acteur) → siège MJ s’il existe, hôte sinon', () => {
    setupAttack();
    expect(canFixDie(banc.getState(), undefined)).toBe(true); // solo/hôte = siège 0
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } as never });
    expect(canFixDie(banc.getState(), undefined)).toBe(false);
    banc.setState({ net: { ...banc.getState().net, gmSeat: 1 } as never });
    expect(canFixDie(banc.getState(), undefined)).toBe(true);
  });

  it('un `ownerId` inconnu ne donne JAMAIS l’affordance', () => {
    setupAttack();
    expect(canFixDie(banc.getState(), 'inconnu')).toBe(false);
  });

  it('ennemi SANS siège MJ → aucune affordance (il est à l’IA)', () => {
    setupAttack({ id: 'A', kind: 'ennemi' }, { id: 'B', kind: 'heros' });
    expect(canFixDie(banc.getState(), 'A')).toBe(false);
  });
});

describe('option OFF — l’option gate l’AFFORDANCE de celui qui clique, pas le verbe', () => {
  it('le dé d’un siège émetteur s’applique chez celui qui exécute sans l’option, avec sa provenance et sa ligne', () => {
    setupAttack();
    expect(canFixDie(banc.getState(), 'A'), 'précondition : option OFF, aucune affordance locale').toBe(false);
    banc.getState().jetImposerLeResultat('attaque', 33);
    expect(attackRoll()).toBe(33);
    expect(banc.getState().pendingAttack!.fixed).toBe(true);
    expect(lignesDeCombat().join('\n')).toContain('dé fixé');
  });
});

describe('Résilience — le choix du dé reste OFFERT sans l’option (deux affordances, un sélecteur)', () => {
  it('le choix du dé n’est plus le privilège des flux à `caps.picker` : un flux à LENTILLE l’expose aussi', () => {
    // `rechargement`/`recuperation`/`evaluation`/`soins` ne déclarent AUCUN `caps.picker` — la fabrique le dérive de
    // leur lentille (`dieTarget` + `actorTR`), suggestion `bestForcedRoll` avant le jet.
    for (const key of ['rechargement', 'mainEnsanglantee', 'evaluation', 'soins', 'fuiteDeVapeur', 'chirurgie', 'dissipation', 'chansonDeMarin'] as const) {
      expect(typeof FLOWS[key].picker, key).toBe('function');
    }
  });
});

describe('provenance & re-dérivation — le dé courant fait foi (sonde `lens` promue)', () => {
  /** `handGate` : flux à LENTILLE, dé raté 88 vs cible 60. */
  function openHandGate() {
    banc.setState({
      battle: { combatants: [C({ id: 'H', label: 'Héros', resilience: 3 })], log: [] } as never,
      pendingHandGate: { attackerId: 'H', ligne: { base: 60, mods: [], target: 60, difficulty: 'facile' }, target: 60, roll: 88, sl: -3, success: false } as never,
    });
  }

  it('Résilience puis DEUX changements de dé successifs : chacun re-dérive (la cible reste lisible)', () => {
    openHandGate();
    banc.getState().jetForcerLaReussite('mainEnsanglantee');
    expect(banc.getState().pendingHandGate!.roll).toBe(bestForcedRoll(60));
    banc.getState().jetImposerLeResultat('mainEnsanglantee', 11);
    expect(banc.getState().pendingHandGate!.roll).toBe(11);
    banc.getState().jetImposerLeResultat('mainEnsanglantee', 55);
    const p = banc.getState().pendingHandGate!;
    expect(p.roll).toBe(55);
    expect(p.sl).toBe(Math.max(evaluateTest(55, 60).sl, 1));
    expect(p.success).toBe(true);
  });

  it('dé FIXÉ raté PUIS Résilience : la Résilience RE-TIRE le dé, la provenance « dé fixé » s’efface (LDB 17 l.68)', () => {
    openHandGate();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('mainEnsanglantee', 95);
    expect(banc.getState().pendingHandGate!.fixed).toBe(true);
    expect(banc.getState().pendingHandGate!.success, 'évalué au naturel : 95 > 60').toBe(false);
    banc.getState().jetForcerLaReussite('mainEnsanglantee');
    const p = banc.getState().pendingHandGate!;
    expect([p.forcee, p.success, !!p.fixed]).toEqual([true, true, false]);
  });

  it('pending FERMÉ (post-Appliquer) : le verbe est inerte, aucun crash', () => {
    openHandGate();
    setDesFixes(true);
    banc.setState({ pendingHandGate: null });
    expect(() => banc.getState().jetImposerLeResultat('mainEnsanglantee', 11)).not.toThrow();
    expect(banc.getState().pendingHandGate).toBeNull();
  });

  it('un dé FIXÉ ne consomme ni ne marque la Résilience', () => {
    openHandGate();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('mainEnsanglantee', 41);
    expect(banc.getState().pendingHandGate!.forcee).toBeFalsy();
    expect(banc.getState().battle!.combatants[0].resilience).toBe(3);
  });

  it('journal : mention NOMINATIVE de la valeur appliquée', () => {
    openHandGate();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('mainEnsanglantee', 41);
    expect(lignesDeCombat().join('\n')).toMatch(/Héros : dé fixé à 41/);
  });
});

describe('Test OPPOSÉ — plancher de Résilience vs évaluation naturelle du dé fixé', () => {
  /** Attaque ratée (88/45) contre un défenseur à DR 5. */
  function setupOpposed() {
    seedBattleRng(7);
    banc.setState({
      battle: { combatants: [C({ id: 'A', label: 'Att', resilience: 2 }), C({ id: 'B', label: 'Def', kind: 'ennemi', pos: { x: 1, y: 0 } })], log: [] } as never,
      pendingAttack: {
        attackerId: 'A', targetId: 'B', location: null,
        result: {
          hit: false, attackerRoll: 88, netSL: -9, critical: false, advantageTo: 'defenseur', defenderDefeated: false, log: 'raté',
          attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
          defenderDetail: { label: 'Esquive', base: 55, modifier: 0, target: 55, roll: 5, success: true, sl: 5 },
        } as never,
      },
    });
  }

  it('Résilience : « vous l’emportez avec au moins DR +1 » (LDB 17 l.68) — DR 6 contre un DR 5', () => {
    setupOpposed();
    banc.getState().jetForcerLaReussite('attaque');
    const r = banc.getState().pendingAttack!.result!;
    expect(r.attackerDetail!.sl).toBe(6);
    expect(r.hit).toBe(true);
  });

  it('dé CHOISI ensuite (11) : le plancher opposé TIENT et le double donne son Critique', () => {
    setupOpposed();
    banc.getState().jetForcerLaReussite('attaque');
    banc.getState().jetImposerLeResultat('attaque', 11);
    const r = banc.getState().pendingAttack!.result!;
    expect(r.attackerRoll).toBe(11);
    expect(r.attackerDetail!.sl).toBe(6);
    expect(r.critical).toBe(true);
  });

  it('dé FIXÉ 11 (option, sans Résilience) : AUCUN plancher — le DR est celui du dé', () => {
    setupOpposed();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('attaque', 11);
    const r = banc.getState().pendingAttack!.result!;
    expect(r.attackerRoll).toBe(11);
    expect(r.attackerDetail!.sl).toBe(evaluateTest(11, 45).sl);
    expect(banc.getState().pendingAttack!.forcee).toBeFalsy();
  });
});

describe('coop — un siège TIERS ne fixe le dé de personne (sonde S4 promue)', () => {
  it('la validation de possession accepte le PROPRIÉTAIRE et refuse le tiers', () => {
    setupAttack();
    banc.setState({ net: { ...banc.getState().net, mode: 'hote', mySeat: 0, roomCode: 'R', ownership: { A: 1 } } as never });
    expect(intentAllowedFor(banc.getState(), 1, 'jetImposerLeResultat', ['attaque', 33])).toBe(true);
    expect(intentAllowedFor(banc.getState(), 2, 'jetImposerLeResultat', ['attaque', 33])).toBe(false);
  });
});

describe('journal — la mention « dé fixé » suit le jet jusqu’à sa ligne persistée', () => {
  /** Attaque fixée puis APPLIQUÉE : la ligne du moteur (« touche … CRITIQUE ! ») doit porter la mention. */
  it('la ligne d’issue produite par l’Appliquer porte la mention', () => {
    setupAttack();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('attaque', 33); // double ≤ cible → touche + Critique
    banc.setState({ journal: [] });
    // Le pending est ENCORE ouvert pendant que l'applicateur compose : c'est la fenêtre du marquage.
    banc.getState().ecrireAuJournal('Att touche Cible à la tête · CRITIQUE !');
    expect(banc.getState().journal.join('\n')).toContain('(dé fixé)');
  });

  it('un jet NATUREL ne marque rien', () => {
    setupAttack(); // aucun dé saisi
    banc.setState({ journal: [] });
    banc.getState().ecrireAuJournal('Att touche Cible à la tête · CRITIQUE !');
    expect(banc.getState().journal.join('\n')).not.toContain('dé fixé');
  });

  it('aucun doublon : la ligne de fixation n’est pas re-marquée', () => {
    setupAttack();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('attaque', 33);
    const ligne = lignesDeCombat().find((l) => l.includes('dé fixé'))!;
    expect(ligne).toBe('Att : dé fixé à 33.');
  });

  it('pending REFERMÉ (hors modale) : plus aucune ligne n’est marquée', () => {
    setupAttack();
    setDesFixes(true);
    banc.getState().jetImposerLeResultat('attaque', 33);
    banc.setState({ pendingAttack: null, journal: [] });
    banc.getState().ecrireAuJournal('Le Gobelin se relève.');
    expect(banc.getState().journal.join('\n')).not.toContain('dé fixé');
  });
});

/**
 * GRANULARITÉ de la marque (#973) : la mention appartient à l'ÉTAPE qui émet, pas au slot entier. Une
 * séquence porte N étapes ; marquer tout le slot faisait porter « (dé fixé) » aux lignes d'une étape
 * tirée au NATUREL — mensonge d'autant plus visible depuis que les tirages sur table (#942 L4-L7)
 * gardent une séquence ouverte pendant tout un dénouement.
 */
describe('journal — la marque appartient à l’ÉTAPE qui émet, pas au slot (#973)', () => {
  const TBL = 'test-table-marque';
  const applied: string[] = [];

  const etape = (id: string): CascadeStep =>
    ({ id, kind: cleDeFixture('markSpy'), label: fixtureText('Tirage'), icon: 'navigation/des', table: { tableId: TBL }});

  beforeEach(() => {
    applied.length = 0;
    setDesFixes(true);
    banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    avecLesTables({ tablesTirables: { ...tablesDuJeu().tablesTirables, [TBL]: {
      label: 'Table de la marque',
      die: deDeLaTableTiree({ die: 'd100' }),
      rows: [{ min: 1, max: 50, id: 'basse', label: 'Ligne basse' }, { min: 51, max: 100, id: 'haute', label: 'Ligne haute' }],
      lines: (die) => [`ligne (dé ${die})`],
    } }, appliers: { ...tablesDuJeu().appliers, markSpy: spyApplier(applied, (s) => `conséquence de ${s.id} (dé ${s.table!.result!.roll})`, (s) => ({ consequences: freeCons([`conséquence de ${s.id} (dé ${s.table!.result!.roll})`]) })) } });
  });

  it('E1 dé POSÉ + E2 dé NATUREL : seule la ligne d’E1 porte la mention', () => {
    banc.getState().ensemencerLeTirage(4);
    startCascade(banc.getState, banc.setState, { title: 'Séquence', purpose: 'test', steps: [etape('e1'), etape('e2')] });
    banc.getState().jetImposerLeResultat('cascadeTirage', 33, 'e1');
    banc.setState({ journal: [] });
    banc.getState().jetValider('cascade'); // conséquence d'E1 : dé SAISI
    const apresE1 = banc.getState().journal.join('\n');
    expect(apresE1).toContain('conséquence de e1');
    expect(apresE1, 'la ligne du dé posé a perdu sa mention').toContain('dé fixé');
    banc.setState({ journal: [] });
    banc.getState().jetLancer('cascadeTirage', 'e2'); // dé NATUREL
    expect(banc.getState().pendingCascade!.participants[1].fixed).toBeUndefined();
    banc.getState().jetValider('cascade'); // conséquence d'E2
    const apresE2 = banc.getState().journal.join('\n');
    expect(apresE2).toContain('conséquence de e2');
    expect(apresE2, 'la marque d’E1 a contaminé la ligne d’E2').not.toContain('dé fixé');
  });

  it('slot MULTI à participants : un seul dé saisi ne marque pas les lignes du lot', () => {
    // Deux contributeurs, un seul dé saisi : aucune ligne n'est imputable au seul dé saisi — la
    // mention se tait plutôt que de mentir sur le jet du voisin (sous-marquer, jamais sur-marquer).
    banc.setState({
      journal: [],
      pendingCascade: null,
      pendingForceDoor: {
        participants: [
          { id: 'A', interactive: true, fixed: true, result: { roll: 33, target: 45, sl: 1, success: true } },
          { id: 'B', interactive: true, result: { roll: 54, target: 45, sl: -1, success: false } },
        ],
      } as never,
    });
    banc.getState().ecrireAuJournal('La porte cède.');
    expect(banc.getState().journal.join('\n')).not.toContain('dé fixé');
    // Le MONO reste le cas N=1 : seul participant, dé saisi → la ligne porte la mention.
    banc.setState({
      journal: [],
      pendingForceDoor: { participants: [{ id: 'A', interactive: true, fixed: true, result: { roll: 33, target: 45, sl: 1, success: true } }] } as never,
    });
    banc.getState().ecrireAuJournal('La porte cède.');
    expect(banc.getState().journal.join('\n')).toContain('dé fixé');
    banc.setState({ pendingForceDoor: null });
  });
});
