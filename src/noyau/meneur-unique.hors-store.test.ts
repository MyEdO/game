/**
 * LE MENEUR A UNE SEULE DÉFINITION (#1362, lot L1a).
 * Question tenue ici : héros 1 à 0 Blessure, héros 2 debout — qui pivote
 * à Q/E, qui le regard de première personne suit, qui s'assoit, qui porte la lampe, qui grimpe, qui
 * le plateau anime, à qui appartient le cap d'entrée de scène ? UN SEUL id, celui de `meneurDuMonde`
 * (`src/noyau/monde/combatants.ts`). Les REPLIS de l'élection vivent en `combatants.test.ts`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene, type WallClimb } from './monde/scene';
import { seatPoseOf, type SeatOccupant } from './monde/seating';
import { CAP_GROUPE, capDuGroupe, meneurDuMonde, poserCapDuGroupe } from './monde/combatants';
import { sceneLightSources } from './visionState';
import { bus, EVT } from './bus';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { poserLeGroupe } from './marcheDuGroupe';
import { combattantDeTest, blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { engage } from './creation/engagement.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abord nord déclaré en (5,4). */
const ABORD_NORD = { x: 5, y: 4 };
const MENEUR: SeatOccupant = { kind: 'groupe', rang: 1 };

const hero = (id: string, wounds: number, talents: { talentId: string; times: number }[] = []): Combatant =>
  combattantDeTest({
    id,
    label: id.toUpperCase(),
    kind: 'heros',
    species: 'humains-reiklander',
    xp: 0,
    wounds: blessuresDeBase(12, wounds),
    conditions: [],
    movement: 4,
    talents,
  });

/** A = premier du roster, À TERRE (0 Blessure) ; B = le suivant, DEBOUT. Le meneur, c'est B. */
const A_A_TERRE = () => hero('a', 0);
const B_DEBOUT = (talents?: { talentId: string; times: number }[]) => hero('b', 12, talents);
/** INCONSCIENT à 8 Blessures : en jeu, mais ni meneur ni grimpeur. */
const A_INCONSCIENT = (talents?: { talentId: string; times: number }[]) =>
  ({ ...hero('a', 8, talents), conditions: [{ id: 'inconscient', value: 1 }] }) as unknown as Combatant;

function scèneDeTaverne(): Scene {
  const s = emptyScene('scene-test', 12, 12);
  s.id = 'taverne';
  s.entities = [
    { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, facing: 'N', usable: { assise: true } },
  ];
  return s;
}

/** Falaise de 4 m entre le pied (2,1) et le sommet (2,0) ; l'arête N de (2,1) porte la grimpe. */
function scèneDeFalaise(climb: WallClimb): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const h = new Array(4 * 4).fill(0) as number[];
  h[0 * 4 + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}

function poser(party: Combatant[], sc: Scene, pos?: { x: number; y: number }) {
  banc.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  banc.getState().lancerLaScene(sc);
  if (pos) banc.setState({ partyPos: { ...pos } });
}

describe('un seul meneur — le premier du roster est à terre, c’est le suivant qui mène', () => {
  beforeEach(() => poser([A_A_TERRE(), B_DEBOUT()], scèneDeTaverne(), ABORD_NORD));

  it("CAP D'ENTRÉE de scène : UNE entrée, sous la clé de GROUPE — aucun id de héros", () => {
    const facing = banc.getState().facing;
    expect(Object.keys(facing)).toEqual([CAP_GROUPE]);
    expect(capDuGroupe(banc.getState())).toBe(facing[CAP_GROUPE]);
  });

  it('PIVOT (Q/E) : `pivoterLeGroupe` tourne le cap du GROUPE, et rien d’autre', () => {
    banc.setState({ facing: poserCapDuGroupe({}, 'N') });
    banc.getState().pivoterLeGroupe(1);
    expect(capDuGroupe(banc.getState())).toBe('NE');
    expect(Object.keys(banc.getState().facing)).toEqual([CAP_GROUPE]);
  });

  it('PAS relatif (POV) : le regard restauré est celui du groupe, la marche ANIMÉE celle du meneur debout', () => {
    banc.setState({ facing: poserCapDuGroupe({}, 'E'), partyPos: { x: 5, y: 5 } });
    const anims: string[] = [];
    const ecoute = (p: { id: string }) => anims.push(p.id);
    bus.on(EVT.ANIM_MOVE, ecoute as never);
    banc.getState().avancerDUnPas('gauche');
    bus.off(EVT.ANIM_MOVE, ecoute as never);
    expect(anims).toEqual(['b']);
    expect(capDuGroupe(banc.getState())).toBe('E'); // pas latéral : cap PRÉSERVÉ
  });

  it('MARCHE : `deplacerLeGroupe` oriente le cap du groupe le long du pas', () => {
    banc.setState({ facing: {}, partyPos: { x: 5, y: 5 } });
    poserLeGroupe(banc.getState, banc.setState, { x: 6, y: 5 });
    expect(capDuGroupe(banc.getState())).toBe('E');
  });

  it('DELTA NUL : un pas vers la MÊME case x/y ne touche pas au cap (pas de claquement au sud)', () => {
    // Case LIBRE (la table occupe (5,5)) : le pas doit être SERVI, pas refusé — sans quoi le test
    // serait vert pour la mauvaise raison.
    banc.setState({ facing: poserCapDuGroupe({}, 'N'), partyPos: { x: 2, y: 2 } });
    poserLeGroupe(banc.getState, banc.setState, { x: 2, y: 2 });
    expect(banc.getState().partyPos).toMatchObject({ x: 2, y: 2 });
    expect(capDuGroupe(banc.getState())).toBe('N');
  });

  it("ASSISE : c'est le meneur debout qui prend place, et le cap du groupe suit la place", () => {
    banc.getState().interagirAvecLEntite(PROP);
    const pose = seatPoseOf(banc.getState().scene!, MENEUR);
    expect(pose).toMatchObject({ propId: PROP });
    expect(capDuGroupe(banc.getState())).toBe(pose!.facing);
  });

  it('JETON et LAMPE : la lampe du groupe est PORTÉE par le meneur debout, même émise par le héros au sol', () => {
    const s = banc.getState();
    expect(meneurDuMonde(s)?.id).toBe('b');
    const aLumineux = { ...s.party[0], activeEffects: [{ light: { radiusM: 6 } }] } as unknown as Combatant;
    const sources = sceneLightSources({ scene: s.scene, battle: null, party: [aLumineux, s.party[1]], partyPos: s.partyPos });
    const portees = sources.filter((src) => src.carried);
    expect(portees).toHaveLength(1);
    expect(portees[0].srcId).toBe('b');
  });
});
describe('changer de meneur par la composition du groupe ne change QUE le meneur — le cap est celui du groupe', () => {
  /** Le groupe entre, puis pivote deux fois : le regard quitte le cap d'entrée. */
  function entrerPuisPivoter() {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    banc.getState().pivoterLeGroupe(1);
    banc.getState().pivoterLeGroupe(1);
    return capDuGroupe(banc.getState());
  }

  it('REMPLACEMENT du meneur par un héros d’id NEUF (`remplacerLeHeros`) : cap intact', () => {
    const capAvant = entrerPuisPivoter();
    banc.getState().remplacerLeHeros('a', engage('a2'));
    expect(meneurDuMonde(banc.getState())?.id).toBe('a2');
    expect(capDuGroupe(banc.getState())).toBe(capAvant);
  });

  it('AJOUT d’un héros (`recruterLeHeros`) qui devient meneur : cap intact', () => {
    const capAvant = entrerPuisPivoter();
    banc.getState().recruterLeHeros(engage('c'));
    banc.setState({ party: banc.getState().party.map((h) => (h.id === 'c' ? h : blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }))) });
    expect(meneurDuMonde(banc.getState())?.id).toBe('c');
    expect(capDuGroupe(banc.getState())).toBe(capAvant);
  });
});

describe('le cap du GROUPE traverse le combat', () => {
  it('OUVERTURE : les héros reçoivent leur cap INDIVIDUEL, le cap du groupe reste intact', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    banc.getState().pivoterLeGroupe(1);
    const capAvant = capDuGroupe(banc.getState());
    const heros = banc.getState().party.map((h, i) => ({ ...h, pos: { x: 1 + i, y: 1 } }));
    const orc = combattantDeTest({ id: 'orc', label: 'Orc', kind: 'ennemi', wounds: blessuresDeBase(8), conditions: [], pos: { x: 5, y: 1 } });
    banc.setState({ battle: { combatants: [...heros, orc] } as never });
    banc.getState().orienterLesCombattants();

    const f = banc.getState().facing;
    expect(f.a, 'un héros POSÉ face à un adversaire reçoit son cap individuel').toBe('E');
    expect(f.b).toBe('E');
    expect(capDuGroupe(banc.getState()), 'la clé de groupe n’est pas un combattant : le combat n’y touche pas').toBe(capAvant);
  });

  it('OUVERTURE : un héros SANS adversaire posé n’hérite d’aucun cap — il retombe au défaut sud, comme ses pairs', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    banc.getState().pivoterLeGroupe(1); // cap de groupe ≠ 'S'
    const heros = banc.getState().party.map((h, i) => ({ ...h, pos: { x: 1 + i, y: 1 } }));
    banc.setState({ battle: { combatants: heros } as never }); // aucun adversaire POSÉ
    banc.getState().orienterLesCombattants();

    const f = banc.getState().facing;
    expect(Object.keys(f), 'aucun cap individuel écrit : le combat n’a personne à viser').toEqual([CAP_GROUPE]);
    // Le cap d'exploration appartient au groupe, aucun combattant n'en hérite.
    expect(f.a ?? 'S').toBe('S');
    expect(f.b ?? 'S').toBe('S');
  });

  it('SORTIE : le cap retrouvé est celui d’AVANT le combat', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    banc.getState().pivoterLeGroupe(1);
    const capAvant = capDuGroupe(banc.getState());
    banc.setState({ battle: { combatants: banc.getState().party.map((h, i) => ({ ...h, pos: { x: 1 + i, y: 1 } })) } as never });
    banc.getState().orienterLesCombattants();
    banc.setState({ battle: null, mode: 'exploration' });
    expect(capDuGroupe(banc.getState())).toBe(capAvant);
  });
});

describe('un seul meneur — le Grimpeur lu est celui du meneur debout', () => {
  const PIED = { x: 2, y: 1 };
  const SOMMET = { x: 2, y: 0 };

  it('Talent porté par le héros AU SOL (premier du roster) : la paroi se refuse', () => {
    poser([hero('a', 0, [{ talentId: 'grimpeur', times: 1 }]), B_DEBOUT()], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    banc.getState().franchirLArete(SOMMET);
    expect(banc.getState().partyPos).toMatchObject(PIED);
  });

  it('Talent porté par le meneur DEBOUT : la paroi s’ouvre (montée optimiste au sommet)', () => {
    // Héros COMPLETS : la paroi ouverte déclenche le Test d'Escalade, qui lit des Compétences réelles.
    const a = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    a.wounds.current = 0;
    b.talents = [...(b.talents ?? []), { talentId: 'grimpeur', times: 1 }];
    poser([a, b], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    banc.getState().franchirLArete(SOMMET);
    expect(banc.getState().partyPos).toMatchObject(SOMMET);
  });

  it('meneur INCONSCIENT (8 Blessures) porteur du Talent : la paroi se refuse — il ne grimpe pas', () => {
    poser([A_INCONSCIENT([{ talentId: 'grimpeur', times: 1 }]), B_DEBOUT()], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    banc.getState().franchirLArete(SOMMET);
    expect(banc.getState().partyPos).toMatchObject(PIED);
  });

  it('GROUPE ENTIER à terre : la paroi se refuse — aucun meneur n’est fabriqué pour grimper', () => {
    poser([hero('a', 0, [{ talentId: 'grimpeur', times: 1 }]), hero('b', 0, [{ talentId: 'grimpeur', times: 1 }])], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    banc.getState().franchirLArete(SOMMET);
    expect(banc.getState().partyPos).toMatchObject(PIED);
  });
});
