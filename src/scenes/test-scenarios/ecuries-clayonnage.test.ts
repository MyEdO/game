import { describe, it, expect } from 'vitest';
import { scenario } from './ecuries-clayonnage';
import { scenario as diligence } from './diligence';
import { lineOfSightCover, makeLosMemo, type LosMemo } from '../../state/lineOfSight';
import { wallBetween, areteOcculteEntre, structureAt, emptyScene, type Scene } from '../../state/scene';
import { parseWalledAscii, scanMarkers } from '../../state/asciiMap';
import { buildEncounter } from '../../state/encounterAuthoring';
import type { Pt } from '../../state/path';
import { useGame } from '../../state/store';
import { buildAiInput } from '../../state/combatFlow';
import { chooseEnemyAction } from '../../state/ai';
import { seedBattleRng } from '../../state/battleRng';
import { isStructure } from '../../engine/structures';
import { couvertDepuisDifficulte } from '../../engine/cover';
import { findStructureById } from '../../data';
import { pregen, PREGEN } from '../../data/pregens';

/**
 * OPACITÉ DÉCLARÉE PAR STRUCTURE (#1680, #1709) — les contrats du MOTEUR, sur une carte CONSTRUITE
 * pour eux seuls : deux stalles séparées du couloir, l'une par une `cloture-en-clayonnage`
 * (`occulte: false`, AA 10 l.65), l'autre par un `mur-a-ossature-en-bois`. Aucune carte de campagne
 * n'entre ici — le scénario de recette homonyme reste le MENU humain, ce banc mesure le moteur.
 *
 * Ce que la carte pose, et dont les attentes DÉRIVENT :
 *  · une colonne de clayonnage devant l'archer, une devant le gobelin voisin, une colonne de mur à
 *    ossature devant le troisième — franchissement et vue s'y séparent ;
 *  · la dernière rangée est LIBRE de toute arête : les deux camps se rejoignent par le sud, sans quoi
 *    l'IA déciderait sans cible atteignable ;
 *  · chaque arête de structure intacte devient un combattant inerte (`combatSlice.ts:2843`) — le
 *    compte se relit sur les arêtes de la carte, jamais sur un chiffre.
 */

const CLAYONNAGE = 'cloture-en-clayonnage';
const OSSATURE = 'mur-a-ossature-en-bois';

/**
 * (2W+1)×(2H+1) — `c` = clayonnage, `M` = mur à ossature, sur les colonnes d'ARÊTES.
 * Les marqueurs sont lus PUIS effacés (`scanMarkers`) : `A` archer, `g` gobelin de la stalle voisine,
 * `G` gobelin derrière le mur, `H` les deux cases où `startCombat` pose le groupe, `S` le départ.
 */
const ROWS = [
  '             ',
  ' .c.c. .M. . ',
  '             ',
  ' AcgcH SMG . ',
  '             ',
  ' .c.cH .M. . ',
  '             ',
  ' .c.c. .M. . ',
  '             ',
  ' . . . . . . ',
  '             ',
];

const { positions, cleaned } = scanMarkers(ROWS, 'AgGHS');
/** Char → case : une carte box-drawing porte la case (x,y) au char (2x+1, 2y+1). */
const caseDe = (p: { x: number; y: number }): Pt => ({ x: (p.x - 1) / 2, y: (p.y - 1) / 2 });
const ARCHER = caseDe(positions.A[0]);
const GOBELIN_VOISIN = caseDe(positions.g[0]);
const GOBELIN_DERRIERE_MUR = caseDe(positions.G[0]);
const HEROS = positions.H.map(caseDe);
const DEPART = caseDe(positions.S[0]);

const ENC = 'enc-fixture-clayonnage';

/** La carte-fixture, neuve à chaque appel (le store pose des flags sur la scène qu'il charge). */
function carte(): Scene {
  const { w, h, tiles, walls } = parseWalledAscii(cleaned, 'plancher', {}, { wallLegend: { c: { structure: CLAYONNAGE }, M: { structure: OSSATURE } } });
  const enc = buildEncounter({
    id: ENC,
    victoryCondition: { type: 'surviveRounds', rounds: 3 },
    enemies: [
      { ref: 'gobelin', pos: GOBELIN_VOISIN, facing: 'E' },
      { ref: 'archer-gobelin', pos: ARCHER, facing: 'E', weapon: 'arc' },
      { ref: 'gobelin', pos: GOBELIN_DERRIERE_MUR, facing: 'O' },
    ],
  });
  return {
    ...emptyScene(w, h),
    id: 'fixture-clayonnage',
    layers: [{ z: 0, tiles }],
    walls,
    entities: [{ id: 'depart', kind: 'heroStart', pos: { ...DEPART } }, ...enc.entities],
    encounters: [enc.encounter],
  } as Scene;
}

const groupe = () => [pregen(PREGEN.chasseur), pregen(PREGEN.soldat)];

/** Ouvre le combat de la fixture sur une carte NEUVE et rend l'état de bataille. */
function ouvrirCombat() {
  seedBattleRng(1234);
  useGame.setState({ party: groupe() });
  useGame.getState().startScene(carte());
  useGame.getState().startCombat(ENC);
  useGame.getState().confirmRoundStart();
  return useGame.getState().battle!;
}
type Bataille = ReturnType<typeof ouvrirCombat>;
/** L'entrée d'IA du tour de `e` — le curseur de tour posé sur lui, comme le fait la boucle. */
function entreeDuTour(b: Bataille, e: Bataille['combatants'][number]) {
  useGame.setState({ battle: { ...useGame.getState().battle!, turn: b.order.indexOf(e.id), acted: false, action: null, movementUsed: 0 } });
  return buildAiInput(e, useGame.getState);
}
/** L'ennemi que la carte arme d'une arme à DISTANCE — nommé par son ARMEMENT, pas par son id. */
const tireurDe = (b: Bataille) => b.combatants.filter((c) => c.kind === 'enemy' && c.weapons.some((w) => w.type === 'ranged'));

describe('carte-fixture — deux stalles, une arête qui laisse voir, une qui ferme', () => {
  const sc = carte();

  it('la fixture pose les deux familles d’arêtes, et le groupe tombe bien sur les cases marquées', () => {
    expect(structureAt(sc, GOBELIN_VOISIN.x, GOBELIN_VOISIN.y, 'E', 0)?.structure).toBe(CLAYONNAGE);
    expect(structureAt(sc, ARCHER.x, ARCHER.y, 'E', 0)?.structure).toBe(CLAYONNAGE);
    expect(structureAt(sc, GOBELIN_DERRIERE_MUR.x - 1, GOBELIN_DERRIERE_MUR.y, 'E', 0)?.structure).toBe(OSSATURE);
    // Les cases `H` du plan sont celles où `startCombat` POSE réellement le groupe — relevées sur le
    // combat ouvert, jamais recopiées de la formule de pose.
    const poses = ouvrirCombat().combatants.filter((c) => c.kind === 'hero').map((c) => ({ x: c.pos!.x, y: c.pos!.y }));
    expect(poses).toEqual(HEROS);
  });

  it('(c) le tir par-dessus la séparation de box PART — l’arête est du clayonnage, infranchissable et non occultante', () => {
    expect(wallBetween(sc, GOBELIN_VOISIN.x, GOBELIN_VOISIN.y, HEROS[0].x, HEROS[0].y)).toBe(true); // on ne PASSE pas
    expect(areteOcculteEntre(sc, GOBELIN_VOISIN.x, GOBELIN_VOISIN.y, HEROS[0].x, HEROS[0].y)).toBe(false); // on VOIT
    for (const h of HEROS) expect(lineOfSightCover(sc, h, GOBELIN_VOISIN, []).blocked).toBe(false);
  });

  it('(d) le tireur posté derrière une AUTRE cloison de box voit le groupe (et réciproquement)', () => {
    for (const h of HEROS) {
      expect(lineOfSightCover(sc, ARCHER, h, []).blocked).toBe(false);
      expect(lineOfSightCover(sc, h, ARCHER, []).blocked).toBe(false);
    }
  });

  it('le couvert rendu est CELUI que la structure déclare — jamais une valeur écrite ici', () => {
    const attendu = couvertDepuisDifficulte(findStructureById(CLAYONNAGE)!.couvertPenalty!);
    const abrites = HEROS.map((h) => lineOfSightCover(sc, h, GOBELIN_VOISIN, []).cover);
    expect(new Set(abrites).size, 'les deux héros voient la même cible à travers la même arête').toBe(1);
    expect(abrites[0]).toBe(attendu);
  });

  it('contre-épreuve : à distance comparable, le mur à ossature en bois REFUSE la Ligne de Vue', () => {
    for (const h of HEROS) expect(lineOfSightCover(sc, h, GOBELIN_DERRIERE_MUR, []).blocked).toBe(true);
  });
});

/**
 * HORS SIÈGE — la rencontre de la fixture ne déclare PAS `siege` : ses arêtes structurées existent
 * bel et bien en combattants, mais aucune n'entre dans le choix de cible de l'IA. Contrat POSITIF :
 * chacun des trois adversaires vise un PERSONNAGE, et celui que la carte arme d'un arc TIRE.
 */
describe('IA hors siège — aucune décision ne porte sur une structure', () => {
  /** Ouvre le combat de la fixture et rend le tour d'IA de chaque ennemi, dans l'ordre du roster. */
  const decisionsDesEnnemis = () => {
    const b = ouvrirCombat();
    return b.combatants.filter((c) => c.kind === 'enemy').map((e) => {
      const input = entreeDuTour(b, e);
      const action = chooseEnemyAction(input) as { kind: string; targetId?: string; thenTargetId?: string };
      const cible = b.combatants.find((c) => c.id === (action.targetId ?? action.thenTargetId));
      return { ennemi: e, input, action, cible };
    });
  };

  it('la rencontre ne déclare AUCUN siège : les structures ne sont pas offertes à l’IA', () => {
    const sc = carte();
    const enc = sc.encounters.find((e) => e.id === ENC)!;
    expect(enc.siege).toBeUndefined();
    const posees = (sc.walls ?? []).filter((w) => !!w.structure).length;
    expect(posees, 'la fixture pose bien des structures — sans elles la garde ne mesure rien').toBeGreaterThan(0);
    const lignes = decisionsDesEnnemis();
    expect(lignes.length).toBe(enc.members!.length);
    expect(useGame.getState().battle!.combatants.filter(isStructure).length).toBe(posees);
    for (const { ennemi, input, cible } of lignes) {
      expect(input.structures ?? [], `${ennemi.label} reçoit des structures en entrée`).toEqual([]);
      expect(cible, `${ennemi.label} décide sans cible`).toBeTruthy();
      expect(isStructure(cible!), `${ennemi.label} vise ${cible!.label}`).toBe(false);
    }
  });

  it('l’ennemi armé d’une arme à DISTANCE TIRE sur un personnage — décision nommée, pas « une structure quelconque »', () => {
    const tireurs = decisionsDesEnnemis().filter((l) => l.ennemi.weapons.some((w) => w.type === 'ranged'));
    expect(tireurs.length, 'la fixture arme bien un tireur').toBe(1);
    expect(tireurs[0].action.kind).toBe('shoot');
    expect(tireurs[0].cible!.kind).toBe('hero');
  });
});

/**
 * Le MÉMO de Ligne de Vue du tour d'IA (`makeLosMemo`, `lineOfSight.ts:265`) est PORTEUR, et la
 * DÉCISION le lit. Trois contrats POSITIFS : (a) `buildAiInput` pose le mémo et la décision qu'il
 * sert est celle du calcul direct ; (b) la décision CONSULTE bien ce mémo — un mémo AVEUGLE (tout
 * bloqué) change l'action du tireur ; (c) la clé couple `from` ET `to`, parce que le verdict dépend
 * du poste autant que de la cible : sur deux postes que la carte oppose vers la MÊME cible, le mémo
 * réel rend deux verdicts quand un mémo dont la clé OUBLIE `from` ressert le premier aux deux.
 */
describe('IA — le mémo de Ligne de Vue du tour est PORTEUR (clé from→to)', () => {
  /** Le mémo FAUTIF : même corps que `makeLosMemo`, clé AMPUTÉE de `from`. */
  const memoAmnesique = (sc: Scene, smoke: Pt[]): LosMemo => {
    const cache = new Map<string, ReturnType<typeof lineOfSightCover>>();
    const cover = (from: Pt, to: Pt) => {
      const k = `${to.x},${to.y},${to.z ?? 0}`; // OUBLIE `from`
      let v = cache.get(k);
      if (v === undefined) { v = lineOfSightCover(sc, from, to, [], smoke); cache.set(k, v); }
      return v;
    };
    return { cover, clear: (f, t) => !cover(f, t).blocked };
  };

  it('(a) `buildAiInput` pose le mémo du tour, et chaque décision servie par lui est celle du calcul direct', () => {
    const b = ouvrirCombat();
    const ennemis = b.combatants.filter((c) => c.kind === 'enemy');
    expect(ennemis.length).toBeGreaterThan(0);
    for (const e of ennemis) {
      const input = entreeDuTour(b, e);
      expect(input.losMemo, `${e.label} : aucun mémo de tour`).toBeTruthy();
      expect(chooseEnemyAction(input), `${e.label}`).toEqual(chooseEnemyAction({ ...input, losMemo: undefined }));
    }
  });

  it('(b) la DÉCISION lit le mémo : un mémo AVEUGLE (tout bloqué) retire son tir au tireur', () => {
    const b = ouvrirCombat();
    const tireurs = tireurDe(b);
    expect(tireurs.length, 'la fixture arme bien un tireur').toBe(1);
    const input = entreeDuTour(b, tireurs[0]);
    expect(chooseEnemyAction(input).kind, 'mémo réel : il voit et il tire').toBe('shoot');
    /** Le mémo AVEUGLE : il répond « rien n'est visible » sans jamais consulter la carte. */
    const aveugle: LosMemo = { cover: () => ({ blocked: true, cover: 'totale' }), clear: () => false };
    expect(chooseEnemyAction({ ...input, losMemo: aveugle }).kind, 'mémo aveugle : plus de Ligne de Vue, plus de tir').not.toBe('shoot');
  });

  it('(c) deux postes OPPOSÉS vers la même cible : le mémo réel les distingue, la clé amputée ressert le premier', () => {
    const sc = carte();
    const cible = GOBELIN_DERRIERE_MUR;
    const derriereLeMur = HEROS[0]; // le couloir : le mur à ossature ferme la vue
    const parLeSud = { x: cible.x, y: sc.dimensions.h - 1 }; // la rangée libre : rien ne la ferme
    // TÉMOINS — la carte oppose bien les deux postes (sans quoi la garde ne mesurerait rien).
    expect(lineOfSightCover(sc, derriereLeMur, cible, []).blocked, 'poste du couloir').toBe(true);
    expect(lineOfSightCover(sc, parLeSud, cible, []).blocked, 'poste de la rangée libre').toBe(false);

    const reel = makeLosMemo(sc, []);
    expect([reel.clear(derriereLeMur, cible), reel.clear(parLeSud, cible)]).toEqual([false, true]);
    const amnesique = memoAmnesique(sc, []);
    expect(
      [amnesique.clear(derriereLeMur, cible), amnesique.clear(parLeSud, cible)],
      'clé sans `from` : le second poste hérite du verdict du premier',
    ).toEqual([false, false]);
  });
});

/**
 * Le SCÉNARIO de recette, lui, ne se mesure que sur ce qu'il promet au menu : il arme son tireur, et
 * il travaille sur une COPIE de la carte de campagne (`structuredClone`) — aucune de ses retouches
 * ne remonte dans la scène partagée. Aucune case, aucun id de cette carte n'est nommé ici.
 */
describe('scénario de recette « écuries » — armement du tireur et non-contamination', () => {
  it('arme le tireur du groupe d’une arme à DISTANCE (l’arc en main, pas la fronde rangée)', () => {
    const tireur = scenario.makeParty()[0];
    expect(tireur.weapons.some((w) => w.type === 'ranged')).toBe(true);
  });

  it('pose son groupe et ses ennemis SANS toucher la scène de campagne partagée', () => {
    const depart = (s: Scene) => s.entities.find((e) => e.kind === 'heroStart')!.pos;
    expect(scenario.scene).not.toBe(diligence.scene);
    expect(depart(scenario.scene)).not.toEqual(depart(diligence.scene));
    const posees = scenario.scene.encounters.map((e) => e.id);
    expect(posees.length).toBeGreaterThan(0);
    expect(diligence.scene.encounters.filter((e) => posees.includes(e.id))).toEqual([]);
  });
});
