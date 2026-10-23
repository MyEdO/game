import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { seedBattleRng } from '../../noyau/battleRng';
import { scenario } from './duel-naval';
import { targetArc, headingToBear } from '../../noyau/monde/fireArc';
import { bearingPostes, mostArmedSide } from '../../noyau/monde/shipBattery';
import { maneuverShip, shipManeuverParams } from '../../noyau/shipManeuver';
import { refusPersonneNePeutTenter } from '../../engine/skills';
import { facingToward, DIR8_ORDER } from '../../geometry/dir8';
import { isMerScene, sceneMetresPerTile } from '../../noyau/monde/scene';
import { chebyshev } from '../../engine/grid';
import { runEnemyAI, checkBattleOver } from '../../noyau/combatFlow';
import type { Combatant, ShipPoste } from '../../engine/types';
import { gabarit } from '../../gabarit.testkit';
import { draineCascade, poseSurDeNonTombe } from '../../state/cascade.testkit';
const scenarioConstruit = scenario.construire();

/** Lance le scénario duel dans le store (comme `__wfrp.scenario`), Round 1 acquitté, RNG SEMÉE. */
function launch(seed: number) {
  const g = useGame.getState();
  g.seedRng(seed);
  seedBattleRng(seed);
  g.setParty(scenario.construire().party);
  g.startScene(scenarioConstruit.scene);
  g.startCombat('duel');
  if (useGame.getState().pendingRoundStart) useGame.getState().confirmRoundStart();
}

const rangeM = (p: ShipPoste) => (typeof p.item.range === 'number' ? p.item.range : 0);
const ship = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

/** Draine TOUTE cascade en attente (Critique de navire en plein combat, fin de combat — maladie/
 *  Corruption d'un héros À BORD : #421, les pré-tirés suivent désormais les règles de création, ces
 *  cascades peuvent s'ouvrir là où elles ne s'ouvraient pas avant) — même patron que
 *  `combat-naval-e2e.test.ts::settle`, généralisé à TOUT `purpose` (pas seulement combatEndBoundary :
 *  un Critique de navire mi-combat bloquerait sinon indéfiniment `checkBattleOver`). Borné (anti-boucle). */
function settleCascade(): void {
  for (let i = 0; i < 20 && useGame.getState().pendingCascade; i++) {
    useGame.getState().cascadeResolveAll();
    useGame.getState().cascadeFinish();
  }
}

/** Reproduit l'ARBRE de décision de `runShipAI` (harness synchrone, sans timers) : bordée si un bord armé porte à
 *  portée, sinon manœuvre pour aligner le bord le plus armé (à portée) ou fermer la distance (hors portée). Comme
 *  `endShipTurn` → `advanceTurn` dans le vrai flux, la fin du tour ÉVALUE l'issue du combat (`checkBattleOver`) :
 *  une coque peut couler entre deux bordées (Voie d'eau par Round). */
function shipAct(shipId: string, targetId: string): 'fire' | 'maneuver' {
  const s = useGame.getState();
  const sh = ship(shipId), tg = ship(targetId);
  const mpt = sceneMetresPerTile(s.scene);
  const heading = s.facing[shipId] ?? 'N';
  const dist = chebyshev(sh.pos!, tg.pos!) * mpt;
  const side = targetArc(heading, sh.pos!, tg.pos!);
  const bp = bearingPostes(sh, side);
  const bpRange = Math.max(0, ...bp.map(rangeM));
  if (bpRange > 0 && dist <= bpRange && useGame.getState().shipAutoBattery(shipId, targetId)) {
    settleCascade();
    return 'fire';
  }
  const maxRange = Math.max(0, ...(sh.postes ?? []).filter((p) => p.loaded !== false).map(rangeM));
  const primary = mostArmedSide(sh);
  const desired = maxRange > 0 && dist <= maxRange && primary
    ? headingToBear(primary, facingToward(sh.pos!, tg.pos!))
    : facingToward(sh.pos!, tg.pos!);
  const d = (DIR8_ORDER.indexOf(desired) - DIR8_ORDER.indexOf(heading) + 8) % 8;
  maneuverShip(useGame.getState, shipId, Math.max(-2, Math.min(2, d <= 4 ? d : d - 8)));
  settleCascade();
  checkBattleOver(useGame.getState, useGame.setState); // fin de tour : le vrai flux passe par advanceTurn
  return 'maneuver';
}

describe('Duel naval (échelle Mer) — modèle DEUX-ÉCHELLES jouable (MDG 13-14)', () => {
  beforeEach(() => launch(7));

  it('scène MER : les COQUES ont un tour, l’équipage + les héros sont PASSAGERS (hors ordre)', () => {
    const b = useGame.getState().battle!;
    expect(isMerScene(useGame.getState().scene)).toBe(true);
    // Seules les 2 coques sont dans l'ordre d'Initiative (navire-unité, MDG 14 l.39).
    expect([...b.order].sort()).toEqual(['cogue-duel', 'grimm-duel']);
    // Les marins d'équipage sont hors ordre (passagers).
    for (const id of ['grimm-helm', 'grimm-gun', 'cogue-helm', 'cogue-gun']) expect(b.order).not.toContain(id);
    // Les HÉROS du groupe sont EMBARQUÉS sur le Grimm (rattachés à ses crewIds) → passagers eux aussi.
    const grimm = ship('grimm-duel');
    const heroesAboard = useGame.getState().party.filter((h) => grimm.crewIds!.includes(h.id));
    expect(heroesAboard.length).toBeGreaterThan(0);
    for (const h of heroesAboard) expect(b.order).not.toContain(h.id);
  });

  it('APPROCHE : les coques s’ouvrent à ~150 m (portée LONGUE, MDG 12 l.401) — plusieurs Rounds avant contact', () => {
    const mpt = sceneMetresPerTile(useGame.getState().scene);
    const dist0 = chebyshev(ship('grimm-duel').pos!, ship('cogue-duel').pos!) * mpt;
    expect(dist0).toBeGreaterThanOrEqual(140); // ~150 m
    // Le canon moyen porte à 75 m (ch.12) → il faut fermer la distance avant la 1re bordée : au moins 1 manœuvre.
    const canonRange = Math.max(0, ...ship('grimm-duel').postes!.map(rangeM));
    expect(dist0).toBeGreaterThan(canonRange);
  });

  it('DUEL JOUÉ de bout en bout : manœuvres d’approche, bordées ÉCHANGÉES, reddition à mi-coque', () => {
    const grimm0 = ship('grimm-duel').wounds.current;
    const cogue0 = ship('cogue-duel').wounds.current;
    const acts: string[] = [];
    for (let round = 0; round < 24 && !useGame.getState().battle!.over; round++) {
      acts.push('G:' + shipAct('grimm-duel', 'cogue-duel'));
      if (useGame.getState().battle!.over) break;
      acts.push('C:' + shipAct('cogue-duel', 'grimm-duel'));
    }
    // L'approche s'est JOUÉE (au moins une manœuvre) PUIS le feu a été échangé (au moins une bordée de chaque bord).
    expect(acts.some((a) => a.endsWith('maneuver'))).toBe(true);
    expect(acts).toContain('G:fire');
    expect(acts).toContain('C:fire'); // l'ennemi a RIPOSTÉ (bordées échangées)
    // Dégâts RÉELS des deux côtés (la coque joueur encaisse la riposte ennemie).
    expect(ship('cogue-duel').wounds.current).toBeLessThan(cogue0);
    expect(ship('grimm-duel').wounds.current).toBeLessThan(grimm0);
    // Issue du duel : reddition (woundsThreshold < 50 %) OU naufrage — le combat se CONCLUT.
    expect(useGame.getState().battle!.over).toBeTruthy();
  });

  it('IA DE COQUE (runShipAI) : cogue alignée & à portée → BORDÉE décidée et résolue ; la coque joueur perd des Blessures ssi le Test d’équipage réussit', () => {
    // Rapproche et aligne manuellement la cogue en batterie tribord sur le Grimm, puis fais tourner l'IA de coque.
    const b = useGame.getState().battle!;
    const grimm = ship('grimm-duel'), cogue = ship('cogue-duel');
    grimm.pos = { x: 8, y: 7 };
    cogue.pos = { x: 8, y: 3 }; // 4 cases au nord (40 m < 75 m) → dans l'arc + à portée
    useGame.setState({ facing: { ...useGame.getState().facing, 'cogue-duel': 'E' }, battle: { ...b, turn: b.order.indexOf('cogue-duel') } }); // au tour de la cogue ; cap E → le Grimm plein SUD tombe en TRIBORD
    const before = grimm.wounds.current;
    runEnemyAI(useGame.getState, useGame.setState, 'cogue-duel');
    // Issue du Test d'équipage des Artilleurs : la ligne de journal de `applyBatteryVolley` (combatSlice.ts).
    const deLaCogue = useGame.getState().journal.filter((l) => l.includes(`${cogue.label} sur ${grimm.label}`));
    const reussies = deLaCogue.filter((l) => gabarit('cs.bordee').test(l));
    const manquees = deLaCogue.filter((l) => gabarit('cs.bordeeManque').test(l));
    expect(reussies.length + manquees.length, 'une et une seule bordée décidée et résolue').toBe(1);
    expect(ship('grimm-duel').wounds.current < before).toBe(reussies.length === 1);
  });

  it('IA DE COQUE sans barreur apte : échec sans jet, refus nommé au journal, la coque avance de M exactement sans virer, Man ignoré (LDB 09 l.30 ; MDG 12 l.50 ; MDG 13 l.68-75, l.119)', () => {
    const b = useGame.getState().battle!;
    const cogue = ship('cogue-duel');
    const ko = new Set(cogue.crewIds ?? []);
    // Coque d'esquif (Man +1), sans pièce qui la déséquilibre : une barre sans jet modifiée par Man avancerait de M+1.
    const combatants = b.combatants.map((c) => (ko.has(c.id) ? { ...c, conditions: [...c.conditions, { id: 'inconscient', value: 1 }] }
      : c.id === 'cogue-duel' ? { ...c, creatureId: 'esquif', postes: [] } : c));
    useGame.setState({ battle: { ...b, combatants, turn: b.order.indexOf('cogue-duel') }, journal: [] } as never);
    const cap = useGame.getState().facing['cogue-duel'];
    const avant = { ...ship('cogue-duel').pos! };
    runEnemyAI(useGame.getState, useGame.setState, 'cogue-duel');
    expect(useGame.getState().journal).toContain(refusPersonneNePeutTenter({ skill: shipManeuverParams(ship('cogue-duel'), 'maritime').competence.id, spec: shipManeuverParams(ship('cogue-duel'), 'maritime').competence.spec }));
    expect(useGame.getState().facing['cogue-duel'], 'échec : le cap tient').toBe(cap);
    const { baseM, manoeuvre } = shipManeuverParams(ship('cogue-duel'), 'maritime');
    expect(manoeuvre).toBeGreaterThan(0);
    expect(chebyshev(avant, ship('cogue-duel').pos!), 'la coque avance de M, ni plus ni moins').toBe(baseM);
  });
});

// LDB 63 l.30 ; MDG 13 l.584 ; #1595
describe('Bordée IA : le marin tenu dévie, la bordée et le tour du navire ne se rejouent pas', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Dévier : PA −1 par Déviation, deux tirs joués une fois, la main passe', () => {
    launch(692);
    const b = useGame.getState().battle!;
    const grimm = ship('grimm-duel'), cogue = ship('cogue-duel');
    grimm.pos = { x: 8, y: 7 };
    cogue.pos = { x: 8, y: 3 };
    const marin = 'pregen-101';
    grimm.crewIds = [marin, ...grimm.crewIds!.filter((id) => id !== marin)];
    const tribord = cogue.postes!.find((p) => p.side === 'tribord')!;
    cogue.postes = [...cogue.postes!, structuredClone({ ...tribord, item: { ...tribord.item, uid: `${tribord.item.uid}-2` } })];
    useGame.setState({ facing: { ...useGame.getState().facing, 'cogue-duel': 'E' }, battle: { ...b, turn: b.order.indexOf('cogue-duel') } });
    const bordees = vi.spyOn(useGame.getState(), 'shipAutoBattery');
    const tirs = () => useGame.getState().battle!.log.filter((l) => l.text.includes(`touche ${grimm.label}`)).length;
    const paAvant = ship(marin).armour.corps;

    runEnemyAI(useGame.getState, useGame.setState, 'cogue-duel');
    const etapes = (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');
    expect(etapes.map((s) => s.actorId), 'la fenêtre du marin est ouverte').toContain(marin);
    expect(tirs(), 'le tir 2 est joué avant la décision du marin').toBe(2);
    const cap = useGame.getState().facing['cogue-duel'];
    const pos = { ...ship('cogue-duel').pos! };
    vi.advanceTimersByTime(5000);

    const devies = draineCascade(useGame.getState, 200, undefined, () => 'devier').filter((k) => k === 'deviation').length;
    vi.advanceTimersByTime(20000);
    expect(devies).toBeGreaterThan(0);
    expect(ship(marin).armour.corps, 'PA −1 par Déviation').toBe(paAvant - devies);
    expect(ship(marin).criticalWounds ?? 0).toBe(0);
    expect(tirs(), 'chaque tir part une fois').toBe(2);
    expect(bordees, 'une seule bordée').toHaveBeenCalledTimes(1);
    expect(useGame.getState().facing['cogue-duel'], 'le tour du navire ne se rejoue pas').toBe(cap);
    expect(ship('cogue-duel').pos, 'le tour du navire ne se rejoue pas').toEqual(pos);
    const apres = useGame.getState().battle!;
    expect(apres.over, 'le combat continue').toBeNull();
    expect(useGame.getState().pendingRoundStart, 'la main a quitté la cogue : pause de début de Round').not.toBeNull();
  });

  // MDG 14 l.37 ; #1852 ; #1595
  it('un coup INTERMÉDIAIRE de la volée suspend : à la reprise, la cogue ne rejoue pas son tour', () => {
    launch(2);
    const b = useGame.getState().battle!;
    const cogue = ship('cogue-duel');
    cogue.pos = { x: 8, y: 3 };
    ship('grimm-duel').pos = { x: 8, y: 9 };
    const tribord = cogue.postes!.find((p) => p.side === 'tribord')!;
    cogue.postes = [...cogue.postes!, structuredClone({ ...tribord, item: { ...tribord.item, uid: `${tribord.item.uid}-2` } })];
    const pirate = { ...structuredClone(ship('pregen-101')), id: 'pirate', label: 'Pirate', pos: { x: 8, y: 5 }, traits: [{ id: 'demoniaque', value: 9 }] } as unknown as Combatant;
    useGame.setState({ facing: { ...useGame.getState().facing, 'cogue-duel': 'E' }, battle: { ...b, combatants: [...b.combatants, pirate], turn: b.order.indexOf('cogue-duel') } });
    const bordees = vi.spyOn(useGame.getState(), 'shipAutoBattery');
    const pv = ship('pirate').wounds.current;
    const cap = useGame.getState().facing['cogue-duel'];
    const pos = { ...ship('cogue-duel').pos! };

    expect(useGame.getState().shipAutoBattery('cogue-duel', 'pirate')).toBe(true);
    expect(useGame.getState().pendingCascade, 'le 1er coup suspend sur la sauvegarde').not.toBeNull();
    expect(ship('pirate').wounds.current, 'le 2e coup attend dans la suite').toBe(pv);
    vi.advanceTimersByTime(5000);
    draineCascade(useGame.getState, 200, poseSurDeNonTombe(1));
    vi.advanceTimersByTime(20000);

    expect(bordees, 'une seule bordée').toHaveBeenCalledTimes(1);
    expect(useGame.getState().facing['cogue-duel'], 'le tour du navire ne se rejoue pas').toBe(cap);
    expect(ship('cogue-duel').pos, 'le tour du navire ne se rejoue pas').toEqual(pos);
    expect(useGame.getState().battle!.over, 'le combat continue').toBeNull();
    expect(useGame.getState().pendingRoundStart, 'la main a quitté la cogue : pause de début de Round').not.toBeNull();
  });
});
