/**
 * LA CASSE D'UNE ARME PASSE PAR LA PORTE (#1508 T3b-4) — jumeau de `combat/sauvegarde-a-la-porte.test.ts`.
 *
 * `LDB 60 l.30` (Solide) : « Fabriqué en utilisant des matériaux robustes, l'objet peut encaisser
 * *Indice* Points de Dégâts avant de subir des pénalités […] et gagner un Test de Sauvegarde de 9+ sur
 * un lancer de 1d10 contre une cassure instantanée, issue de sources comme Lame piégée […] Chaque fois
 * qu'il est pris, le Test de Sauvegarde est amélioré de 1 (par exemple de 9+ à 8+). »
 * `LDB 60 l.50` (Bâclé) ; `LDB 62 l.280` (Piège-lame) ; `AA 10 l.264` (Salve : « Si l'arme subit un
 * Incident de tir à n'importe quel moment du processus, déterminez-en les effets puis faites un jet
 * dans le tableau suivant. »).
 *
 * Ce que ces contrats tiennent :
 *  - le dé NAÎT NON RÉSOLU en étape de cascade, AVANT toute mutation de l'arme ;
 *  - l'étape PORTE son seuil : la fenêtre montre « ≥ Solide (9+) » avant le lancer ;
 *  - le dé POSÉ décide : ≥ Indice → l'arme tient ; < Indice → elle casse ;
 *  - la table de Salve est une ÉTAPE À TABLE (la LIGNE tirée est montrée), et la sauvegarde qui la
 *    suit n'existe QUE si cette ligne détruit la pièce (grappe dépendante) ;
 *  - AUCUNE scission par porteur : un ennemi conduit par l'IA suit le MÊME chemin, son dé étant roulé
 *    au socle faute de siège ;
 *  - ce que l'appelant fera APRÈS le coup ne se joue qu'APRÈS le dé.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyOups, applyAttackResult, applyBladeTrap } from './combatFlow';
import { OPS_DIFFEREES } from './combatEffects';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import { stepInteraction } from './cascade';
import { pushHost } from './rollSeam';
import type { CascadeStep, BladeTrapFreeze } from './pendings';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { OupsResolved } from '../engine/oups';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[], party: Combatant[] = []): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party, journal: [], pendingCascade: null, suspendedCascades: [], pendingFateSave: null, pendingLogQueue: [] });
}

/** L'étape COURANTE de la séquence en vol (celle que la fenêtre servirait). */
const etapeCourante = (): CascadeStep | undefined => {
  const p = useGame.getState().pendingCascade;
  return p?.participants[p.cursor];
};

/** POSE un dé (nu ou de table) sur l'étape courante et la valide — le geste du joueur, jamais un
 *  appel moteur. Rend l'id de l'étape jouée. */
function poser(valeur: number): string {
  const st = etapeCourante();
  expect(st, 'aucune étape à jouer').toBeDefined();
  if (st!.de) useGame.getState().cascadeDieSetForcedRoll(st!.id, valeur);
  if (st!.table) useGame.getState().cascadeTableSetForcedRoll(st!.id, valeur);
  useGame.getState().cascadeNext();
  return st!.id;
}

/** Ce que le joueur a lu — conséquences des étapes + journal de combat. */
const lignesLues = (): string[] => [
  ...(useGame.getState().pendingCascade?.participants ?? []).flatMap((s) => (s.outcome ?? []).map((l) => l.text)),
  ...(useGame.getState().battle?.log ?? []).map((l) => l.text),
];

const MALADRESSE: OupsResolved = { roll: 33, kind: 'actionPenalty', label: 'Vous perdez pied' };
const INCIDENT: OupsResolved = { roll: 44, kind: 'misfire', label: 'Incident de Tir !' };

const epeeBacleeSolide = (): Weapon =>
  ({ label: 'Épée bâclée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] }) as unknown as Weapon;

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, suspendedCascades: [] });
});

describe('Bâclé + Solide — le dé naît à la porte, AVANT toute mutation de l’arme', () => {
  const monte = (): { hero: Combatant; arme: Weapon } => {
    const arme = epeeBacleeSolide();
    const hero = mk('hero', 'bretteur', { weapons: [arme] });
    setBattle([hero], [hero]);
    return { hero, arme };
  };

  it('l’étape de Sauvegarde Solide est OUVERTE, portant son seuil, et l’arme n’a pas bougé', () => {
    const { hero, arme } = monte();
    const issue = applyOups(useGame.getState, useGame.setState, hero, arme, MALADRESSE);
    expect(issue, 'rien n’est appliqué tant que le dé n’est pas tombé').toBe(OPS_DIFFEREES);
    const st = etapeCourante()!;
    expect(st.kind).toBe('casseDArme');
    expect(stepInteraction(st), 'le dé reste à jeter').toBe('de');
    expect(st.de?.spec, 'un 1d10, celui du RAW').toEqual({ n: 1, sides: 10 });
    expect(st.de?.seuil, 'l’étape PORTE son seuil — la fenêtre peut le montrer').toEqual({ indice: 9, source: { kind: 'qualite', id: 'solide' }, dome: false });
    expect(st.actorId, 'le porteur du dé est celui qui tient l’arme').toBe(hero.id);
    expect(arme.destroyed, 'aucune casse avant le dé').toBeFalsy();
    expect(hero.nextActionPenalty, 'la Maladresse elle-même attend son dé').toBeFalsy();
  });

  it('dé POSÉ à 9 (= Indice) : l’arme tient le choc, et la ligne le dit', () => {
    const { hero, arme } = monte();
    applyOups(useGame.getState, useGame.setState, hero, arme, MALADRESSE);
    poser(9);
    expect(arme.destroyed, 'LDB 60 l.30 : « 9+ » sauve').toBeFalsy();
    expect(hero.nextActionPenalty, 'la Maladresse, elle, s’applique bien').toBe(10);
    expect(lignesLues().some((l) => /Épée bâclée tient le choc — Sauvegarde 1d10 : 9 ≥ Solide \(9\+\)\./.test(l)), lignesLues().join(' | ')).toBe(true);
  });

  it('dé POSÉ à 8 (< Indice) : l’arme casse, et la ratée s’écrit aussi', () => {
    const { hero, arme } = monte();
    applyOups(useGame.getState, useGame.setState, hero, arme, MALADRESSE);
    poser(8);
    expect(arme.destroyed, 'la sauvegarde a manqué : l’arme est brisée (LDB 60 l.50)').toBe(true);
    expect(lignesLues().some((l) => /Épée bâclée ne résiste pas — Sauvegarde 1d10 : 8 < Solide \(9\+\)\./.test(l)), lignesLues().join(' | ')).toBe(true);
  });
});

/**
 * LE CHEMIN DU JOUEUR (#1508 T3b-4) : la Maladresse est une étape HÔTE de la cascade de combat, jouée
 * par les verbes du store (« Lancer sur le Tableau des Oups ! » puis « Appliquer »). Une casse partie à
 * la porte s'appende DERRIÈRE cette étape : le curseur enchaine dessus, il ne reste pas sur la
 * Maladresse — sinon chaque « Appliquer » repousse un doublon de la même sauvegarde.
 */
describe('Bâclé — le joueur applique sa Maladresse par le STORE (étape hôte + curseur)', () => {
  const monteHote = (arme: Weapon): Combatant => {
    const hero = mk('hero', 'bretteur', { weapons: [arme] });
    setBattle([hero], [hero]);
    pushHost(useGame.getState, useGame.setState, { id: `cons-fumble-${hero.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: hero.id, fumble: { weapon: arme, result: null } });
    return hero;
  };
  const etapesDeCasse = (): CascadeStep[] =>
    (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.id.startsWith('casse-'));

  it('Bâclé + Solide : « Appliquer » pose le curseur SUR le dé de Sauvegarde, et un 2ᵉ « Appliquer » ne repousse rien', () => {
    const arme = epeeBacleeSolide();
    monteHote(arme);
    useGame.getState().fumbleRoll();
    useGame.getState().fumbleConfirm();
    const st = etapeCourante()!;
    expect(st.kind, 'le curseur est SUR la casse, pas resté sur la Maladresse').toBe('casseDArme');
    expect(st.de?.seuil?.indice, 'la fenêtre montre « ≥ Solide (9+) »').toBe(9);
    expect(arme.destroyed, 'aucune casse avant le dé').toBeFalsy();
    expect(etapesDeCasse().length, 'une seule sauvegarde poussée').toBe(1);

    const avant = { etapes: useGame.getState().pendingCascade!.participants.length, seq: useGame.getState().pendingCascade!.seq, log: lignesLues() };
    useGame.getState().fumbleConfirm(); // le joueur re-clique « Appliquer »
    expect(useGame.getState().pendingCascade!.participants.length, 'aucun doublon d’étape').toBe(avant.etapes);
    expect(useGame.getState().pendingCascade!.seq, 'le compteur d’identité n’a pas bougé').toBe(avant.seq);
    expect(lignesLues(), 'rien n’a été rejoué').toEqual(avant.log);

    poser(8);
    expect(arme.destroyed, 'la sauvegarde manquée brise l’arme (LDB 60 l.50)').toBe(true);
    const lues = lignesLues();
    expect(lues.some((l) => /Épée bâclée ne résiste pas — Sauvegarde 1d10 : 8 < Solide \(9\+\)\./.test(l)),
      lues.join(' | ')).toBe(true);
    // Le JOURNAL de combat, dans son ordre : la Maladresse, PUIS l'arme qu'elle brise (sans cette
    // seconde ligne, l'arme disparaît des mains du porteur sans qu'un mot ne le dise).
    const journal = (useGame.getState().battle?.log ?? []).map((l) => l.text);
    const iMaladresse = journal.findIndex((l) => /^bretteur — Maladresse !/.test(l));
    const iBrisee = journal.findIndex((l) => /Épée bâclée \(Bâclé\) se brise sur la Maladresse de bretteur\./.test(l));
    expect(iMaladresse, journal.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(iBrisee, journal.join(' | ')).toBeGreaterThan(iMaladresse);
  });

  it('Bâclé + Solide, dé posé à 9 : l’arme tient, et RIEN ne parle d’arme brisée', () => {
    const arme = epeeBacleeSolide();
    monteHote(arme);
    useGame.getState().fumbleRoll();
    useGame.getState().fumbleConfirm();
    poser(9);
    expect(arme.destroyed, 'LDB 60 l.30 : « 9+ » sauve').toBeFalsy();
    const lues = lignesLues();
    expect(lues.some((l) => /Épée bâclée tient le choc/.test(l)), lues.join(' | ')).toBe(true);
    expect(lues.some((l) => /se brise sur la Maladresse/.test(l)), 'une arme sauvée n’est pas brisée').toBe(false);
  });

  it('Bâclé SANS Solide : aucune étape de casse, l’arme est brisée, le journal le dit, et le curseur a quitté la Maladresse', () => {
    const arme = { label: 'Épée bâclée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'bacle' }] } as unknown as Weapon;
    monteHote(arme);
    useGame.getState().fumbleRoll();
    useGame.getState().fumbleConfirm();
    expect(etapesDeCasse().length, 'sans Solide, aucun dé à la porte').toBe(0);
    expect(arme.destroyed, 'Bâclé casse sur toute Maladresse (LDB 60 l.50)').toBe(true);
    expect((useGame.getState().battle?.log ?? []).map((l) => l.text).some((l) => /Épée bâclée \(Bâclé\) se brise sur la Maladresse de bretteur\./.test(l)),
      (useGame.getState().battle?.log ?? []).map((l) => l.text).join(' | ')).toBe(true);
    expect(useGame.getState().pendingCascade, 'la Maladresse étant la seule étape, le curseur la referme').toBeNull();
  });
});

describe('Incident de tir + Salve — la table est une ÉTAPE, et la grappe est DÉPENDANTE', () => {
  const piece = (): Weapon =>
    ({ label: 'Batterie', type: 'ranged', damage: { plusBF: false, flat: 12 }, chambered: 3, qualities: [{ id: 'salve', value: 9 }, { id: 'solide', value: 1 }] }) as unknown as Weapon;

  it('trois dés dans l’ordre : Sauvegarde Solide, TABLE de Salve, puis la sauvegarde de la pièce détruite', () => {
    const arme = piece();
    const hero = mk('hero', 'canonnier', { weapons: [arme] });
    setBattle([hero], [hero]);
    expect(applyOups(useGame.getState, useGame.setState, hero, arme, INCIDENT)).toBe(OPS_DIFFEREES);
    expect(etapeCourante()!.id, 'le 1ᵉʳ dé est la Sauvegarde Solide de l’Incident').toContain('misfire-solide');
    expect(hero.wounds.current, 'aucune Blessure avant les dés').toBe(30);
    poser(9); // l'arme tient l'Incident de tir
    const table = etapeCourante()!;
    expect(table.table?.tableId, 'le 2ᵉ dé est la TABLE (AA 10 l.264), pas un dé nu').toBe('artillery-salve-misfire');
    expect(stepInteraction(table)).toBe('table');
    poser(2); // ligne 1-4 « Bras principal » : la pièce est DÉTRUITE
    expect(etapeCourante()!.id, 'la sauvegarde de la pièce n’existe que parce que la ligne la détruit').toContain('salve-solide');
    poser(9); // elle tient
    expect(arme.destroyed, 'la pièce a sauvé ses deux cassures').toBeFalsy();
    expect(hero.wounds.current, 'l’Incident et la ligne de Salve ont bien frappé').toBeLessThan(30);
    const lues = lignesLues().join(' | ');
    expect(lues, 'la ligne TIRÉE est celle du dé posé').toContain('Bras principal');
  });

  it('ligne 10 (tir perdu) : la pièce n’est pas détruite → AUCUNE sauvegarde de plus', () => {
    const arme = piece();
    const hero = mk('hero', 'canonnier', { weapons: [arme] });
    setBattle([hero], [hero]);
    applyOups(useGame.getState, useGame.setState, hero, arme, INCIDENT);
    poser(9);
    poser(10); // « Tir perdu » : pièce intacte
    expect(etapeCourante()?.id ?? '', 'la grappe s’arrête : rien à sauver').not.toContain('salve-solide');
    expect(arme.destroyed).toBeFalsy();
  });
});

describe('aucune scission par PORTEUR — un ennemi conduit par l’IA suit le MÊME chemin', () => {
  it('le dé est roulé AU SOCLE (aucun siège ne le tient), et l’arme en subit l’issue', () => {
    const arme = epeeBacleeSolide();
    const brute = mk('enemy', 'brute', { weapons: [arme] });
    setBattle([brute]);
    const issue = applyOups(useGame.getState, useGame.setState, brute, arme, MALADRESSE);
    expect(issue, 'la casse part à la porte pour un ennemi aussi').toBe(OPS_DIFFEREES);
    const st = etapeCourante()!;
    expect(st.kind).toBe('casseDArme');
    expect(st.actorId).toBe(brute.id);
    expect(st.de?.result, 'aucun siège ne tient ce dé : le socle l’a roulé d’office').toBeTruthy();
    const total = st.de!.result!.total;
    useGame.getState().cascadeNext();
    expect(Boolean(arme.destroyed), `dé ${total} : l’arme casse si et seulement si le dé rate le 9+`).toBe(total < 9);
    expect(brute.nextActionPenalty, 'la Maladresse s’applique à la reprise').toBe(10);
  });
});

describe('la SUITE du coup ne se joue qu’APRÈS le dé', () => {
  it('Maladresse du défenseur ENNEMI : `applyAttackResult` rend « suspendu », et l’Action gratuite n’est rendue qu’à la reprise', () => {
    const arme = epeeBacleeSolide();
    const hero = mk('hero', 'frappeur', { pos: { x: 0, y: 0 }, weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon] });
    const brute = mk('enemy', 'brute', { pos: { x: 1, y: 0 }, weapons: [arme] });
    setBattle([hero, brute], [hero]);
    const res: AttackResult = {
      hit: true, attackerRoll: 30, netSL: 2, location: 'corps', damage: 5, woundsLost: 3,
      critical: false, advantageTo: null, defenderDefeated: false, log: 'touche.',
      defenderDetail: { roll: 33, success: false, sl: -3 },
    } as unknown as AttackResult;
    const suspendu = applyAttackResult(useGame.getState, useGame.setState, hero, brute, hero.weapons[0], res, false, undefined, { freeAttack: { kind: 'frappe-reactive', prevActed: false } });
    expect(suspendu, 'le site rend « suspendu » parce que la casse est partie à la porte').toBe(true);
    expect(etapeCourante()!.kind).toBe('casseDArme');
    expect(arme.destroyed, 'l’arme du défenseur n’a pas encore cassé').toBeFalsy();
    expect(useGame.getState().battle!.acted, 'l’Action du coup est consommée ; la suite (Action rendue) n’a PAS joué').toBe(true);
    poser(8);
    expect(arme.destroyed, 'le dé raté casse l’arme').toBe(true);
    expect(useGame.getState().battle!.acted, 'la suite emportée par la charge est jouée À LA REPRISE, une fois').toBe(false);
  });

  it('les DEUX Maladresses du même coup coexistent : chaque porteur joue la sienne UNE fois, et la suite vient en dernier', () => {
    const armeAttaquant = epeeBacleeSolide();
    const armeDefenseur = epeeBacleeSolide();
    // Attaquant conduit par l'automate (Auto-combat) → sa Maladresse passe par `resolveEnemyFumble`.
    const frappeur = mk('hero', 'frappeur', { pos: { x: 0, y: 0 }, weapons: [armeAttaquant], aiControlled: true });
    const rival = mk('enemy', 'rival', { pos: { x: 1, y: 0 }, weapons: [armeDefenseur] });
    setBattle([frappeur, rival], [frappeur]);
    // Test opposé raté des DEUX côtés sur un double (LDB 14 l.13) : l'attaquant ET le défenseur
    // ennemi bâclent le MÊME échange, chacun avec une arme Bâclé + Solide (donc un dé à la porte).
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 1, location: 'corps', damage: 5, woundsLost: 3,
      critical: false, advantageTo: null, defenderDefeated: false, log: 'touche.',
      attackerDetail: { roll: 33, success: false, sl: -2 },
      defenderDetail: { roll: 44, success: false, sl: -3 },
    } as unknown as AttackResult;
    const maladresses = (label: string): number =>
      (useGame.getState().battle?.log ?? []).filter((l) => l.text.startsWith(`${label} — Maladresse !`)).length;
    const sauvegardes = (label: string): number =>
      (useGame.getState().battle?.log ?? []).filter((l) => l.text.startsWith(`${label} — Sauvegarde Solide`)).length;

    const suspendu = applyAttackResult(useGame.getState, useGame.setState, frappeur, rival, armeAttaquant, res, false, undefined, { freeAttack: { kind: 'frappe-reactive', prevActed: false }, enchainement: { mode: 'aucun' } });
    expect(suspendu, 'la casse de l’attaquant est partie à la porte : le coup est suspendu').toBe(true);
    // Ce que la suspension a figé : rien de la queue n'a joué devant le dé.
    expect(etapeCourante()!.kind).toBe('casseDArme');
    expect(etapeCourante()!.actorId, 'le dé en vol est celui de l’ATTAQUANT').toBe(frappeur.id);
    expect(maladresses(frappeur.label), 'même celle de l’attaquant attend son dé').toBe(0);
    expect(maladresses(rival.label), 'la Maladresse du défenseur attend derrière ce dé').toBe(0);
    expect(useGame.getState().battle!.acted, 'l’Action du coup est consommée ; la suite n’a PAS joué').toBe(true);

    // À partir d'ici, chaque écriture du store est datée : on mesure l'ORDRE, pas seulement l'état final.
    const journalDesEcritures: { maladressesDuDefenseur: number; acted: boolean }[] = [];
    let suitesJouees = 0; // transitions « Action rendue » : une par exécution de la suite
    const stop = useGame.subscribe((s, prev) => {
      journalDesEcritures.push({ maladressesDuDefenseur: maladresses(rival.label), acted: !!s.battle?.acted });
      if (prev.battle?.acted === true && s.battle?.acted === false) suitesJouees += 1;
    });

    poser(9); // le dé de casse de l'attaquant ; celui du défenseur suit, roulé au socle (aucun siège)
    expect(armeAttaquant.destroyed, 'l’attaquant sauve son arme (LDB 60 l.30)').toBeFalsy();
    expect(maladresses(frappeur.label), 'la Maladresse de l’attaquant s’applique, une fois').toBe(1);
    expect(maladresses(rival.label), 'celle du défenseur la suit, une fois').toBe(1);
    expect(sauvegardes(frappeur.label), 'un seul dé de casse par porteur').toBe(1);
    expect(sauvegardes(rival.label), 'un seul dé de casse par porteur').toBe(1);
    expect(useGame.getState().battle!.acted, 'la suite (Action gratuite rendue) joue enfin').toBe(false);
    const premiereSuite = journalDesEcritures.findIndex((e) => !e.acted);
    expect(premiereSuite, 'la suite a bien laissé une trace datée').toBeGreaterThanOrEqual(0);
    expect(journalDesEcritures[premiereSuite].maladressesDuDefenseur, 'la Maladresse du défenseur est écrite AVANT que la suite ne joue').toBe(1);
    expect(suitesJouees, 'la suite du coup s’exécute une seule fois').toBe(1);

    const avant = (useGame.getState().battle?.log ?? []).map((l) => l.text);
    useGame.getState().cascadeNext();
    expect((useGame.getState().battle?.log ?? []).map((l) => l.text), 'une reprise de plus ne rejoue rien').toEqual(avant);
    expect(maladresses(rival.label)).toBe(1);
    expect(suitesJouees, 'aucune seconde exécution de la suite').toBe(1);
    stop();
  });
});

describe('Piège-lame — le désarmement ne dépend pas du dé, la destruction si', () => {
  const monte = (): { defenseur: Combatant; attaquant: Combatant; bt: BladeTrapFreeze } => {
    const lame = { uid: 'w1', label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'solide', value: 1 }] } as unknown as Weapon;
    const attaquant = mk('enemy', 'mercenaire', { weapons: [lame] });
    const defenseur = mk('hero', 'piegeur', {});
    setBattle([attaquant, defenseur], [defenseur]);
    // marge nette = defenderSL + defSL − attackerSL = 6 → Succès Stupéfiant (LDB 62 l.280).
    return { defenseur, attaquant, bt: { attackerId: 'mercenaire', weaponUid: 'w1', defSL: 6, attackerSL: 0 } };
  };
  const tientEncore = (): boolean => useGame.getState().battle!.combatants.find((c) => c.id === 'mercenaire')!.weapons.some((w) => w.uid === 'w1');

  it('le dé part à la porte avant toute mutation, puis un 9 laisse la lame INTACTE — mais désarmée', () => {
    const { defenseur, attaquant, bt } = monte();
    const issue = applyBladeTrap(useGame.getState, useGame.setState, defenseur, bt, 0);
    expect(issue).toBe(OPS_DIFFEREES);
    expect(tientEncore(), 'rien n’est joué avant le dé').toBe(true);
    expect(etapeCourante()!.actorId, 'le dé appartient au porteur de la lame').toBe(attaquant.id);
    poser(9);
    expect(attaquant.weapons.some((w) => w.uid === 'w1'), 'la lame est arrachée quoi qu’il arrive (l.280)').toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'mercenaire')!.weapons.length).toBe(0);
  });

  it('un 8 (< 9+) : la lame est BRISÉE', () => {
    const { defenseur, bt } = monte();
    const lame = useGame.getState().battle!.combatants.find((c) => c.id === 'mercenaire')!.weapons[0];
    applyBladeTrap(useGame.getState, useGame.setState, defenseur, bt, 0);
    poser(8);
    expect(lame.destroyed, 'la sauvegarde a manqué : la lame casse').toBe(true);
    expect(tientEncore()).toBe(false);
  });
});
