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
import type { CascadeStep, BladeTrapFreeze, PendingDefense, SuiteDeCoup } from './pendings';
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

  it('l’étape NOMME l’arme misée — un porteur à deux armes sait laquelle son dé décide', () => {
    const arme = epeeBacleeSolide();
    const dague = { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 2 }, qualities: [] } as unknown as Weapon;
    const hero = mk('hero', 'bretteur', { weapons: [arme, dague] });
    setBattle([hero], [hero]);
    applyOups(useGame.getState, useGame.setState, hero, arme, MALADRESSE);
    const label = etapeCourante()!.label ?? '';
    expect(label, `l’étape dit l’arme en jeu (${label})`).toContain(arme.label);
    expect(label, 'et seulement celle-là').not.toContain(dague.label);
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
    pushHost(useGame.getState, useGame.setState, (index) => ({ id: `cons-fumble-${hero.id}-${index}`, kind: 'fumbleJet', jet: 'fumble', actorId: hero.id, fumble: { weapon: arme, result: null } }));
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

  it('le journal dit le dé qui DÉCIDE avant ce qu’il a décidé, et ne le dit qu’une fois', () => {
    const arme = epeeBacleeSolide();
    monteHote(arme);
    useGame.getState().fumbleRoll();
    useGame.getState().fumbleConfirm();
    poser(8);
    const journal = (useGame.getState().battle?.log ?? []).map((l) => l.text);
    const iSeuil = journal.findIndex((l) => /Épée bâclée ne résiste pas — Sauvegarde 1d10 : 8 < Solide \(9\+\)\./.test(l));
    const iMaladresse = journal.findIndex((l) => /^bretteur — Maladresse !/.test(l));
    const iBrisee = journal.findIndex((l) => /Épée bâclée \(Bâclé\) se brise sur la Maladresse de bretteur\./.test(l));
    expect(iSeuil, journal.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(iMaladresse, 'la Maladresse SUIT le dé qui l’a laissée s’appliquer').toBeGreaterThan(iSeuil);
    expect(iBrisee, 'la brisure SUIT la Maladresse').toBeGreaterThan(iMaladresse);
    expect(journal.filter((l) => /ne résiste pas — Sauvegarde 1d10/.test(l)).length, 'la ligne du seuil est écrite UNE fois').toBe(1);
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

  // UNE sauvegarde Solide par Incident de tir : #1508 (commentaire du 2026-09-26) ; `AA 10 l.264`, `l.274-276`, `LDB 14 l.34`, `LDB 60 l.30`.
  it('deux dés dans l’ordre : Sauvegarde Solide de l’Incident, puis TABLE de Salve — la sauvegarde réussie COUVRE la destruction du tableau', () => {
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
    poser(2); // ligne 1-4 « Bras principal » : « La pièce d’artillerie est détruite »
    expect(etapeCourante(), 'aucune 2ᵉ sauvegarde : UNE par Incident').toBeUndefined();
    expect(arme.destroyed, 'la sauvegarde de l’Incident couvre la destruction du tableau').toBeFalsy();
    expect(hero.wounds.current, 'les Dégâts du tableau s’appliquent quand même').toBeLessThan(30);
    const lues = lignesLues().join(' | ');
    expect(lues, 'la ligne TIRÉE est celle du dé posé').toContain('Bras principal');
    expect(lues, 'la destruction couverte se DIT').toContain('couvre cette destruction');
  });

  it('sauvegarde de l’Incident MANQUÉE : la pièce brisée ne rejoue pas un dé pour la ligne de Salve', () => {
    const arme = piece();
    const hero = mk('hero', 'canonnier', { weapons: [arme] });
    setBattle([hero], [hero]);
    applyOups(useGame.getState, useGame.setState, hero, arme, INCIDENT);
    poser(1); // 1 < 9 : la Sauvegarde Solide de l’Incident a MANQUÉ — la pièce est brisée
    expect(etapeCourante()!.id, 'la table de Salve se tire quand même (AA 10 l.264)').toContain('salve-table');
    poser(2); // ligne 1-4 : « La pièce d’artillerie est détruite » — une pièce DÉJÀ détruite
    expect(etapeCourante(), 'aucune 2ᵉ Sauvegarde Solide : `LDB 60 l.30` n’en accorde qu’une par cassure').toBeUndefined();
    expect(arme.destroyed, 'la pièce est bien brisée').toBe(true);
    const journal = (useGame.getState().battle?.log ?? []).map((l) => l.text);
    expect(journal.filter((l) => /Sauvegarde 1d10/.test(l)).length, 'UNE seule ligne de seuil au journal').toBe(1);
  });

  it('ligne 10 (tir perdu) : la pièce n’est pas détruite → AUCUNE sauvegarde de plus', () => {
    const arme = piece();
    const hero = mk('hero', 'canonnier', { weapons: [arme] });
    setBattle([hero], [hero]);
    applyOups(useGame.getState, useGame.setState, hero, arme, INCIDENT);
    poser(9);
    poser(10); // « Tir perdu » : pièce intacte
    expect(etapeCourante(), 'la grappe s’arrête : rien à sauver').toBeUndefined();
    expect(arme.destroyed).toBeFalsy();
  });
});

describe('Solide imperdable — aucun dé, mais la sauvegarde se DIT (LDB 60 l.30)', () => {
  it('Bâclé + Solide(9) : la Maladresse s’applique sur place, l’arme tient, et le journal le dit', () => {
    const arme = { label: 'Épée bâclée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'bacle' }, { id: 'solide', value: 9 }] } as unknown as Weapon;
    const hero = mk('hero', 'bretteur', { weapons: [arme] });
    setBattle([hero], [hero]);
    expect(applyOups(useGame.getState, useGame.setState, hero, arme, MALADRESSE), 'aucun dé à ouvrir').toBeUndefined();
    expect(arme.destroyed, 'l’arme tient').toBeFalsy();
    const lues = lignesLues();
    expect(lues.filter((l) => /^Épée bâclée résiste — .* : la Sauvegarde ne peut pas échouer\.$/.test(l)), lues.join(' | ')).toHaveLength(1);
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

/**
 * UNE SEULE REPRISE (#1508, C1) — la casse d'arme est une fenêtre de plus sur `applyAttackResult` :
 * ce que l'appelant fait APRÈS le coup ne doit pas dépendre de la fenêtre qui l'a suspendu. Le TÉMOIN
 * (même coup, arme SANS Solide : rien ne part à la porte) fixe l'attendu ; le CAS (arme Solide : un dé
 * à la porte) doit y revenir une fois le dé posé.
 */
describe('la casse suspend le coup — mais la reprise rend EXACTEMENT ce que la fenêtre a sauté', () => {
  const EPEE_HERO = (): Weapon => ({ uid: 'def', label: 'Épée du héros', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }) as unknown as Weapon;
  const bacle = (solide: boolean): Weapon => ({
    uid: 'atk', label: 'Épée bâclée', type: 'melee', damage: { plusBF: true, flat: 4 },
    qualities: solide ? [{ id: 'bacle' }, { id: 'solide', value: 1 }] : [{ id: 'bacle' }],
  }) as unknown as Weapon;

  /** Les DEUX Tests ratés sur un double du MÊME échange (LDB 14 l.13) : l'ennemi attaque, le héros pare. */
  const echangeBacle = (): AttackResult => ({
    hit: true, attackerRoll: 33, netSL: 1, location: 'corps', damage: 5, woundsLost: 3,
    critical: false, advantageTo: null, defenderDefeated: false, log: 'touche.',
    attackerDetail: { roll: 33, success: false, sl: -2 },
    defenderDetail: { roll: 44, success: false, sl: -3 },
  }) as unknown as AttackResult;

  /** Le chemin JOUEUR d'une fenêtre de défense #1858 mode `machine` : c'est `defenseConfirm` qui applique. */
  function monteDefense(armeAttaquant: Weapon, coup: SuiteDeCoup): { hero: Combatant; brute: Combatant } {
    const hero = mk('hero', 'heros', { pos: { x: 0, y: 0 }, weapons: [EPEE_HERO()] });
    const brute = mk('enemy', 'brute', { pos: { x: 1, y: 0 }, weapons: [armeAttaquant] });
    setBattle([brute, hero], [hero]);
    const result = echangeBacle();
    useGame.setState({ pendingDefense: {
      attackerId: brute.id, defenderId: hero.id, weapon: armeAttaquant, location: 'corps', mode: 'parade',
      atk: { roll: 33, success: false, sl: -2, target: 45 }, def: { roll: 44, success: false, sl: -3, target: 45 },
      result, suite: { mode: 'machine', coup },
    } as unknown as PendingDefense });
    return { hero, brute };
  }
  const etapes = (): string[] => (useGame.getState().pendingCascade?.participants ?? []).map((s) => `${s.kind}:${s.id}`);

  it('témoin SANS Solide et cas AVEC Solide : la Maladresse du héros défenseur s’ouvre dans les DEUX', () => {
    monteDefense(bacle(false), { enchainement: { mode: 'aucun' } });
    useGame.getState().defenseConfirm();
    const temoin = etapes();
    expect(temoin.some((s) => s.startsWith('fumbleJet:') && s.includes('heros')),
      `témoin : ${temoin.join(' | ')}`).toBe(true);

    monteDefense(bacle(true), { enchainement: { mode: 'aucun' } });
    useGame.getState().defenseConfirm();
    expect(etapeCourante()!.kind, 'le dé de casse part à la porte AVANT la Maladresse du héros').toBe('casseDArme');
    expect(etapes().some((s) => s.startsWith('fumbleJet:')), 'rien de la queue ne joue devant le dé').toBe(false);
    poser(9);
    const maladresses = etapes().filter((s) => s.startsWith('fumbleJet:'));
    expect(maladresses, 'la reprise rend la Maladresse SAUTÉE, une fois').toHaveLength(1);
    expect(maladresses[0], 'id mint au rang de la séquence (#1852)').toMatch(/^fumbleJet:cons-fumble-heros-\d+$/);
  });

  it('la SUITE portée par la fenêtre (Action gratuite) est rendue par la reprise, une seule fois', () => {
    monteDefense(bacle(true), { freeAttack: { kind: 'frappe-reactive', prevActed: false }, enchainement: { mode: 'aucun' } });
    useGame.getState().defenseConfirm();
    expect(useGame.getState().battle!.acted, 'l’Action du coup est consommée ; la suite n’a PAS joué').toBe(true);
    poser(9);
    // La suite vient APRÈS la Maladresse du héros défenseur (`APRES_COUP`) : elle attend son Oups !.
    expect(useGame.getState().battle!.acted, 'la Maladresse du défenseur précède la suite').toBe(true);
    useGame.getState().fumbleRoll();
    useGame.getState().fumbleConfirm();
    expect(useGame.getState().battle!.acted, 'la reprise rend l’Action gratuite').toBe(false);
    const avant = (useGame.getState().battle?.log ?? []).map((l) => l.text);
    useGame.getState().cascadeNext();
    expect((useGame.getState().battle?.log ?? []).map((l) => l.text), 'une reprise de plus ne rejoue rien').toEqual(avant);
  });

  it('le maillon de BALAYAGE porté par la fenêtre (#1858 `ChaineDeBalayage`) voyage jusqu’à la reprise', () => {
    const chaine = { mode: 'chaine' as const, hitIds: ['heros'], n: 1, bcc: 2, fm: true };
    monteDefense(bacle(true), { enchainement: chaine });
    useGame.getState().defenseConfirm();
    const casse = etapeCourante()!;
    expect(casse.kind).toBe('casseDArme');
    expect(casse.casse?.reprise.mode === 'oups' && casse.casse.reprise.coup?.suite?.enchainement,
      'la charge du dé EMPORTE le maillon déclaré par la fenêtre, sans le recopier').toEqual(chaine);
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
    const suspendu = applyAttackResult(useGame.getState, useGame.setState, hero, brute, hero.weapons[0], res, { sousAttaque: true, suite: { freeAttack: { kind: 'frappe-reactive', prevActed: false } } });
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
    // Attaquant `aiControlled` : `jetSurfaced` faux → sa Maladresse s'écrit d'office (`ecrireLaMaladresse`).
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

    const suspendu = applyAttackResult(useGame.getState, useGame.setState, frappeur, rival, armeAttaquant, res, { sousAttaque: true, suite: { freeAttack: { kind: 'frappe-reactive', prevActed: false }, enchainement: { mode: 'aucun' } } });
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

  it('porteur à ItemInstance : la lame brisée est DITE brisée (l’issue fait foi, pas le Weapon dérivé)', () => {
    const lame = { uid: 'w1', label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'solide', value: 1 }] } as unknown as Weapon;
    // Un porteur qui tient son arme par un ItemInstance : `recomputeLoadout` RECONSTRUIT `weapons`
    // après la casse, et le `Weapon` capturé avant devient une lecture périmée.
    const attaquant = mk('enemy', 'mercenaire', { weapons: [lame], items: [{ uid: 'w1', id: 'rapiere', label: 'Rapière', kind: 'weapon', weapon: { label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'solide', value: 1 }] } }] as never });
    const defenseur = mk('hero', 'piegeur', {});
    setBattle([attaquant, defenseur], [defenseur]);
    applyBladeTrap(useGame.getState, useGame.setState, defenseur, { attackerId: 'mercenaire', weaponUid: 'w1', defSL: 6, attackerSL: 0 }, 0);
    poser(8); // < 9+ : la sauvegarde a manqué
    const lues = lignesLues();
    expect(lues.some((l) => /La lame de mercenaire \(Rapière\) est BRISÉE par la manœuvre !/.test(l)),
      lues.join(' | ')).toBe(true);
    expect(lues.some((l) => /Rapière résiste à la casse/.test(l)),
      'une lame brisée n’est pas annoncée « résiste à la casse »').toBe(false);
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
