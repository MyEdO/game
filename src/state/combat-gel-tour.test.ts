import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { maybeOpenDefense, maybeRunEnemyTurn, drainerLesGratuites, aiTurnLog, clearAiTurnLog } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { startCascade } from './cascade';
import { idDansLaSequence } from './rollSeam';
import { pickActiveModalKey } from './modalArbiter';
import { hoteOrphelin, PENDING_BY_JET, type HostJet } from './stateFields';
import type { CascadeStep } from './pendings';
import { setCadence, resetCadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

/**
 * #1852 — LE COMBAT NE GÈLE PLUS. Invariant : à tout instant, au plus UNE étape hôte VIVANTE par slot
 * de donnée, et au plus UN tour d'IA en vol par combattant. Une attaque (principale ou GRATUITE) se
 * résout ENTIÈREMENT avant que la suivante soit déclarée — LDB 85 l.41-43 : « Une Attaque gratuite est
 * un Test d'attaque de Capacité de Tir ou de Capacité de Combat supplémentaire qui n'utilise pas votre
 * Action de tour » : chaque gratuite est un Test d'attaque COMPLET, donc sa PROPRE fenêtre.
 *
 * Porteur de `morsure` posé EN DUR : aucun mutant d'`enc-mutants` ne mord (leurs `traits` authorés
 * n'appliquent pas `grantTrait` au spawn — défaut séparé, #1853).
 */

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 40, max: 40 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;

/** Ennemi PORTEUR d'une gratuite de mêlée (Morsure, LDB 85 l.237) au contact d'un héros SURFACÉ. */
function setup() {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', { x: 1, y: 0 }, [sword]);
  const hero = mk('h', 'hero', { x: 0, y: 0 }, [sword]);
  enemy.traits = [{ id: 'morsure', value: 14 }];
  enemy.advantage = 3;
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
  return { enemy, hero };
}

const g = () => useGame.getState();
const idsEtapes = (): string[] => g().pendingCascade?.participants.map((s) => s.id) ?? [];
const etapeAuCurseur = (): string | undefined => {
  const pc = g().pendingCascade;
  return pc ? pc.participants[pc.cursor]?.id : undefined;
};

/** Déroule les fenêtres de défense COMME LE JOUEUR (Lancer → Appliquer) et rapporte, pour chacune,
 *  l'étape au curseur et l'arme de l'attaque qu'elle rend. Borne = anti-boucle : un pilote qui ne
 *  progresse pas doit ÉCHOUER, jamais tourner. */
function jouerLesFenetres(borne = 6): { etape: string | undefined; arme: string; doublons: string[] }[] {
  const vues: { etape: string | undefined; arme: string; doublons: string[] }[] = [];
  for (let i = 0; i < borne && g().pendingDefense; i++) {
    const ids = idsEtapes();
    vues.push({
      etape: etapeAuCurseur(),
      arme: String(g().pendingDefense!.weapon.label),
      doublons: ids.filter((id, k) => ids.indexOf(id) !== k),
    });
    g().defenseRoll();
    g().defenseConfirm();
  }
  return vues;
}

describe('#1852 — une gratuite de créature après une défense : deux fenêtres, aucun gel', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); clearAiTurnLog(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); clearAiTurnLog(); });

  it('cadence MANUELLE : l’Épée PUIS la Morsure, chacune dans SON étape, et le tour avance', () => {
    const { enemy, hero } = setup();
    expect(maybeOpenDefense(g, useGame.setState, enemy, hero, sword), 'la défense de l’attaque principale s’ouvre').toBe(true);

    const vues = jouerLesFenetres();

    expect(vues.flatMap((v) => v.doublons), 'jamais deux étapes d’id identique dans la séquence').toEqual([]);
    expect(vues.map((v) => v.arme), 'chaque fenêtre rend SON attaque').toEqual(['Épée', 'Morsure']);
    expect(new Set(vues.map((v) => v.etape)).size, 'deux fenêtres = deux étapes DISTINCTES').toBe(2);
    expect(g().pendingDefense, 'plus aucune défense en attente').toBeNull();
    vi.runAllTimers(); // beats de reprise de tour (resumeEnemyTurn → advanceTurn)
    expect(g().pendingCascade, 'la séquence est close, pas figée sur une étape orpheline').toBeNull();
    expect(g().battle!.turn, 'le tour a AVANCÉ (plus de gel)').not.toBe(0);
  });

  it('cadence RAPIDE (drive `JET_AUTO.defense`) : chaque passage PROGRESSE, le pilote ne boucle pas', () => {
    setCadence('rapide');
    const { enemy, hero } = setup();
    maybeOpenDefense(g, useGame.setState, enemy, hero, sword);
    // Le drive de cadence est `defenseRoll` → `defenseConfirm` (combatAuto.JET_AUTO.defense) : on le joue
    // ICI, sans son ordonnanceur, et on exige un PROGRÈS à chaque passage (repère = étape au curseur +
    // arme rendue). Un passage sans progrès = la boucle sans fin que la cadence subirait.
    const reperes = new Set<string>();
    for (let i = 0; i < 6 && g().pendingDefense; i++) {
      const repere = `${etapeAuCurseur()}|${g().pendingDefense!.weapon.label}`;
      expect(reperes.has(repere), `passage sans progrès sur ${repere}`).toBe(false);
      reperes.add(repere);
      g().defenseRoll();
      g().defenseConfirm();
    }
    expect(g().pendingDefense).toBeNull();
    vi.runAllTimers();
    expect(g().battle!.turn).not.toBe(0);
  });
});

/** Créature à TAILLE (balayage LDB 85 l.362) ET à Morsure (l.237), au contact de DEUX héros surfacés :
 *  le coup principal, l'enchaînement de balayage et la gratuite se suivent — chacun SA fenêtre. */
function setupTaille() {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', { x: 1, y: 0 }, [sword]);
  const h1 = mk('h1', 'hero', { x: 0, y: 0 }, [sword]);
  const h2 = mk('h2', 'hero', { x: 2, y: 0 }, [sword]);
  enemy.traits = [{ id: 'morsure', value: 14 }];
  enemy.size = 'enorme'; // Taille supérieure → `res.cleave` (LDB 85 l.362)
  enemy.characteristics['capacite-de-combat'] = 80;
  enemy.advantage = 3;
  for (const h of [h1, h2]) { h.characteristics['capacite-de-combat'] = 5; h.characteristics.agilite = 5; }
  const battle: BattleState = {
    combatants: [enemy, h1, h2], order: [enemy.id, h1.id, h2.id], baseOrder: [enemy.id, h1.id, h2.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [h1, h2],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
  return { enemy, h1, h2 };
}

/** Le CHARGEUR est un héros conduit par l'Auto-combat (`aiDriven`, donc `runEnemyAI` joue son tour) et
 *  le chargé RIPOSTE (Frappe réactive, LDB 10 l.496-500). Un héros est un porteur SURFACÉ
 *  (`jetSurfaced` : `!aiControlled`, cadence-agnostique) : la riposte ouvre donc une fenêtre de
 *  défense sur le chargeur PENDANT le télégraphe de sa charge. */
function setupRiposte() {
  seedBattleRng(3);
  const hero = mk('h', 'hero', { x: 4, y: 0 }, [sword]); // hors contact : il approche PUIS charge
  const enemy = mk('e', 'enemy', { x: 0, y: 0 }, [sword]);
  enemy.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
  enemy.characteristics.initiative = 99; // Test d'Initiative de la riposte quasi-garanti
  const battle: BattleState = {
    combatants: [hero, enemy], order: [hero.id, enemy.id], baseOrder: [hero.id, enemy.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
  return { enemy, hero };
}

/** Déroule la séquence COMME LE JOUEUR jusqu'à son terme : une fenêtre de défense se joue (Lancer →
 *  Appliquer), toute autre étape se valide (« Continuer »). Rapporte l'arme rendue par chaque fenêtre,
 *  le repère `étape|arme` de chaque passage (deux passages identiques = pilote qui PIÉTINE) et tous
 *  les ids d'étapes vus. Borne = anti-boucle : une séquence qui ne progresse pas doit ÉCHOUER. */
function jouerJusquAuBout(borne = 40): { armes: string[]; reperes: string[]; doublons: string[] } {
  const armes: string[] = []; const reperes: string[] = []; const doublons: string[] = [];
  for (let i = 0; i < borne; i++) {
    const vus = idsEtapes();
    doublons.push(...vus.filter((id, k) => vus.indexOf(id) !== k));
    const pc = g().pendingCascade;
    const cur = pc?.participants[pc.cursor];
    // Le joueur agit sur ce que la MODALE montre : l'étape AU CURSEUR (`CascadeModal`), jamais un slot
    // que rien n'affiche.
    if (cur?.jet === 'defense' && g().pendingDefense) {
      armes.push(String(g().pendingDefense!.weapon.label));
      reperes.push(`${cur.id}|${g().pendingDefense!.weapon.label}`);
      g().defenseRoll();
      g().defenseConfirm();
      continue;
    }
    // Épreuve hôtée (Test de Résistance d'un État, d'un effet d'arme…) : Lancer → Appliquer.
    if (cur?.jet === 'test' && g().pendingTest) {
      if (g().pendingTest!.roll == null) g().testRoll();
      g().resolveTest();
      continue;
    }
    if (pc) {
      // Étape à CHOIX (Subir / Dévier un Critique, LDB 14) : le joueur tranche avant de continuer.
      if (cur?.options?.length && !cur.chosen) g().cascadeChoose(cur.id, cur.options[0].key);
      // « Lancer » de l'étape : jet propre (Test déclenché), table (Blessure critique) ou dé d'affichage.
      if (cur?.target != null && !cur.result) g().cascadeRoll(cur.id);
      if (cur?.table && !cur.table.result) g().cascadeTableRoll(cur.id);
      if (cur?.de && !cur.de.result) g().cascadeDieRoll(cur.id);
      g().cascadeNext();
      continue;
    }
    break;
  }
  return { armes, reperes, doublons };
}

describe('#1852 — la PORTE : aucune défense ne s’ouvre par-dessus une défense vivante', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  it('deux `maybeOpenDefense` de suite : la 2ᵉ est REFUSÉE (DEV throw), le slot garde la 1ʳᵉ', () => {
    const { enemy, hero } = setup();
    expect(maybeOpenDefense(g, useGame.setState, enemy, hero, sword)).toBe(true);
    const premiere = g().pendingDefense;
    expect(() => maybeOpenDefense(g, useGame.setState, enemy, hero, sword)).toThrow(/défense/i);
    expect(g().pendingDefense, 'le slot porte TOUJOURS la première attaque').toBe(premiere);
    expect(g().pendingCascade!.participants.filter((s) => s.jet === 'defense'), 'UNE étape de défense vivante').toHaveLength(1);
  });

  it('`drainerLesGratuites` par-dessus une fenêtre ouverte : la file ATTEND, elle ne frappe pas', () => {
    const { enemy, hero } = setup();
    maybeOpenDefense(g, useGame.setState, enemy, hero, sword);
    const premiere = g().pendingDefense;
    expect(drainerLesGratuites(g, useGame.setState, enemy, { disponibles: true }), 'file suspendue par la fenêtre vivante').toBe(true);
    expect(g().pendingDefense, 'aucune gratuite n’a écrasé le slot').toBe(premiere);
    expect(g().pendingCascade!.participants.filter((s) => s.jet === 'defense')).toHaveLength(1);
  });

  // Coup principal À LA TAILLE (balayage LDB 85 l.362) suivi des gratuites de la créature (Morsure
  // l.237 puis Piétinement l.387) : le scénario même de #1852, passé par le 4ᵉ appelant (`autoCleave`
  // depuis `defenseConfirm`). Ce qui est MESURÉ ici est l'INVARIANT DE FENÊTRAGE — chaque fenêtre a SON
  // étape, aucun id ne collisionne, la séquence se clot, le tour avance. La SUITE EXACTE des coups (qui
  // enchaîne sur qui, combien de fois — Frappe Mortelle, ADE II 02 l.576 : « il ne peut pas attaquer la
  // même créature plus d'une fois ») est le périmètre de #1858, pas celui-ci.
  const verifierLaFile = (armes: string[], reperes: string[], doublons: string[]) => {
    expect(doublons, 'aucune collision d’id dans la séquence').toEqual([]);
    expect(new Set(reperes).size, 'une fenêtre = UNE étape, jamais deux fois la même').toBe(reperes.length);
    expect(armes.slice(0, 2), 'le coup principal puis son enchaînement de balayage').toEqual(['Épée', 'Épée']);
    expect(armes, 'la gratuite de créature a eu SA fenêtre, après le balayage').toContain('Morsure');
    expect(g().pendingDefense, 'plus aucune défense en attente').toBeNull();
    expect(g().pendingCascade, 'la séquence est CLOSE, pas figée').toBeNull();
  };

  it('TAILLE + Morsure, cadence manuelle — INVARIANT DE FENÊTRAGE (la suite exacte des coups est #1858)', () => {
    const { enemy, h1 } = setupTaille();
    expect(maybeOpenDefense(g, useGame.setState, enemy, h1, sword)).toBe(true);
    const { armes, reperes, doublons } = jouerJusquAuBout();
    verifierLaFile(armes, reperes, doublons);
    vi.runAllTimers();
    expect(g().battle!.turn, 'le tour a AVANCÉ').not.toBe(0);
  });

  it('TAILLE + Morsure, cadence RAPIDE — même invariant, et chaque passage PROGRESSE (suite des coups : #1858)', () => {
    setCadence('rapide');
    const { enemy, h1 } = setupTaille();
    maybeOpenDefense(g, useGame.setState, enemy, h1, sword);
    const { armes, reperes, doublons } = jouerJusquAuBout();
    verifierLaFile(armes, reperes, doublons);
    vi.runAllTimers();
    expect(g().battle!.turn).not.toBe(0);
  });

  // La PORTE garde un slot, elle n'interdit pas un chemin de jeu : une riposte `onCharged`
  // (Frappe réactive, LDB 10 l.496-500) se résout ENTIÈREMENT — fenêtre du chargeur comprise — avant
  // la frappe du chargeur (LDB 85 l.41-43). Le télégraphe de la charge doit donc ATTENDRE, jamais
  // frapper par-dessus la fenêtre ouverte ni perdre son coup.
  it('riposte `onCharged` SURFACÉE puis charge : la riposte a SA fenêtre, la frappe du chargeur SUIT, et le tour avance', () => {
    setCadence('auto'); // le chargeur est conduit par l'Auto-combat (`aiDriven`)
    const { hero } = setupRiposte();
    maybeRunEnemyTurn(g, useGame.setState);
    // Jusqu'à l'approche + la charge : la riposte du chargé ouvre SA fenêtre sur le CHARGEUR surfacé.
    for (let i = 0; i < 6 && !g().pendingDefense; i++) vi.advanceTimersToNextTimer();
    expect(g().pendingDefense?.defenderId, 'le chargeur se défend de la riposte').toBe(hero.id);
    const fenetreRiposte = g().pendingDefense;

    // Le télégraphe de la charge échoit PENDANT cette fenêtre : il ne doit ni jeter, ni frapper.
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(g().pendingDefense, 'la fenêtre de la riposte tient toujours la main').toBe(fenetreRiposte);

    // Le joueur répond pour le chargeur → son tour reprend, et SA frappe part.
    const avant = g().battle!.log.length;
    g().defenseRoll();
    g().defenseConfirm();
    vi.runAllTimers();
    jouerJusquAuBout();
    vi.runAllTimers();
    // La frappe du chargeur n'est PAS perdue : son Test d'attaque est au journal, APRÈS la riposte.
    const frappes = g().battle!.log.slice(avant).filter((l) => /^h (touche|rate)/.test(String(l.text)));
    expect(frappes.length, 'le chargeur a porté SON Test d’attaque après la riposte').toBeGreaterThan(0);
    expect(g().battle!.turn, 'le tour a AVANCÉ').not.toBe(0);
  });

  it('aucun état INTERMÉDIAIRE ne pose le curseur sur une étape sans sa donnée (#1852 cond. 3)', () => {
    const { enemy, hero } = setup();
    maybeOpenDefense(g, useGame.setState, enemy, hero, sword);
    const fautes: string[] = [];
    const unsub = useGame.subscribe((s) => {
      const pc = s.pendingCascade;
      const st = pc?.participants[pc.cursor];
      if (hoteOrphelin(s, st)) fautes.push(st!.id);
    });
    g().defenseRoll();
    g().defenseConfirm();
    unsub();
    expect(fautes, 'le slot se vide et l’étape se ferme dans le MÊME état').toEqual([]);
  });
});

describe('#1852 — la file des gratuites S’ARRÊTE à la première fenêtre ouverte', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  it('Frénésie (gratuite d’Arme) PUIS Morsure : la 2ᵉ ne se déclare pas par-dessus la fenêtre de la 1ʳᵉ', () => {
    const { enemy } = setup();
    (enemy.psychState ??= []).push({ type: 'frenesie' }); // LDB 21 l.33 : « un Test de CC gratuit chaque Round »
    const suspendu = drainerLesGratuites(g, useGame.setState, enemy, { disponibles: true });
    expect(suspendu, 'la gratuite d’Arme a ouvert SA fenêtre → la file s’arrête').toBe(true);
    expect(g().pendingDefense, 'une défense, et une seule').not.toBeNull();
    expect(g().pendingCascade!.participants.filter((s) => s.jet === 'defense')).toHaveLength(1);
    expect(enemy.pendingFreeAttacks, 'la file de créature n’a PAS démarré par-dessus').toBeUndefined();
  });
});

describe('#1852 — hôte ORPHELIN : le prédicat est TOTAL, et le curseur ne s’y pose jamais', () => {
  const JETS: HostJet[] = ['attack', 'trample', 'defense', 'fumble', 'cast', 'test', 'extended', 'disengage', 'forceDoor'];

  // Le prédicat dit « cette étape a de quoi rendre un corps » : il doit couvrir TOUTES les causes de
  // `null` du hook de props du jet (`useXJetProps`), slot ET acteurs, sinon le renderer inconditionnel
  // de `CascadeModal` rend `{...null!}` — un crash, pas une fenêtre vide.
  const battleDe = (...ids: string[]) => ({ combatants: ids.map((id) => ({ id })) } as never);
  const ETAT_COMPLET: Record<HostJet, Record<string, unknown>> = {
    attack: { battle: battleDe('a', 'h'), pendingAttack: { attackerId: 'a', targetId: 'h' } },
    trample: { battle: battleDe('a', 'h'), pendingTrample: { attackerId: 'a', targetId: 'h' } },
    defense: { battle: battleDe('a', 'h'), pendingDefense: { attackerId: 'a', defenderId: 'h' } },
    fumble: { battle: battleDe('h') }, // sans slot : la donnée est `step.fumble`
    cast: { pendingCast: {} },
    test: { pendingTest: {} },
    extended: { battle: battleDe('h'), pendingExtendedTest: { actorId: 'h' } },
    disengage: { pendingDisengage: {} },
    forceDoor: { pendingForceDoor: {} },
  };
  const etape = (jet: HostJet): CascadeStep =>
    ({ id: `x-${jet}`, kind: 'k', jet, actorId: 'h', ...(jet === 'fumble' ? { fumble: { weapon: 'Épée' } } : {}) } as never);

  it('pour CHAQUE jet hôté : donnée complète ⇒ pas orphelin ; slot vidé ⇒ orphelin', () => {
    for (const jet of JETS) {
      expect(hoteOrphelin(ETAT_COMPLET[jet] as never, etape(jet)), `${jet} complet`).toBe(false);
      const slot = PENDING_BY_JET[jet];
      if (!slot) continue; // Maladresse : sa donnée vit SUR l'étape (cause testée juste après)
      expect(hoteOrphelin({ ...ETAT_COMPLET[jet], [slot]: null } as never, etape(jet)), `${jet} sans ${slot}`).toBe(true);
    }
  });

  it('2ᵉ cause de `null` du hook : l’ACTEUR a quitté le `battle` ⇒ orphelin', () => {
    // useDefenseJetProps:48 / useAttackJetProps:68 / useTrampleJetProps:34 / useFumbleJetProps:25 /
    // useExtendedTestJetProps:34 — `if (!attacker || !target) return null`.
    for (const jet of ['attack', 'trample', 'defense', 'fumble', 'extended'] as HostJet[]) {
      expect(hoteOrphelin({ ...ETAT_COMPLET[jet], battle: battleDe('personne') } as never, etape(jet)), `${jet} sans acteur`).toBe(true);
      expect(hoteOrphelin({ ...ETAT_COMPLET[jet], battle: null } as never, etape(jet)), `${jet} hors combat`).toBe(true);
    }
  });

  it('Maladresse : sa donnée vit SUR l’étape (`step.fumble`), invisible au slot ⇒ orphelin sans elle', () => {
    expect(hoteOrphelin(ETAT_COMPLET.fumble as never, { id: 'f', kind: 'k', jet: 'fumble', actorId: 'h' })).toBe(true);
  });

  it('une étape déjà VALIDÉE (`committed`) n’est jamais orpheline : elle a rendu sa donnée', () => {
    expect(hoteOrphelin({}, { id: 'd', kind: 'k', jet: 'defense', actorId: 'h', committed: true })).toBe(false);
  });

  it('une étape SANS jet n’est jamais orpheline (affichage, choix, bande)', () => {
    const affichage: CascadeStep = { id: 's', kind: 'display' };
    expect(hoteOrphelin({}, affichage)).toBe(false);
    expect(hoteOrphelin({}, undefined)).toBe(false);
  });

  it('le curseur REFUSE d’arriver sur un hôte sans donnée (DEV : throw ; PROD : étape franchie)', () => {
    setup();
    useGame.setState({
      pendingDefense: null,
      pendingCascade: {
        title: 'Défense', purpose: 'combat', cursor: 0, log: [], seq: 2,
        participants: [
          { id: 'affichage', kind: 'display', actorId: 'h', label: 'X' },
          { id: 'defense-jet-1', kind: 'defenseJet', jet: 'defense', actorId: 'h' }, // ORPHELINE : aucun pendingDefense
        ],
      } as never,
    });
    expect(() => useGame.getState().cascadeNext()).toThrow(/orphelin/);
  });

  it('l’ARBITRE n’élit pas la cascade quand le corps de l’étape `cast` s’efface (ciblage carte)', () => {
    const casc = { participants: [{ id: 'c', kind: 'castJet', jet: 'cast', actorId: 'h' }], cursor: 0 } as never;
    expect(pickActiveModalKey({ pendingCast: {} as never, pendingCascade: casc })).toBe('cascade');
    expect(pickActiveModalKey({ pendingCast: { pickingTargets: true } as never, pendingCascade: casc })).toBeNull();
  });
});

describe('#1852 — garde d’unicité d’id d’étape (portes `startCascade` / `pushStep`)', () => {
  // `pendingTest` posé : les étapes d'épreuve sont des HÔTES, et le curseur refuse un hôte SANS sa
  // donnée (garde d'orphelin ci-dessus) — c'est l'unicité d'id qu'on mesure ici, pas elle.
  beforeEach(() => { useGame.setState({ pendingCascade: null, suspendedCascades: [], pendingTest: {} } as never); });
  afterEach(() => { useGame.setState({ pendingTest: null, pendingCascade: null } as never); });

  const hote = (id: string): CascadeStep => ({ id, kind: 'testJet', jet: 'test', actorId: 'h' });
  const affichage = (id: string): CascadeStep => ({ id, kind: 'display', actorId: 'h' });

  it('deux étapes HÔTES du MÊME id dans une séquence : refus bruyant', () => {
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [hote('a'), hote('a')] }))
      .toThrow(/même id/);
  });

  it('un APPEND qui rejoue l’id d’un hôte déjà dans la séquence : même refus', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [hote('a')] });
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [hote('a')] }))
      .toThrow(/même id/);
  });

  it('une collision HORS hôte (affichage, bande d’un sous-jeu) est refusée de la même façon', () => {
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [affichage('b'), affichage('b')] }))
      .toThrow(/même id/);
  });

  it('un id DÉRIVÉ du compteur de la séquence ne collisionne pas (`idDansLaSequence`)', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [hote(idDansLaSequence(useGame.getState, 'x-jet', 'combat'))] });
    expect(() => startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [hote(idDansLaSequence(useGame.getState, 'x-jet', 'combat'))] }))
      .not.toThrow();
    expect(useGame.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['x-jet-0', 'x-jet-1']);
  });
});

describe('#1852 — jeton de tour : un combattant ne joue qu’UNE fois son tour', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); clearAiTurnLog(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); clearAiTurnLog(); });

  it('`maybeRunEnemyTurn` ×2 puis échéance des timers : UNE entrée de tour pour ce combattant/round', () => {
    const { enemy } = setup();
    enemy.traits = []; // tour d'attaque nu : c'est le NOMBRE de tours joués qui est mesuré
    maybeRunEnemyTurn(g, useGame.setState);
    maybeRunEnemyTurn(g, useGame.setState);
    vi.runAllTimers();
    const tours = aiTurnLog().filter((r) => r.id === enemy.id && r.round === 1);
    expect(tours.length, 'un tour = UNE décision jouée').toBe(1);
  });

  // CONTRAT OPPOSÉ du jeton : il empêche le DOUBLON, il ne doit pas empêcher la REPRISE. Un tour
  // suspendu AVANT d'avoir consommé son Action (`battle.acted` faux — Peur au contact, entretien…)
  // est relancé par `resumeSuspendedAI` à la clôture de la séquence ; le jeton lui est rendu, sinon
  // le même `round:turn:id` serait refusé à jamais et le tour gèlerait.
  it('tour SUSPENDU avant d’avoir agi : la clôture de la séquence le relance, et il ne joue qu’UNE fois', () => {
    const { enemy } = setup();
    enemy.traits = [];
    maybeRunEnemyTurn(g, useGame.setState);
    vi.runAllTimers(); // le jeton est posé par CE tour, pour `1:0:e`
    const joues = () => aiTurnLog().filter((r) => r.id === enemy.id && r.round === 1).length;
    expect(joues()).toBe(1);
    // Le MÊME tour reprend sans avoir rien consommé, à la clôture d'une séquence de conséquences.
    useGame.setState({ battle: { ...g().battle!, turn: 0, acted: false }, pendingCascade: null, pendingDefense: null } as never);
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'combat', steps: [{ id: 'aff', kind: 'display', actorId: enemy.id }] });
    useGame.getState().cascadeFinish();
    vi.runAllTimers();
    expect(joues(), 'le tour repris est joué — une fois').toBe(2);
  });

  it('chemin joueur : `resumeCadence` pendant un timer de tour IA en vol ne rejoue pas le tour', () => {
    const { enemy } = setup();
    enemy.traits = [];
    maybeRunEnemyTurn(g, useGame.setState); // timer de tour EN VOL
    g().resumeCadence();                    // le joueur change la cadence de combat (preferences.ts:54)
    vi.runAllTimers();
    const tours = aiTurnLog().filter((r) => r.id === enemy.id && r.round === 1);
    expect(tours.length).toBe(1);
  });
});
