/**
 * LA LIGNE DE TRACE NE NOMME PAS UN COMBATTANT HORS DE VUE (#4017) : `TraceRow.who` et `TraceSide.who` s'écrivent par
 * `nomDe`, comme `OpposedFreeze.attackerName` ; l'issue d'une Approche nomme sa source par `nomEnVue`, celle d'un jet (`describeReload`…) son acteur, celle d'une Peur surmontée sa source. `siege-enceinte` pose au départ des assaillants que la muraille cache au groupe, d'autres qu'il voit.
 */
import { describe, expect, it } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { caseEnVue, combattantEnVue } from './visionDuGroupe';
import { discTiles } from './monde/zones';
import { isStructure } from '../engine/structures';
import { resolveActGates } from './combat/turnHooks';
import { resolveFlowTest } from './combat/triggeredTest';
import { jetsEnVue } from './jetsEnVue';
import { appliquerLaRecharge, jetDeRecharge, openAttackCascade, openRoundEndCascade } from './combatFlow';
import { draineEtLit } from './cascade.testkit';
import { testDeRegle } from '../engine/reglesChiffrees';
import { EMPTY_FLOW, type Flow } from '../engine/flowCore';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios/index';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { Combatant } from '../engine/types';
import { fenetreDAttaque } from './fenetreDAttaque';
import { libelleDuDepot } from './interludeEnVue';
import { createHero } from '../engine/character';
import { formatMoney, fromBrass } from '../engine/money';
import { applyShipManeuver, rollShipManeuver } from './shipManeuver';
import { supersededLines, type PsychAffliction } from '../engine/psychology';
import { psychologyLabel } from '../data';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

const INCONNU = t('vision.horsDeVue');

/** Le banc sur `siege-enceinte`, un assaillant hors de vue et un en vue. */
function siege() {
  const banc = ouvrirLeBanc();
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((s) => s.id === 'siege-enceinte')!, idsDeTest));
  const etat = banc.getState() as unknown as Jeu;
  const ennemis = etat.battle!.combatants.filter((c) => c.kind === 'ennemi');
  const cache = ennemis.find((c) => !combattantEnVue(etat, c));
  const vu = ennemis.find((c) => combattantEnVue(etat, c));
  expect(cache, 'un assaillant hors de vue').toBeDefined();
  expect(vu, 'un assaillant en vue').toBeDefined();
  return { banc, cache: cache!, vu: vu! };
}

/** La ligne du Test d'agir (`resolveActGates`) que `c` jette sous un effet qui l'exige. */
function ligneDuTestDAgir(banc: ReturnType<typeof siege>['banc'], c: Combatant): string {
  c.activeEffects = [{ label: 'Racine de mandragore', bonus: 0, duration: { scale: 'clock', until: 99999 }, testDAgir: { characteristic: 'force-mentale' } }];
  return resolveActGates(banc.getState, banc.setState, c).lines[0];
}

describe('TraceRow.who — la ligne d’un Test jeté sans fenêtre', () => {
  it('hors de vue : « Inconnu »', () => {
    const { banc, cache } = siege();
    const ligne = ligneDuTestDAgir(banc, cache);
    expect(ligne.startsWith(`${INCONNU} `), ligne).toBe(true);
    expect(ligne.includes(cache.label), ligne).toBe(false);
  });

  it('en vue : son nom', () => {
    const { banc, vu } = siege();
    const ligne = ligneDuTestDAgir(banc, vu);
    expect(ligne.startsWith(`${vu.label} `), ligne).toBe(true);
  });
});

describe('TraceSide.who — la ligne d’un Test opposé jeté sans fenêtre', () => {
  it('l’attaquant hors de vue se dit « Inconnu », le défenseur en vue par son nom', () => {
    const { banc, cache, vu } = siege();
    const noeud = { kind: 'test', test: { characteristic: 'force', opposed: { attacker: 'force' } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } as Extract<Flow, { kind: 'test' }>;
    resolveFlowTest({ get: banc.getState, set: banc.setState, target: vu, caster: cache, label: 'Test opposé' }, noeud, EMPTY_FLOW);
    const lignes = banc.getState().pendingLogQueue.map((l) => l.line);
    const ligne = lignes.find((l) => l.includes(vu.label));
    expect(ligne, lignes.join('\n')).toBeDefined();
    expect(ligne!.startsWith(`${INCONNU} `), ligne).toBe(true);
    expect(lignes.some((l) => l.includes(cache.label)), lignes.join('\n')).toBe(false);
  });
});

describe('OpposedFreeze.attackerName — la ligne du jet figé d’un Test opposé en fenêtre', () => {
  /** Les libellés des lignes de jet de la fenêtre ouverte quand `attaquant` oppose sa Force à un héros. */
  function lignesDeLaFenetre(attaquant: 'cache' | 'vu'): { tests: string[]; nom: string } {
    const s = siege();
    const etat = s.banc.getState() as unknown as Jeu;
    const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
    const noeud = { kind: 'test', test: { characteristic: 'force', opposed: { attacker: 'force' }, stake: { key: { dataset: 'combat', kind: 'mutation' } } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } as Extract<Flow, { kind: 'test' }>;
    resolveFlowTest({ get: s.banc.getState, set: s.banc.setState, target: heros, caster: s[attaquant], label: 'Test opposé' }, noeud, EMPTY_FLOW);
    const tests = jetsEnVue(s.banc.getState() as unknown as Jeu).flatMap((j) => j.lignes).flatMap((l) => (l.genre === 'test' ? [l.test] : []));
    return { tests, nom: s[attaquant].label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { tests, nom } = lignesDeLaFenetre('cache');
    expect(tests.some((l) => l.startsWith(`${INCONNU} — `)), tests.join('\n')).toBe(true);
    expect(tests.some((l) => l.includes(nom)), tests.join('\n')).toBe(false);
  });

  it('en vue : son nom', () => {
    const { tests, nom } = lignesDeLaFenetre('vu');
    expect(tests.some((l) => l.startsWith(`${nom} — `)), tests.join('\n')).toBe(true);
  });
});

describe('PendingApproach — l’issue d’une Approche nomme sa source par `nomEnVue`', () => {
  /** La ligne de journal de l'Approche ratée d'un héros vers `source`. */
  function ligneDeLApproche(source: 'cache' | 'vu'): { ligne: string; nom: string } {
    const s = siege();
    const etat = s.banc.getState() as unknown as Jeu;
    const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
    s.banc.setState({ pendingApproach: { combatantId: heros.id, test: testDeRegle('calme-d-approche', 'se-rapprocher'), sourceId: s[source].id, intent: { kind: 'tile', pt: { x: 0, y: 0 } }, result: { success: false, roll: 95, target: 30, sl: -6 } } });
    s.banc.getState().jetValider('approche');
    const log = (s.banc.getState() as unknown as Jeu).battle!.log;
    return { ligne: log[log.length - 1].text, nom: s[source].label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { ligne, nom } = ligneDeLApproche('cache');
    expect(ligne.includes(INCONNU), ligne).toBe(true);
    expect(ligne.includes(nom), ligne).toBe(false);
  });

  it('en vue : son nom', () => {
    const { ligne, nom } = ligneDeLApproche('vu');
    expect(ligne.includes(nom), ligne).toBe(true);
  });
});

describe('actorName — l’issue d’un jet nomme son acteur par `nomEnVue`', () => {
  /** La ligne de journal du Rechargement inachevé, par `qui`, d'une arme d'assaillant (`appliquerLaRecharge`, le tour de l'IA). */
  function ligneDeRecharge(qui: 'cache' | 'vu'): { ligne: string; nom: string } {
    const s = siege();
    const c = s[qui];
    const arme = [s.cache, s.vu].flatMap((x) => x.weapons)[0]; // l'assaillant en vue peut n'en porter aucune
    const jeu = s.banc.getState() as unknown as Jeu;
    const pr = { ...jetDeRecharge(jeu.scene, c, arme, jeu.battle!.combatants), reload: 3, roll: 40, sl: 1, success: true };
    appliquerLaRecharge(s.banc.getState, s.banc.setState, pr, arme);
    const log = (s.banc.getState() as unknown as Jeu).battle!.log;
    return { ligne: log[log.length - 1].text, nom: c.label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { ligne, nom } = ligneDeRecharge('cache');
    expect(ligne.includes(INCONNU), ligne).toBe(true);
    expect(ligne.includes(nom), ligne).toBe(false);
  });

  it('en vue : son nom', () => {
    const { ligne, nom } = ligneDeRecharge('vu');
    expect(ligne.includes(nom), ligne).toBe(true);
  });
});

describe('sourceName de la psychologie — la Peur surmontée nomme sa source par `nomDe`', () => {
  /** La ligne de journal de la Peur de `source` qu'un héros surmonte au Test étendu de fin de Round (LDB 21 l.25). */
  function ligneDeLaPeur(source: 'cache' | 'vu'): { lignes: string[]; nom: string } {
    const s = siege();
    const etat = s.banc.getState() as unknown as Jeu;
    const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
    heros.characteristics['force-mentale'] = 200; // le Test de Calme réussit, la Peur d'Indice 1 tombe
    heros.psychState = [{ type: 'peur', sourceId: s[source].id, indice: 1, calmeDR: 0 }];
    s.banc.setState({ battle: { ...etat.battle!, round: etat.battle!.round + 1 }, pendingCascade: null });
    openRoundEndCascade(s.banc.getState, s.banc.setState);
    const lues = draineEtLit(s.banc.getState);
    return { lignes: lues.filter((l) => l.includes(heros.label)), nom: s[source].label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { lignes, nom } = ligneDeLaPeur('cache');
    expect(lignes.some((l) => l.includes(INCONNU)), lignes.join('\n')).toBe(true);
    expect(lignes.some((l) => l.includes(nom)), lignes.join('\n')).toBe(false);
  });

  it('en vue : son nom', () => {
    const { lignes, nom } = ligneDeLaPeur('vu');
    expect(lignes.some((l) => l.includes(nom)), lignes.join('\n')).toBe(true);
  });
});

describe('libelleDuDepot — le libellé d’un dépôt nomme son héros par `nomEnVue` sur l’état qu’il reçoit', () => {
  it('l’état reçu fait foi, pas l’état publié que lit le nommeur', () => {
    const banc = ouvrirLeBanc();
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 7 });
    banc.setState({ party: [h], battle: null, interlude: null, bank: [], journal: [] });
    const recu = { ...banc.getState(), party: [{ ...h, label: 'Hilde' }] } as unknown as Jeu;
    const depot = { uid: 'd1', heroId: h.id, kind: 'planque', brass: 240, rate: 0 } as const;
    expect(libelleDuDepot(recu, depot)).toBe(t('interlude.depot.planque', { heros: 'Hilde', montant: formatMoney(fromBrass(240)) }));
  });
});

describe('fenetreDAttaque.attente — l’attente de la Défense nomme sa cible par `nomEnVue`', () => {
  /** L'attente de la fenêtre d'attaque quand un assaillant, piloté au siège MJ, frappe au contact un autre assaillant
   *  `en vue` ou non : la Défense de la cible, ennemie, se joue au siège MJ. */
  function attenteDeLaDefense(enVue: boolean): { attente: string | null; nom: string } {
    const s = siege();
    s.banc.getState().fenetreValider('debutDuRound');
    draineEtLit(s.banc.getState);
    const etat = s.banc.getState() as unknown as Jeu;
    const b = etat.battle!;
    const armes = b.combatants.filter((c) => c.kind === 'ennemi' && !isStructure(c) && c.weapons.some((w) => w.type === 'melee'));
    const cible = armes.find((c) => combattantEnVue(etat, c) === enVue)!;
    const frappeur = armes.find((c) => c.id !== cible.id)!;
    const arme = frappeur.weapons.find((w) => w.type === 'melee')!;
    const voisine = discTiles(cible.pos!, 1, cible.pos!.z).find((p) => (p.x !== cible.pos!.x || p.y !== cible.pos!.y) && !b.combatants.some((c) => c.pos?.x === p.x && c.pos?.y === p.y) && caseEnVue(etat, p) === enVue)!;
    frappeur.pos = { ...voisine, z: cible.pos!.z };
    s.banc.setState({ net: { ...s.banc.getState().net, gmSeat: 0 }, battle: { ...b, turn: b.order.indexOf(frappeur.id), movementUsed: 0, movedPreAction: false, acted: false } });
    expect(combattantEnVue(s.banc.getState() as unknown as Jeu, cible), 'la cible garde sa vue').toBe(enVue);
    openAttackCascade(s.banc.getState, s.banc.setState, { attackerId: frappeur.id, targetId: cible.id, location: null, result: null, weaponUid: arme.uid }, 'Attaque', 'action/attaquer');
    s.banc.getState().jetLancer('attaque');
    return { attente: fenetreDAttaque(s.banc.getState() as unknown as Jeu)!.attente, nom: cible.label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { attente, nom } = attenteDeLaDefense(false);
    expect(attente).toBe(t('defense.awaiting', { cible: INCONNU }));
    expect(attente!.includes(nom), attente!).toBe(false);
  });

  it('en vue : son nom', () => {
    const { attente, nom } = attenteDeLaDefense(true);
    expect(attente).toBe(t('defense.awaiting', { cible: nom }));
  });
});

describe('ManeuverResult.helmsman — l’échec de manœuvre d’un navire ennemi (l’IA navale, `maneuverShip`)', () => {
  /** Le journal d’une barre qu’un navire ennemi, mis à l’eau à la case de `c` et imposé à sa propre barre, ne peut pas tenir. */
  function journalDeLaBarre(c: Combatant, banc: ReturnType<typeof siege>['banc']): { lignes: string[]; navire: Combatant } {
    const navire = combattantDeTest({ id: 'navire', label: 'Barge', kind: 'ennemi', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', pos: { ...c.pos! }, conditions: [], weapons: [] });
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, combatants: [...b.combatants, navire] } });
    expect(combattantEnVue(banc.getState() as unknown as Jeu, navire), 'le navire garde la vue de sa case').toBe(combattantEnVue(banc.getState() as unknown as Jeu, c));
    const avant = banc.getState().journal.length;
    applyShipManeuver(banc.getState, navire.id, rollShipManeuver(banc.getState, navire.id, navire.id)!, 2);
    return { lignes: banc.getState().journal.slice(avant), navire };
  }
  const tete = (nom: string) => t('shipManv.failLine', { helmsman: nom, ship: nom, dr: 0 }).split(' (DR')[0];

  it('hors de vue : le barreur et le navire se disent « Inconnu »', () => {
    const { banc, cache } = siege();
    const { lignes, navire } = journalDeLaBarre(cache, banc);
    expect(lignes.some((l) => l.startsWith(tete(INCONNU))), lignes.join('\n')).toBe(true);
    expect(lignes.some((l) => l.includes(navire.label)), lignes.join('\n')).toBe(false);
  });

  it('en vue : leur nom', () => {
    const { banc } = siege();
    const etat = banc.getState() as unknown as Jeu;
    const vu = etat.battle!.combatants.find((c) => c.kind === 'heros' && c.pos)!;
    const { lignes, navire } = journalDeLaBarre(vu, banc);
    expect(lignes.some((l) => l.startsWith(tete(navire.label))), lignes.join('\n')).toBe(true);
  });
});

describe('turn.psychSuperseded — l’affliction qu’un effet plus fort éclipse (`supersededLines`)', () => {
  /** La ligne de l’Animosité de `c` que sa Peur éclipse. */
  function ligneEclipsee(c: Combatant): string {
    c.psychState = [{ type: 'animosite', active: true }, { type: 'peur', sourceId: 'source', indice: 1, calmeDR: 0 }] as PsychAffliction[];
    return supersededLines(c)[0];
  }

  it('hors de vue : « Inconnu »', () => {
    const { cache } = siege();
    expect(ligneEclipsee(cache)).toBe(t('turn.psychSuperseded', { name: INCONNU, psych: psychologyLabel('animosite') }));
  });

  it('en vue : son nom', () => {
    const { vu } = siege();
    expect(ligneEclipsee(vu)).toBe(t('turn.psychSuperseded', { name: INCONNU, psych: psychologyLabel('animosite') }).replace(INCONNU, vu.label));
  });
});
