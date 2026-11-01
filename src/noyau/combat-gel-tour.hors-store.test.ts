import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { maybeOpenDefense, maybeRunEnemyTurn, drainerLesGratuites, aiTurnLog, clearAiTurnLog } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { startCascade } from './cascade';
import { idDansLaSequence } from './rollSeam';
import { pickActiveModalKey } from './modalArbiter';
import { hoteOrphelin, PENDING_BY_JET, type HostJet } from './slotsDeJet';
import type { CascadeStep } from './pendings';
import { setCadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { avanceEtapeCascade, cascadeDeTest } from './cascade.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { cleDeFixture } from './noyau.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

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
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(40),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);
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
  banc.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
  return { enemy, hero };
}

const g = () => banc.getState();
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
  beforeEach(() => { clearAiTurnLog(); });
  afterEach(() => { clearAiTurnLog(); });

  it('cadence MANUELLE : l’Épée PUIS la Morsure, chacune dans SON étape, et le tour avance', () => {
    const { enemy, hero } = setup();
    expect(maybeOpenDefense(g, banc.setState, enemy, hero, sword), 'la défense de l’attaque principale s’ouvre').toBe(true);

    const vues = jouerLesFenetres();

    expect(vues.flatMap((v) => v.doublons), 'jamais deux étapes d’id identique dans la séquence').toEqual([]);
    expect(vues.map((v) => v.arme), 'chaque fenêtre rend SON attaque').toEqual(['Épée', 'Morsure']);
    expect(new Set(vues.map((v) => v.etape)).size, 'deux fenêtres = deux étapes DISTINCTES').toBe(2);
    expect(g().pendingDefense, 'plus aucune défense en attente').toBeNull();
    banc.reprendreTout(); // beats de reprise de tour (resumeEnemyTurn → advanceTurn)
    expect(g().pendingCascade, 'la séquence est close, pas figée sur une étape orpheline').toBeNull();
    expect(g().battle!.turn, 'le tour a AVANCÉ (plus de gel)').not.toBe(0);
  });

  it('cadence RAPIDE (drive `JET_AUTO.defense`) : chaque passage PROGRESSE, le pilote ne boucle pas', () => {
    setCadence('rapide');
    const { enemy, hero } = setup();
    maybeOpenDefense(g, banc.setState, enemy, hero, sword);
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
    banc.reprendreTout();
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
  banc.setState({
    battle, mode: 'battle', scene: testScene(), party: [h1, h2],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
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
  banc.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
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
      // « Lancer » (jet, table, dé) puis CHOIX (Subir / Dévier un Critique, LDB 14) : la 1ʳᵉ voie.
      avanceEtapeCascade(g, undefined, (st) => st.options![0].key);
      continue;
    }
    break;
  }
  return { armes, reperes, doublons };
}

describe('#1852 — la PORTE : aucune défense ne s’ouvre par-dessus une défense vivante', () => {
  it('deux `maybeOpenDefense` de suite : la 2ᵉ est REFUSÉE (DEV throw), le slot garde la 1ʳᵉ', () => {
    const { enemy, hero } = setup();
    expect(maybeOpenDefense(g, banc.setState, enemy, hero, sword)).toBe(true);
    const premiere = g().pendingDefense;
    expect(() => maybeOpenDefense(g, banc.setState, enemy, hero, sword)).toThrow(/défense/i);
    expect(g().pendingDefense, 'le slot porte TOUJOURS la première attaque').toBe(premiere);
    expect(g().pendingCascade!.participants.filter((s) => s.jet === 'defense'), 'UNE étape de défense vivante').toHaveLength(1);
  });

  it('`drainerLesGratuites` par-dessus une fenêtre ouverte : la file ATTEND, elle ne frappe pas', () => {
    const { enemy, hero } = setup();
    maybeOpenDefense(g, banc.setState, enemy, hero, sword);
    const premiere = g().pendingDefense;
    expect(drainerLesGratuites(g, banc.setState, enemy, { disponibles: true }), 'file suspendue par la fenêtre vivante').toBe(true);
    expect(g().pendingDefense, 'aucune gratuite n’a écrasé le slot').toBe(premiere);
    expect(g().pendingCascade!.participants.filter((s) => s.jet === 'defense')).toHaveLength(1);
  });

  // Coup principal À LA TAILLE (balayage LDB 85 l.362) suivi des gratuites de la créature (Morsure
  // l.237 puis Piétinement l.387) : le scénario même de #1852, passé par le 4ᵉ appelant (`autoCleave`
  // depuis `defenseConfirm`). Ce qui est MESURÉ ici est l'INVARIANT DE FENÊTRAGE — chaque fenêtre a SON
  // étape, aucun id ne collisionne, la séquence se clôt, le tour avance. La SUITE EXACTE des coups (qui
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
    expect(maybeOpenDefense(g, banc.setState, enemy, h1, sword)).toBe(true);
    const { armes, reperes, doublons } = jouerJusquAuBout();
    verifierLaFile(armes, reperes, doublons);
    banc.reprendreTout();
    expect(g().battle!.turn, 'le tour a AVANCÉ').not.toBe(0);
  });

  it('TAILLE + Morsure, cadence RAPIDE — même invariant, et chaque passage PROGRESSE (suite des coups : #1858)', () => {
    setCadence('rapide');
    const { enemy, h1 } = setupTaille();
    maybeOpenDefense(g, banc.setState, enemy, h1, sword);
    const { armes, reperes, doublons } = jouerJusquAuBout();
    verifierLaFile(armes, reperes, doublons);
    banc.reprendreTout();
    expect(g().battle!.turn).not.toBe(0);
  });

  // La PORTE garde un slot, elle n'interdit pas un chemin de jeu : une riposte `onCharged`
  // (Frappe réactive, LDB 10 l.498) se résout ENTIÈREMENT — fenêtre du chargeur comprise — avant
  // la frappe du chargeur. La frappe échue sur la fenêtre est le cas A-parquée de
  // `charge-suite-de-tour.hors-store.test.ts` (#3058).
  it('riposte `onCharged` à laquelle le joueur répond AVANT l’échéance du télégraphe : UNE frappe, UNE décision (#1765, #3058)', () => {
    setCadence('auto');
    const { hero } = setupRiposte();
    maybeRunEnemyTurn(g, banc.setState);
    for (let i = 0; i < 6 && !g().pendingDefense; i++) banc.jusquALaProchaine();
    expect(g().pendingDefense?.defenderId, 'chemin : le chargeur se défend de la riposte').toBe(hero.id);
    g().defenseRoll();
    g().defenseConfirm();
    jouerJusquAuBout();
    for (let i = 0; i < 300 && g().battle!.turn === 0; i++) if (!banc.jusquALaProchaine()) break;
    const frappes = g().battle!.log.filter((l) => l.kind === 'attack' && l.actorId === hero.id).length;
    expect(frappes, 'le télégraphe échu après la fermeture frappe une fois').toBe(1);
    expect(aiTurnLog().filter((r) => r.id === hero.id && r.round === 1).length, 'une décision').toBe(1);
    expect(g().battle!.turn, 'le tour a AVANCÉ').toBe(1);
  });

  it('aucun état INTERMÉDIAIRE ne pose le curseur sur une étape sans sa donnée (#1852 cond. 3)', () => {
    const { enemy, hero } = setup();
    maybeOpenDefense(g, banc.setState, enemy, hero, sword);
    const fautes: string[] = [];
    const unsub = banc.subscribe((s) => {
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
  it('Frénésie (gratuite d’Arme) PUIS Morsure : la 2ᵉ ne se déclare pas par-dessus la fenêtre de la 1ʳᵉ', () => {
    const { enemy } = setup();
    (enemy.psychState ??= []).push({ type: 'frenesie' }); // LDB 21 l.33 : « un Test de CC gratuit chaque Round »
    const suspendu = drainerLesGratuites(g, banc.setState, enemy, { disponibles: true });
    expect(suspendu, 'la gratuite d’Arme a ouvert SA fenêtre → la file s’arrête').toBe(true);
    expect(g().pendingDefense, 'une défense, et une seule').not.toBeNull();
    expect(g().pendingCascade!.participants.filter((s) => s.jet === 'defense')).toHaveLength(1);
    expect(enemy.pendingFreeAttacks, 'la file de créature n’a PAS démarré par-dessus').toBeUndefined();
  });
});

describe('#1852 — hôte ORPHELIN : le prédicat est TOTAL, et le curseur ne s’y pose jamais', () => {
  const JETS: HostJet[] = ['attack', 'defense', 'fumble', 'cast', 'test', 'extended', 'disengage', 'forceDoor'];

  // Le prédicat dit « cette étape a de quoi rendre un corps » : il doit couvrir TOUTES les causes de
  // `null` du hook de props du jet (`useXJetProps`), slot ET acteurs, sinon le renderer inconditionnel
  // de `CascadeModal` rend `{...null!}` — un crash, pas une fenêtre vide.
  const battleDe = (...ids: string[]) => ({ combatants: ids.map((id) => ({ id })) } as never);
  const ETAT_COMPLET: Record<HostJet, Record<string, unknown>> = {
    attack: { battle: battleDe('a', 'h'), pendingAttack: { attackerId: 'a', targetId: 'h' } },
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
    // useDefenseJetProps:51 / useAttackJetProps:57 / useFumbleJetProps:26 /
    // useExtendedTestJetProps:34 — `if (!attacker || !target) return null`.
    for (const jet of ['attack', 'defense', 'fumble', 'extended'] as HostJet[]) {
      expect(hoteOrphelin({ ...ETAT_COMPLET[jet], battle: battleDe('personne') } as never, etape(jet)), `${jet} sans acteur`).toBe(true);
      expect(hoteOrphelin({ ...ETAT_COMPLET[jet], battle: null } as never, etape(jet)), `${jet} hors combat`).toBe(true);
    }
  });

  it('Maladresse : sa donnée vit SUR l’étape (`step.fumble`), invisible au slot ⇒ orphelin sans elle', () => {
    expect(hoteOrphelin(ETAT_COMPLET.fumble as never, { id: 'f', kind: cleDeFixture('k'), jet: 'fumble', actorId: 'h' })).toBe(true);
  });

  it('une étape déjà VALIDÉE (`committed`) n’est jamais orpheline : elle a rendu sa donnée', () => {
    expect(hoteOrphelin({}, { id: 'd', kind: cleDeFixture('k'), jet: 'defense', actorId: 'h', committed: true })).toBe(false);
  });

  it('une étape SANS jet n’est jamais orpheline (affichage, choix, bande)', () => {
    const affichage: CascadeStep = { id: 's', kind: cleDeFixture('display') };
    expect(hoteOrphelin({}, affichage)).toBe(false);
    expect(hoteOrphelin({}, undefined)).toBe(false);
  });

  it('le curseur REFUSE d’arriver sur un hôte sans donnée (DEV : throw ; PROD : étape franchie)', () => {
    setup();
    banc.setState({
      pendingDefense: null,
      pendingCascade: cascadeDeTest([
        { id: 'affichage', kind: cleDeFixture('display'), actorId: 'h', label: fixtureText('X') },
        { id: 'defense-jet-1', kind: 'defenseJet', jet: 'defense', actorId: 'h' }, // ORPHELINE : aucun pendingDefense
      ], { title: 'Défense', purpose: 'combat' }),
    });
    expect(() => banc.getState().cascadeNext()).toThrow(/orphelin/);
  });

  it('l’ARBITRE n’élit pas la cascade quand le corps de l’étape `cast` s’efface (ciblage carte)', () => {
    const casc = cascadeDeTest([{ id: 'c', kind: cleDeFixture('castJet'), jet: 'cast', actorId: 'h' }]);
    expect(pickActiveModalKey({ pendingCast: {} as never, pendingCascade: casc })).toBe('cascade');
    expect(pickActiveModalKey({ pendingCast: { pickingTargets: true } as never, pendingCascade: casc })).toBeNull();
  });
});

describe('#1852 — garde d’unicité d’id d’étape (portes `startCascade` / `pushStep`)', () => {
  // `pendingTest` posé : les étapes d'épreuve sont des HÔTES, et le curseur refuse un hôte SANS sa
  // donnée (garde d'orphelin ci-dessus) — c'est l'unicité d'id qu'on mesure ici, pas elle.
  beforeEach(() => { banc.setState({ pendingCascade: null, suspendedCascades: [], pendingTest: {} } as never); });

  const hote = (id: string): CascadeStep => ({ id, kind: cleDeFixture('testJet'), jet: 'test', actorId: 'h' });
  const affichage = (id: string): CascadeStep => ({ id, kind: cleDeFixture('display'), actorId: 'h' });

  it('deux étapes HÔTES du MÊME id dans une séquence : refus bruyant', () => {
    expect(() => startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'combat', steps: [hote('a'), hote('a')] }))
      .toThrow(/même id/);
  });

  it('un APPEND qui rejoue l’id d’un hôte déjà dans la séquence : même refus', () => {
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'combat', steps: [hote('a')] });
    expect(() => startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'combat', steps: [hote('a')] }))
      .toThrow(/même id/);
  });

  it('une collision HORS hôte (affichage, bande d’un sous-jeu) est refusée de la même façon', () => {
    expect(() => startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'combat', steps: [affichage('b'), affichage('b')] }))
      .toThrow(/même id/);
  });

  it('un id DÉRIVÉ du compteur de la séquence ne collisionne pas (`idDansLaSequence`)', () => {
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'combat', steps: [hote(idDansLaSequence(banc.getState, 'x-jet', 'combat'))] });
    expect(() => startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'combat', steps: [hote(idDansLaSequence(banc.getState, 'x-jet', 'combat'))] }))
      .not.toThrow();
    expect(banc.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['x-jet-0', 'x-jet-1']);
  });
});

describe('#1852 — un combattant ne décide qu’UNE fois son tour', () => {
  beforeEach(() => { clearAiTurnLog(); });
  afterEach(() => { clearAiTurnLog(); });

  it('`maybeRunEnemyTurn` ×2 puis échéance des timers : UNE entrée de tour pour ce combattant/round', () => {
    const { enemy } = setup();
    enemy.traits = []; // tour d'attaque nu : c'est le NOMBRE de tours joués qui est mesuré
    maybeRunEnemyTurn(g, banc.setState);
    maybeRunEnemyTurn(g, banc.setState);
    banc.reprendreTout();
    const tours = aiTurnLog().filter((r) => r.id === enemy.id && r.round === 1);
    expect(tours.length, 'un tour = UNE décision jouée').toBe(1);
  });

  // Le tour DÉCIDÉ ne se rejoue pas, le tour non décidé se décide à la reprise : un tour bloqué AVANT
  // `runEnemyAI` par la Psychologie de début de Round (Terreur, LDB 85 l.383 — `ouvrirLeRound`) est décidé, une
  // fois, à la clôture de sa séquence (`resumeSuspendedAI` → `maybeRunEnemyTurn`, #3058).
  it('tour bloqué AVANT sa décision par la Terreur du début de Round : la clôture de la séquence le décide, une fois', () => {
    const { enemy, hero } = setup();
    enemy.traits = [];
    enemy.size = 'enorme'; // écart de Taille → Terreur (LDB 85 l.383)
    banc.setState({ battle: { ...g().battle!, turn: -1 }, pendingRoundStart: { round: 1 } } as never);
    g().confirmRoundStart();
    const joues = () => aiTurnLog().filter((r) => r.id === enemy.id && r.round === 1).length;
    const bande = g().pendingCascade?.participants.find((st) => st.kind === 'combatPsych');
    expect([bande?.combatPsych?.kind, bande?.participants?.map((pa) => pa.id)], 'chemin : la Terreur du héros ouvre sa bande').toEqual(['terreur', [hero.id]]);
    banc.reprendreTout();
    expect([joues(), g().battle!.tourIA?.cle], 'la séquence tient la main : le tour n’est pas décidé').toEqual([0, undefined]);
    jouerJusquAuBout();
    banc.reprendreTout();
    expect(joues(), 'le tour repris est décidé — une fois').toBe(1);
  });

  it('chemin joueur : `resumeCadence` pendant un timer de tour IA en vol ne rejoue pas le tour', () => {
    const { enemy } = setup();
    enemy.traits = [];
    maybeRunEnemyTurn(g, banc.setState); // timer de tour EN VOL
    g().resumeCadence();                    // le joueur change la cadence de combat (`EFFETS` de state/preferences.ts)
    banc.reprendreTout();
    const tours = aiTurnLog().filter((r) => r.id === enemy.id && r.round === 1);
    expect(tours.length).toBe(1);
  });
});
