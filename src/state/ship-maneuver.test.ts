import { describe, it, expect, vi } from 'vitest';
import { rotateDir8, DIR8_DELTA } from '../noyau/monde/dir8';
import { inFireArc, targetArc } from '../noyau/monde/fireArc';
import { useGame } from './store';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import { makeRNG } from '../engine/dice';
import { ECHEC_SANS_JET } from '../engine/tests';
import { jete } from '../engine/tests.testkit';
import { emptyScene } from '../noyau/monde/scene';
import { maneuverShip, rollShipManeuver, applyShipManeuver, maneuverCrewTotal, deriveManeuverFromCrew, shipManeuverParams } from '../noyau/shipManeuver';
import * as navalTraitsMod from '../engine/navalTraits';
import { crewTestSuccess, crewRoleValue } from '../engine/crewMorale';
import { refusNePeutTenter, refusPersonneNePeutTenter } from '../engine/skills';
import { findCrewRoleById } from '../data';
import { t } from '../i18n';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, NavalTraitRef, ShipPoste } from '../engine/types';

/**
 * Phase 2 « Manœuvre du navire » (MDG 13). Le cœur PUR : tourner le cap (`rotateDir8`) RE-MAPPE d'un coup
 * tous les arcs de bordée (la cible change de côté) ; le virage suit l'issue du Test qui le porte.
 */
describe('rotateDir8 — rotation du cap', () => {
  it('vire tribord (horaire, steps>0) / bâbord (anti-horaire, steps<0) par crans de 45°', () => {
    expect(rotateDir8('N', 2)).toBe('E'); // 90° à droite (tribord)
    expect(rotateDir8('N', -2)).toBe('O'); // 90° à gauche (bâbord)
    expect(rotateDir8('N', 1)).toBe('NE');
    expect(rotateDir8('N', -1)).toBe('NO');
    expect(rotateDir8('E', 4)).toBe('O'); // demi-tour
    expect(rotateDir8('NO', 1)).toBe('N'); // wrap horaire
    expect(rotateDir8('N', 0)).toBe('N');
  });
});

describe('Manœuvre → re-mapping des bordées (aligner / désaligner sa bordée)', () => {
  const ship = { x: 5, y: 5 };
  const east = { x: 9, y: 5 }; // cible plein EST du navire

  it('cap Nord : la cible plein est tombe dans la bordée TRIBORD', () => {
    expect(targetArc('N', ship, east)).toBe('tribord');
    expect(inFireArc('tribord', 'N', ship, east)).toBe(true);
  });

  it('virer tribord (N → E) SORT la cible de la bordée tribord (elle passe en PROUE)', () => {
    const h = rotateDir8('N', 2); // 'E'
    expect(targetArc(h, ship, east)).toBe('proue');
    expect(inFireArc('tribord', h, ship, east)).toBe(false); // la bordée tribord ne porte plus
  });

  it('virer bâbord (N → O) met la cible plein est DERRIÈRE (poupe), hors des deux bordées', () => {
    expect(targetArc(rotateDir8('N', -2), ship, east)).toBe('poupe'); // 'O' : on s'est détourné de la cible
  });

  it('demi-tour (N → S) fait passer la cible de tribord à BÂBORD (bordée opposée)', () => {
    expect(targetArc(rotateDir8('N', 4), ship, east)).toBe('babord'); // 'S'
  });
});

describe('shipTurn (action store) — vire le cap, branché aux arcs', () => {
  const ship = (): Combatant =>
    ({ id: 'ship', label: 'Cogue', kind: 'enemy', pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('vire tribord 90° (N → E)', () => {
    useGame.setState({ battle: { combatants: [ship()], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' } });
    useGame.getState().shipTurn('ship', 2);
    expect(useGame.getState().facing.ship).toBe('E'); // firedAttackBlock/targeting reliront ce cap → arcs re-mappés
  });

  it('vire bâbord 90° (N → O)', () => {
    useGame.setState({ battle: { combatants: [ship()], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' } });
    useGame.getState().shipTurn('ship', -2);
    expect(useGame.getState().facing.ship).toBe('O');
  });

  it('navire sans cap → no-op (aucun virage fantôme)', () => {
    useGame.setState({ battle: { combatants: [], order: [], turn: 0 } as never, facing: {} });
    useGame.getState().shipTurn('ghost', 2);
    expect(useGame.getState().facing.ghost).toBeUndefined();
  });
});

describe('maneuverShip — Test de Navigation du barreur → vire le navire (MDG 13)', () => {
  const helmsman = (): Combatant =>
    ({
      id: 'helm', label: 'Timonier', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
      skills: [{ id: 'voile', characteristic: 'agilite', advances: 40 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 },
    }) as unknown as Combatant;
  const ship = (): Combatant =>
    ({ id: 'ship', label: 'Barge', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['helm'], pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('vire le navire SSI le Test réussit (virage ⇔ réussite ; barreur = meilleur en Voile)', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [ship(), helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' } });
    const before = useGame.getState().facing.ship;
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r).toBeTruthy();
    expect(r.helmsman).toBe('Timonier'); // le seul de l'équipage → barreur désigné
    const after = useGame.getState().facing.ship;
    expect(after !== before).toBe(r.success); // le navire ne vire QUE sur une manœuvre réussie
    if (r.success) expect(after).toBe('E'); // tribord 90° depuis Nord
  });

  it('hors combat → null', () => {
    useGame.setState({ battle: null as never });
    expect(maneuverShip(() => useGame.getState(), 'ship', 2)).toBeNull();
  });

  it('« Peu maniable » pénalise la manœuvre (−1 DR/niveau, MDG 12 l.173) — cumulé au Man de la colonne', () => {
    // La cogue : Man −1 (colonne) ET Trait « Peu maniable » (−1 DR) → DR final = DR brut − 2 (colonnes distinctes).
    const cogue = { ...ship(), creatureId: 'cogue' } as Combatant;
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [cogue, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' } });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.dr).toBe(r.navDR - 2); // Man (−1) + Peu maniable (−1)
  });

  it('« Lissage » (Amélioration d’instance) → M +1 : +1 au déplacement, DR inchangé (MDG 12 l.293)', () => {
    // Même barreur/seed → même DR ; seul le M de base change. testValue ≥ −2 DR (helmsman habile) → jamais la
    // bande M−1/M÷2 → +1 M ⇒ exactement +1 case de déplacement.
    const run = (upgrades?: NavalTraitRef[]) => {
      seedBattleRng(7);
      const s = { ...ship(), upgrades } as Combatant; // bateau-de-patrouille (aucun Lissage de TYPE)
      useGame.setState({ battle: { combatants: [s, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' } });
      return maneuverShip(() => useGame.getState(), 'ship', 2)!;
    };
    const plain = run();
    const lisse = run([{ id: 'lissage' }]);
    expect(lisse.dr).toBe(plain.dr); // Lissage n'affecte PAS le DR (≠ Peu maniable)…
    expect(lisse.movement).toBe(plain.movement + 1); // … mais +1 au Mouvement de base
  });

  it('« Bouteur » (Amélioration) → +20 au Test de Navigation pour diriger (MSRC 12 l.66) : +2 DR à la manœuvre', () => {
    // Même barreur/seed → même navDR ; Bouteur ajoute +2 DR (÷10 de +20) au DR final, et son moveMod −1 baisse le M.
    const run = (upgrades?: NavalTraitRef[]) => {
      seedBattleRng(7);
      const s = { ...ship(), upgrades } as Combatant; // bateau-de-patrouille (aucun navTestMod de TYPE)
      useGame.setState({ battle: { combatants: [s, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
      return maneuverShip(() => useGame.getState(), 'ship', 2)!;
    };
    const plain = run();
    const bouteur = run([{ id: 'bouteur' }]);
    expect(bouteur.navDR).toBe(plain.navDR); // même jet du barreur (seed identique)
    expect(bouteur.dr).toBe(plain.dr + 2); // +20 au Test → +2 DR d'équipage
  });

  it('« Gréement de course » (Amélioration) → −10 au Test de Navigation (MSRC 12 l.140) : −1 DR à la manœuvre', () => {
    const run = (upgrades?: NavalTraitRef[]) => {
      seedBattleRng(7);
      const s = { ...ship(), upgrades } as Combatant;
      useGame.setState({ battle: { combatants: [s, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
      return maneuverShip(() => useGame.getState(), 'ship', 2)!;
    };
    const plain = run();
    const greement = run([{ id: 'greement-de-course' }]);
    expect(greement.dr).toBe(plain.dr - 1); // −10 au Test → −1 DR d'équipage
  });

  it('succès → vire ET avance ; le barreur (à bord) suit la coque du MÊME delta (formation rigide)', () => {
    seedBattleRng(7);
    const s = ship();
    const h = helmsman();
    h.pos = { x: 5, y: 4 }; // équipier décalé d'une case → vérifie que l'offset est conservé
    useGame.setState({ battle: { combatants: [s, h], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.success).toBe(true); // (seed 7 : manœuvre réussie — cf. test ci-dessus)
    expect(r.advanced).toBeGreaterThan(0); // le navire AVANCE
    const d = DIR8_DELTA[useGame.getState().facing.ship]; // cap d'APRÈS le virage
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5 + d.gx * r.advanced, y: 5 + d.gy * r.advanced });
    expect(b.combatants.find((c) => c.id === 'helm')!.pos).toEqual({ x: 5 + d.gx * r.advanced, y: 4 + d.gy * r.advanced });
  });

  it('barreur : un marin à terre / inconscient n’est jamais désigné (RAW : il ne peut pas tenir la barre)', () => {
    seedBattleRng(7);
    const down = { ...helmsman(), id: 'ace', label: 'As' } as Combatant; // meilleur en Voile (Ag 40, +40)…
    down.wounds = { current: 0, max: 10 };                              // … mais à terre (0 PB) → inapte
    const ok = { ...helmsman(), id: 'helm', label: 'Timonier' } as Combatant;
    ok.characteristics = { ...ok.characteristics, agilite: 30 };
    ok.skills = [{ id: 'voile', characteristic: 'agilite', advances: 10 } as never]; // conscient mais moins bon
    const s = { ...ship(), crewIds: ['ace', 'helm'] } as Combatant;
    useGame.setState({ battle: { combatants: [s, down, ok], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.helmsman).toBe('Timonier'); // pas « As » malgré sa meilleure Voile : il est hors-combat
  });

  it('pièces massées sur un bord (poids > 50 % de la Contenance) → −2 M / −2 Man / −2 DR de Navigation (MDG 12 l.432-433)', () => {
    const heavyTribord = { side: 'tribord', item: { enc: 100000 }, crewIds: [] } as unknown as ShipPoste;
    const run = (postes?: ShipPoste[]) => {
      seedBattleRng(7);
      const s = { ...ship(), postes } as Combatant; // bateau-de-patrouille : Contenance 80, Man 0, aucun Trait à passif
      useGame.setState({ battle: { combatants: [s, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
      return maneuverShip(() => useGame.getState(), 'ship', 2)!;
    };
    const plain = run();
    const heavy = run([heavyTribord]);
    expect(heavy.dr).toBe(plain.dr - 4); // Man −2 + DR de Navigation −2 (même navDR : seed + barreur identiques)
    expect(heavy.movement).toBeLessThan(plain.movement); // … et le M −2 réduit aussi le déplacement
  });

  it('échec → PAS de virage mais le navire avance QUAND MÊME le long du cap (RAW : déplacement inconditionnel)', () => {
    // Barreur faible (Voile ~18) sur la cogue (Man −1, Peu maniable −1) → DR final toujours < 0 (sl max 1 − 2 ≤ −1).
    const weak = helmsman();
    weak.skills = [{ id: 'voile', characteristic: 'agilite', advances: 0 } as never];
    weak.characteristics = { ...weak.characteristics, agilite: 18 };
    const cogue = { ...ship(), creatureId: 'cogue' } as Combatant;
    seedBattleRng(3);
    useGame.setState({ battle: { combatants: [cogue, weak], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.success).toBe(false); // manœuvre ratée
    expect(useGame.getState().facing.ship).toBe('N'); // le cap TIENT (aucun virage)
    expect(r.advanced).toBeGreaterThan(0); // … mais le navire avance quand même (M÷2 plancher)
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5, y: 5 - r.advanced }); // plein Nord
  });
});

describe('shipAdvance (action store) — avance coque + équipage le long du cap (MDG 13)', () => {
  const hull = (over: Partial<Combatant> = {}): Combatant =>
    ({ id: 'ship', label: 'Cogue', kind: 'npc', pos: { x: 5, y: 5 }, crewIds: ['m1', 'm2'], conditions: [], weapons: [], ...over }) as unknown as Combatant;
  const sailor = (id: string, pos: { x: number; y: number }): Combatant =>
    ({ id, label: id, kind: 'npc', pos, conditions: [], weapons: [] }) as unknown as Combatant;

  it('cap E, 3 cases → coque +3x ; équipage translaté du MÊME delta (offsets conservés) ; renvoie 3', () => {
    const m1 = sailor('m1', { x: 4, y: 4 });
    const m2 = sailor('m2', { x: 4, y: 6 });
    useGame.setState({ battle: { combatants: [hull(), m1, m2], order: ['ship'], turn: 0 } as never, facing: { ship: 'E' }, scene: null as never });
    expect(useGame.getState().shipAdvance('ship', 3)).toBe(3);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 8, y: 5 });
    expect(b.combatants.find((c) => c.id === 'm1')!.pos).toEqual({ x: 7, y: 4 }); // +3x, offset (−1,−1) gardé
    expect(b.combatants.find((c) => c.id === 'm2')!.pos).toEqual({ x: 7, y: 6 });
  });

  it('clampe aux bornes de scène : coque près du bord → moved < cases, équipage translaté du même moved', () => {
    const m1 = sailor('m1', { x: 4, y: 5 });
    useGame.setState({ battle: { combatants: [hull({ crewIds: ['m1'] }), m1], order: ['ship'], turn: 0 } as never, facing: { ship: 'E' }, scene: emptyScene('scene-test', 7, 10) });
    expect(useGame.getState().shipAdvance('ship', 5)).toBe(1); // bord est à x=6 → 1 seule case dispo depuis x=5
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 6, y: 5 });
    expect(b.combatants.find((c) => c.id === 'm1')!.pos).toEqual({ x: 5, y: 5 }); // +1 (même moved)
  });

  it('cap absent OU 0 case dispo → no-op, renvoie 0 (aucune mutation)', () => {
    useGame.setState({ battle: { combatants: [hull()], order: ['ship'], turn: 0 } as never, facing: {}, scene: null as never });
    expect(useGame.getState().shipAdvance('ship', 3)).toBe(0); // pas de cap
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5, y: 5 }); // intacte
  });

  // ── Séparation jet ⟂ application (patron des flux différés) : le jet ne mute RIEN ; l'application vire+avance. ──
  const helm2 = (): Combatant =>
    ({ id: 'helm', label: 'Timonier', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
      skills: [{ id: 'voile', characteristic: 'agilite', advances: 40 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
  const ship2 = (): Combatant =>
    ({ id: 'ship', label: 'Barge', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['helm'], pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('rollShipManeuver NE MUTE RIEN (ni cap, ni position) — il ne fait que résoudre le Test', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [ship2(), helm2()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const res = rollShipManeuver(() => useGame.getState(), 'ship', 'helm')!;
    expect(res.advanced).toBe(0); // non appliqué à ce stade (résolution du Test seule)
    expect(useGame.getState().facing.ship).toBe('N'); // cap INCHANGÉ par le jet
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5, y: 5 }); // position INCHANGÉE
  });

  it('barre qui ne peut pas tenter le Test (sans Voile, Inconsciente, aucun barreur) : ÉCHEC sans jet, le barreur imposé reste nommé (LDB 09 l.30, LDB 16 l.113, #2588 Q1)', () => {
    const sansVoile = { ...helm2(), skills: [] } as unknown as Combatant;
    const ko = { ...helm2(), conditions: [{ id: 'inconscient', value: 1 }] } as unknown as Combatant;
    for (const [nom, h, imposee] of [['sans Voile', sansVoile, 'helm'], ['Inconsciente', ko, 'helm'], ['aucun barreur', ko, undefined]] as const) {
      seedBattleRng(7);
      useGame.setState({ battle: { combatants: [ship2(), h], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
      const res = rollShipManeuver(() => useGame.getState(), 'ship', imposee)!;
      expect(res.helmsman, `${nom} : le barreur imposé, sinon personne`).toBe(imposee ? h.label : undefined);
      expect(res.roll, `${nom} : aucun jet`).toBeUndefined();
      expect(res.success, `${nom} : le Test exigé est un ÉCHEC`).toBe(false);
    }
  });

  it('barre non tentable : le refus NOMMÉ du barreur imposé, ou de personne sans barreur, et le journal le porte (LDB 09 l.30 ; #2588 Q1)', () => {
    const sansVoile = { ...helm2(), skills: [] } as unknown as Combatant;
    const { id: skill, spec } = shipManeuverParams(ship2(), 'maritime').competence;
    for (const [imposee, attendu] of [['helm', refusNePeutTenter(sansVoile, { skill, spec })], [undefined, refusPersonneNePeutTenter({ skill, spec })]] as const) {
      useGame.setState({ battle: { combatants: [ship2(), sansVoile], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never, journal: [] });
      const res = rollShipManeuver(() => useGame.getState(), 'ship', imposee)!;
      expect(res.refus).toBe(attendu);
      applyShipManeuver(() => useGame.getState(), 'ship', res, 2);
      expect(useGame.getState().journal).toContain(attendu);
      expect(useGame.getState().journal).toContain(t('shipManv.failLine', { helmsman: imposee ? sansVoile.label : t('shipManv.crewFallback'), ship: ship2().label, dr: res.dr }));
    }
  });

  it('barre sans jet sur un esquif (Man +1) : la Progression au DR de l’échec sans jet, sans Man — avance de M exactement, cap inchangé (MDG 12 l.50, MDG 13 l.68-75, l.119)', () => {
    const esquif = { ...ship2(), creatureId: 'esquif', crewIds: [] } as unknown as Combatant;
    const { baseM, manoeuvre } = shipManeuverParams(esquif, 'maritime');
    expect(manoeuvre).toBeGreaterThan(0);
    useGame.setState({ battle: { combatants: [esquif], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.success).toBe(false);
    expect(r.dr).toBe(ECHEC_SANS_JET.sl);
    expect(r.advanced).toBe(baseM);
    expect(useGame.getState().facing.ship).toBe('N');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5, y: 5 - baseM });
  });

  it('applyShipManeuver vire (si succès) + avance le long du cap', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [ship2(), helm2()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const res = rollShipManeuver(() => useGame.getState(), 'ship', 'helm')!;
    expect(res.success).toBe(true); // seed 7 → réussite (cf. tests maneuverShip)
    const advanced = applyShipManeuver(() => useGame.getState(), 'ship', res, 2); // tribord 90°
    expect(advanced).toBeGreaterThan(0);
    expect(useGame.getState().facing.ship).toBe('E');
  });

  it('barreur seul : réussite du virage = réussite du d100 (LDB 12 l.11), le Man ne déplace que le DR (MDG 13 l.119)', () => {
    // Cogue : Man −1 + Peu maniable −1 = −2 au DR ; un d100 réussi de justesse donne un DR final négatif.
    let diverged = false;
    for (const seed of Array.from({ length: 30 }, (_, i) => i + 1)) {
      seedBattleRng(seed);
      useGame.setState({ battle: { combatants: [{ ...ship2(), creatureId: 'cogue' }, helm2()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
      const r = rollShipManeuver(() => useGame.getState(), 'ship', 'helm')!;
      expect(r.success).toBe(r.roll! <= r.target!); // succès ⇔ d100 ≤ cible, indépendant du Man / du dr
      if ((r.roll! <= r.target!) !== (r.dr >= 0)) diverged = true; // le signe du DR final et le d100 divergent
    }
    expect(diverged).toBe(true); // garde-fou : ce set de seeds EXERCE bien la divergence (test non vacant)
  });

  // Coque COMPLÈTE pour l'éperonnage : characteristics/PB (IC), creatureId (M), bodyShape (détection de coque).
  const navHull = (id: string, x: number, creatureId: string, E: number, pb: number): Combatant =>
    ({ id, label: id, kind: 'npc', creatureId, bodyShape: 'vehicule', pos: { x, y: 5 }, crewIds: [],
      characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
      wounds: { current: pb, max: pb, base: pb }, advantage: 0, conditions: [], weapons: [], armour: { corps: 0 }, skills: [], talents: [] }) as unknown as Combatant;

  it('avance vers une AUTRE coque → s’arrête ADJACENT (pas de chevauchement) et les deux coques encaissent', () => {
    const ship = navHull('ship', 5, 'cogue', 45, 50);
    const other = navHull('other', 8, 'knarr', 40, 30);
    useGame.setState({ battle: { combatants: [ship, other], order: ['ship'], turn: 0 } as never, facing: { ship: 'E', other: 'O' }, scene: null as never });
    expect(useGame.getState().shipAdvance('ship', 5)).toBe(2); // cap E : cases 6,7 libres ; 8 occupée → stop à 7
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 7, y: 5 }); // adjacent, PAS sur (8,5)
    expect(b.combatants.find((c) => c.id === 'other')!.wounds.current).toBeLessThan(30); // la victime encaisse
    expect(b.combatants.find((c) => c.id === 'ship')!.wounds.current).toBeLessThan(50); // le causeur aussi (l.446)
  });

  it('tuile cible libre (aucune coque sur le chemin) → avance pleine, AUCUNE collision', () => {
    const ship = navHull('ship', 5, 'cogue', 45, 50);
    const other = navHull('other', 20, 'knarr', 40, 30); // hors de portée
    useGame.setState({ battle: { combatants: [ship, other], order: ['ship'], turn: 0 } as never, facing: { ship: 'E', other: 'O' }, scene: null as never });
    expect(useGame.getState().shipAdvance('ship', 3)).toBe(3); // rien devant → avance pleine
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'other')!.wounds.current).toBe(30); // intacte
  });
});

describe('flux shipManeuver (store) — bouton HUD → modale → confirm (MDG 13)', () => {
  const helm = (): Combatant =>
    ({ id: 'helm', label: 'Timonier', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 2, resilience: 1,
      skills: [{ id: 'voile', spec: 'chaland', characteristic: 'agilite', advances: 40 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
  const ship = (): Combatant =>
    ({ id: 'ship', label: 'Barge', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['helm'], pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('battleShipManeuver ouvre le Test d’équipage (participants) ; setTurn ; roll PJ ; confirm → Action consommée', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [ship(), helm()], order: ['helm'], turn: 0, acted: false } as never, party: [helm()], facing: { ship: 'N' }, pendingShipManeuver: null, scene: null as never });
    useGame.getState().battleShipManeuver('helm');
    const p = useGame.getState().pendingShipManeuver!;
    expect(p.shipId).toBe('ship');
    expect(p.participants.some((x) => x.id === 'helm')).toBe(true); // le Timonier (helm) est contributeur
    useGame.getState().shipManeuverSetTurn(2); // tribord 90° (virage ⟂ jet)
    expect(useGame.getState().pendingShipManeuver!.turnSteps).toBe(2);
    useGame.getState().shipManeuverRoll('helm'); // le PJ lance SON rôle (interactif)
    expect(useGame.getState().pendingShipManeuver!.participants.every((x) => x.result)).toBe(true);
    expect(useGame.getState().facing.ship).toBe('N'); // cap encore intact : application différée à la confirmation
    useGame.getState().shipManeuverConfirm();
    const st = useGame.getState();
    expect(st.pendingShipManeuver).toBeNull();
    expect(st.battle!.acted).toBe(true); // un jet = une Action
  });

  /** Marin ÉPINGLÉ (`shipRole`) à la barre sans Voile — Compétence Avancée sans Augmentation (LDB 09 l.30) :
   *  la seule façon pour un rôle d'échoir à qui ne peut pas le tenter (`shipDefaultRoles` n'élit que des formés). */
  const sansVoile = (): Combatant => ({ ...helm(), id: 'muet', label: 'Muet', skills: [], shipRole: 'timonier' }) as unknown as Combatant;
  const ouvreAvecSansVoile = (): void => {
    seedBattleRng(7);
    const shipC = { ...ship(), crewIds: ['helm', 'muet'] } as unknown as Combatant;
    useGame.setState({ battle: { combatants: [shipC, helm(), sansVoile()], order: ['helm'], turn: 0, acted: false } as never, party: [helm(), sansVoile()], facing: { ship: 'N' }, pendingShipManeuver: null, scene: null as never });
    useGame.getState().battleShipManeuver('helm');
  };

  it('rôle que son titulaire ne peut pas tenter : N+1 rangées, dont UNE échec sans jet à refus nommé (LDB 09 l.30 ; #2588 Q1)', () => {
    ouvreAvecSansVoile();
    const parts = useGame.getState().pendingShipManeuver!.participants;
    expect(parts.map((x) => x.id)).toEqual(['helm', 'muet']);
    const muet = parts.find((x) => x.id === 'muet')!;
    expect(muet.result).toEqual(ECHEC_SANS_JET);
    expect(muet.refus).toBe('Muet ne peut pas tenter le Test de Voile (Chaland).');
    expect(muet.interactive).toBe(false);
    expect(parts.find((x) => x.id === 'helm')!.result).toBeNull(); // le titulaire tentable attend SON jet
  });

  it('rôle non tentable : le total = Σ des N jets + DR plats, la ligne sans jet n’y pèse rien (MDG 14 l.13)', () => {
    ouvreAvecSansVoile();
    useGame.getState().shipManeuverRoll('helm');
    const p = useGame.getState().pendingShipManeuver!;
    const helmSl = jete(p.participants.find((x) => x.id === 'helm')!.result).sl;
    const plats = maneuverCrewTotal([], p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR);
    expect(maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR)).toBe(helmSl + plats);
  });

  it('rôle non tentable : ni jet, ni Résilience, ni Chance — aucun tirage consommé (LDB 09 l.30 ; #2588 Q1)', () => {
    ouvreAvecSansVoile();
    const st = useGame.getState();
    st.shipManeuverRoll('muet');
    st.shipManeuverForceSuccess('muet');
    st.shipManeuverBonusSL('muet');
    st.shipManeuverReroll('muet');
    expect(useGame.getState().pendingShipManeuver!.participants.find((x) => x.id === 'muet')!.result).toEqual(ECHEC_SANS_JET);
    const muet = useGame.getState().battle!.combatants.find((c) => c.id === 'muet')!;
    expect([muet.fortune, muet.resilience]).toEqual([2, 1]); // aucun point dépensé
    expect(battleRng().int(1, 1_000_000)).toBe(makeRNG(7).int(1, 1_000_000)); // le flux n'a rien tiré depuis la graine
  });

  it('héros qui ne sert aucun navire → battleShipManeuver n’ouvre rien', () => {
    useGame.setState({ battle: { combatants: [helm()], order: ['helm'], turn: 0, acted: false } as never, party: [], facing: {}, pendingShipManeuver: null, scene: null as never });
    useGame.getState().battleShipManeuver('helm');
    expect(useGame.getState().pendingShipManeuver).toBeNull();
  });

  it('Action déjà dépensée → battleShipManeuver n’ouvre rien', () => {
    useGame.setState({ battle: { combatants: [ship(), helm()], order: ['helm'], turn: 0, acted: true } as never, party: [], facing: { ship: 'N' }, pendingShipManeuver: null, scene: null as never });
    useGame.getState().battleShipManeuver('helm');
    expect(useGame.getState().pendingShipManeuver).toBeNull();
  });

  // #351 : `navalTestTypeDR(traits,'manoeuvre')` (#221 skillDRBonus ciblé testType) était additionné DEUX fois
  // (openCrewTestPending ET shipManeuverParams, consommé par deriveManeuverFromCrew) — site canonique désormais
  // UNIQUE (openCrewTestPending, comme la bordée/le Test d'équipage générique) ; shipManeuverParams.extraDR ne
  // porte plus JAMAIS de terme `testType`.
  it('shipManeuverParams n’ajoute JAMAIS le mod `testType:"manoeuvre"` (site canonique = openCrewTestPending seul)', () => {
    const shipC = ship();
    const baseline = shipManeuverParams(shipC, 'maritime').extraDR; // sans mod `testType`
    const spy = vi.spyOn(navalTraitsMod, 'navalTestTypeDR').mockImplementation((_traits, testTypeId) => (testTypeId === 'manoeuvre' ? 3 : 0));
    try {
      // Si shipManeuverParams consommait encore `navalTestTypeDR('manoeuvre')`, cette valeur (3) SE VERRAIT ICI —
      // elle ne doit rien changer : le mod est UNIQUEMENT lu par `openCrewTestPending` (combatSlice.ts).
      expect(shipManeuverParams(shipC, 'maritime').extraDR).toBe(baseline);
    } finally {
      spy.mockRestore();
    }
  });

  it('Test d’équipage de manœuvre : le DR final ne compte le mod `testType:"manoeuvre"` qu’UNE SEULE fois', () => {
    const spy = vi.spyOn(navalTraitsMod, 'navalTestTypeDR').mockImplementation((_traits, testTypeId) => (testTypeId === 'manoeuvre' ? 3 : 0));
    try {
      seedBattleRng(7);
      useGame.setState({ battle: { combatants: [ship(), helm()], order: ['helm'], turn: 0, acted: false } as never, party: [helm()], facing: { ship: 'N' }, pendingShipManeuver: null, scene: null as never });
      useGame.getState().battleShipManeuver('helm');
      const p = useGame.getState().pendingShipManeuver!;
      expect(p.extraDR).toBe(3); // openCrewTestPending : SEUL site d'addition du mod
      useGame.getState().shipManeuverRoll('helm');
      const rolled = useGame.getState().pendingShipManeuver!;
      const total = maneuverCrewTotal(rolled.participants, rolled.essentialRoleId, rolled.moraleScore, rolled.undercrew, rolled.extraDR);
      const shipC = useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!;
      const params = shipManeuverParams(shipC, 'maritime'); // n'a jamais lu le mod `testType` (test précédent)
      const result = deriveManeuverFromCrew(shipC, total, 'maritime');
      expect(result.dr).toBe(total + params.manoeuvre + params.extraDR); // AUCUN +3 caché en plus
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * SEUIL DE SUCCÈS du Test d'équipage de MANŒUVRE (#1019) — MDG 14 l.13 : « Si le total est de 1 DR ou
   * plus, le résultat global est un succès. Le MJ peut aussi considérer un résultat de 0 comme un succès
   * en fonction des circonstances. » Le virage passe par le MÊME socle que la bordée (`crewTestSuccess`)
   * — sonde du juge : à DR final 0, la manœuvre divergeait du socle sous la règle optionnelle.
   */
  it('DR final 0 : virage RATÉ par défaut, RÉUSSI sous « 0 DR compte comme un succès » — même socle que la bordée', () => {
    const shipC = { ...ship(), creatureId: 'bateau-de-patrouille' } as Combatant; // Man 0, aucun trait à passif
    const params = shipManeuverParams(shipC, 'maritime');
    const crewTotal = -(params.manoeuvre + params.extraDR); // DR final = crewTotal + Man + extra = 0 pile
    expect(deriveManeuverFromCrew(shipC, crewTotal, 'maritime').dr).toBe(0);
    expect(deriveManeuverFromCrew(shipC, crewTotal, 'maritime').success).toBe(crewTestSuccess(0)); // le socle, jamais un seuil local
    expect(deriveManeuverFromCrew(shipC, crewTotal, 'maritime').success).toBe(false); // défaut RAW : 0 = échec
    setRule('crew-test-zero-success', true);
    try {
      expect(deriveManeuverFromCrew(shipC, crewTotal, 'maritime').success).toBe(true); // Succès Minime → le navire vire
      expect(deriveManeuverFromCrew(shipC, crewTotal - 1, 'maritime').success).toBe(false); // −1 reste un échec
    } finally {
      resetRule('crew-test-zero-success');
    }
  });
});

describe('Test d’équipage : un rôle devenu non tentable au jet pose le refus avec l’échec sans jet (LDB 09 l.30 ; #2588 Q1)', () => {
  it('le Timonier perd sa Voile entre l’ouverture et son jet : sa rangée naît ECHEC_SANS_JET avec SON refus', () => {
    seedBattleRng(7);
    const helm = { id: 'helm', label: 'Timonier', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 2, resilience: 1,
      skills: [{ id: 'voile', spec: 'chaland', characteristic: 'agilite', advances: 40 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } } as unknown as Combatant;
    const ship = { id: 'ship', label: 'Barge', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['helm'], pos: { x: 5, y: 5 }, conditions: [], weapons: [] } as unknown as Combatant;
    useGame.setState({ battle: { combatants: [ship, helm], order: ['helm'], turn: 0, acted: false } as never, party: [helm], facing: { ship: 'N' }, pendingShipManeuver: null, scene: null as never });
    useGame.getState().battleShipManeuver('helm');
    const part = useGame.getState().pendingShipManeuver!.participants.find((x) => x.id === 'helm')!;
    expect(part.result).toBeNull();
    const b = useGame.getState().battle!;
    const sansVoile = { ...helm, skills: [] } as unknown as Combatant;
    useGame.setState({ battle: { ...b, combatants: b.combatants.map((c) => (c.id === 'helm' ? sansVoile : c)) } });
    useGame.getState().shipManeuverRoll('helm');
    const apres = useGame.getState().pendingShipManeuver!.participants.find((x) => x.id === 'helm')!;
    const attendu = crewRoleValue(sansVoile, findCrewRoleById(part.roleId)!, apres.navigation).refus;
    expect(attendu).toBeDefined();
    expect(apres.result).toEqual(ECHEC_SANS_JET);
    expect(apres.refus).toBe(attendu);
  });
});
