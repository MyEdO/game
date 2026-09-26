/**
 * LE MENEUR A UNE SEULE DÉFINITION (#1362, lot L1a).
 * Question tenue ici : héros 1 à 0 Blessure, héros 2 debout — qui pivote
 * à Q/E, qui le regard de première personne suit, qui s'assoit, qui porte la lampe, qui grimpe, qui
 * le plateau anime, à qui appartient le cap d'entrée de scène ? UN SEUL id, celui de `meneurDuMonde`
 * (`src/state/combatants.ts`). Les REPLIS de l'élection vivent en `combatants.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene, type WallClimb } from './scene';
import { rotateDir8 } from './dir8';
import { seatPoseOf, type SeatOccupant } from './seating';
import { CAP_GROUPE, capDuGroupe, meneurDuMonde, poserCapDuGroupe } from './combatants';
import { sceneLightSources } from './visionState';
import { partyTokenOf } from '../gameIso/builders/tokens';
import { tokenChromes } from '../gameIso/builders/tokenChrome';
import { actorPoseKey, partyActorPose } from '../gameIso/backends/webgl/sceneMeshes';
import { bus, EVT } from './bus';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abord nord déclaré en (5,4). */
const ABORD_NORD = { x: 5, y: 4 };
const MENEUR: SeatOccupant = { kind: 'party', rang: 1 };

const hero = (id: string, wounds: number, talents: { talentId: string; times: number }[] = []): Combatant =>
  ({
    id,
    label: id.toUpperCase(),
    kind: 'hero',
    xp: 0,
    wounds: { current: wounds, max: 12 },
    conditions: [],
    movement: 4,
    talents,
  }) as unknown as Combatant;

/** A = premier du roster, À TERRE (0 Blessure) ; B = le suivant, DEBOUT. Le meneur, c'est B. */
const A_A_TERRE = () => hero('a', 0);
const B_DEBOUT = (talents?: { talentId: string; times: number }[]) => hero('b', 12, talents);
/** INCONSCIENT à 8 Blessures : en jeu, mais ni meneur ni grimpeur. */
const A_INCONSCIENT = (talents?: { talentId: string; times: number }[]) =>
  ({ ...hero('a', 8, talents), conditions: [{ id: 'inconscient', value: 1 }] }) as unknown as Combatant;

/** Le cap que le regard de première personne rend — même lecture que `MondeDeCampagne` (`capPov`). */
const capPov = () => { const s = useGame.getState(); return s.povActive ? capDuGroupe(s) : null; };

function scèneDeTaverne(): Scene {
  const s = emptyScene(12, 12);
  s.id = 'taverne';
  s.entities = [
    { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N', usable: { assise: true } },
  ];
  return s;
}

/** Falaise de 4 m entre le pied (2,1) et le sommet (2,0) ; l'arête N de (2,1) porte la grimpe. */
function scèneDeFalaise(climb: WallClimb): Scene {
  const s = emptyScene(4, 4);
  const h = new Array(4 * 4).fill(0) as number[];
  h[0 * 4 + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}

function poser(party: Combatant[], sc: Scene, pos?: { x: number; y: number }) {
  useGame.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  useGame.getState().startScene(sc);
  if (pos) useGame.setState({ partyPos: { ...pos } });
}

describe('un seul meneur — le premier du roster est à terre, c’est le suivant qui mène', () => {
  beforeEach(() => poser([A_A_TERRE(), B_DEBOUT()], scèneDeTaverne(), ABORD_NORD));

  it("CAP D'ENTRÉE de scène : UNE entrée, sous la clé de GROUPE — aucun id de héros", () => {
    const facing = useGame.getState().facing;
    expect(Object.keys(facing)).toEqual([CAP_GROUPE]);
    expect(capDuGroupe(useGame.getState())).toBe(facing[CAP_GROUPE]);
  });

  it('PIVOT (Q/E) : `pivotParty` tourne le cap du GROUPE, et rien d’autre', () => {
    useGame.setState({ facing: poserCapDuGroupe({}, 'N') });
    useGame.getState().pivotParty(1);
    expect(capDuGroupe(useGame.getState())).toBe('NE');
    expect(Object.keys(useGame.getState().facing)).toEqual([CAP_GROUPE]);
  });

  it('PAS relatif (POV) : le regard restauré est celui du groupe, la marche ANIMÉE celle du meneur debout', () => {
    useGame.setState({ facing: poserCapDuGroupe({}, 'E'), partyPos: { x: 5, y: 5 } });
    const anims: string[] = [];
    const ecoute = (p: { id: string }) => anims.push(p.id);
    bus.on(EVT.ANIM_MOVE, ecoute as never);
    useGame.getState().stepPartyRelative('left');
    bus.off(EVT.ANIM_MOVE, ecoute as never);
    expect(anims).toEqual(['b']);
    expect(capDuGroupe(useGame.getState())).toBe('E'); // pas latéral : cap PRÉSERVÉ
  });

  it('MARCHE : `moveParty` oriente le cap du groupe le long du pas', () => {
    useGame.setState({ facing: {}, partyPos: { x: 5, y: 5 } });
    useGame.getState().moveParty({ x: 6, y: 5 });
    expect(capDuGroupe(useGame.getState())).toBe('E');
  });

  it('DELTA NUL : un pas vers la MÊME case x/y ne touche pas au cap (pas de claquement au sud)', () => {
    // Case LIBRE (la table occupe (5,5)) : le pas doit être SERVI, pas refusé — sans quoi le test
    // serait vert pour la mauvaise raison.
    useGame.setState({ facing: poserCapDuGroupe({}, 'N'), partyPos: { x: 2, y: 2 } });
    useGame.getState().moveParty({ x: 2, y: 2 });
    expect(useGame.getState().partyPos).toMatchObject({ x: 2, y: 2 });
    expect(capDuGroupe(useGame.getState())).toBe('N');
  });

  it("ASSISE : c'est le meneur debout qui prend place, et le cap du groupe suit la place", () => {
    useGame.getState().interactEntity(PROP);
    const pose = seatPoseOf(useGame.getState().scene!, MENEUR);
    expect(pose).toMatchObject({ propId: PROP });
    expect(capDuGroupe(useGame.getState())).toBe(pose!.facing);
  });

  it('JETON et LAMPE : la lampe du groupe est PORTÉE par le meneur debout, même émise par le héros au sol', () => {
    const s = useGame.getState();
    expect(meneurDuMonde(s)?.id).toBe('b');
    const aLumineux = { ...s.party[0], activeEffects: [{ light: { radiusM: 6 } }] } as unknown as Combatant;
    const sources = sceneLightSources({ scene: s.scene, battle: null, party: [aLumineux, s.party[1]], partyPos: s.partyPos });
    const portees = sources.filter((src) => src.carried);
    expect(portees).toHaveLength(1);
    expect(portees[0].srcId).toBe('b');
  });
});

describe('changer de meneur ne change QUE le meneur — le cap n’est keyé par aucun héros', () => {
  const povInitial = useGame.getState().povActive;
  afterEach(() => useGame.setState({ povActive: povInitial })); // magasin PARTAGÉ : remis à sa valeur

  /** Le groupe entre, pivote deux fois (regard hors du cap d'entrée), PUIS le roster mute. */
  function entrerPuisPivoter() {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.setState({ povActive: true });
    useGame.getState().pivotParty(1);
    useGame.getState().pivotParty(1);
  }

  it('le premier du roster tombe à 0 Blessure : le cap et le POV ne BOUGENT pas', () => {
    entrerPuisPivoter();
    expect(meneurDuMonde(useGame.getState())?.id).toBe('a');
    const capAvant = capPov();
    expect(capAvant).not.toBeNull();

    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? { ...h, wounds: { ...h.wounds, current: 0 } } : h)) }));

    expect(meneurDuMonde(useGame.getState())?.id, 'le meneur a bien changé').toBe('b');
    expect(capPov(), 'le regard ne saute pas au sud par défaut').toBe(capAvant);
  });

  it('le premier du roster devient INCONSCIENT : même continuité', () => {
    entrerPuisPivoter();
    const capAvant = capPov();
    useGame.setState((s) => ({
      party: s.party.map((h) => (h.id === 'a' ? ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] } as unknown as Combatant) : h)),
    }));
    expect(meneurDuMonde(useGame.getState())?.id).toBe('b');
    expect(capPov()).toBe(capAvant);
  });

  it('REMPLACEMENT du meneur par un héros d’id NEUF (`partyReplaceHero`) : cap intact', () => {
    entrerPuisPivoter();
    const capAvant = capPov();
    useGame.getState().partyReplaceHero('a', hero('a2', 12));
    expect(meneurDuMonde(useGame.getState())?.id).toBe('a2');
    expect(capPov(), 'aucun id de héros ne keye le cap : le remplacement ne le perd pas').toBe(capAvant);
  });

  it('AJOUT d’un héros (`partyAddHero`) puis chute des précédents : cap intact', () => {
    entrerPuisPivoter();
    const capAvant = capPov();
    useGame.getState().partyAddHero(hero('c', 12));
    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'c' ? h : { ...h, wounds: { ...h.wounds, current: 0 } })) }));
    expect(meneurDuMonde(useGame.getState())?.id).toBe('c');
    expect(capPov()).toBe(capAvant);
  });

  it('le pivot SUIVANT repart du cap courant, pas du défaut sud', () => {
    entrerPuisPivoter();
    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? { ...h, wounds: { ...h.wounds, current: 0 } } : h)) }));
    const capAvant = capPov()!;
    useGame.getState().pivotParty(1);
    expect(capPov()).toBe(rotateDir8(capAvant, 1));
  });
});

/**
 * CÂBLAGE DU RENDU — les deux SEULS lecteurs qui dessinent le jeton de groupe : le quad du monde
 * volumique (`partyActorPose` → `ActorPose.facing`, servi par `VolumetricWorld`) et le disque de la vue
 * du dessus (la marque de `tokenChromes`, dont `TokenDisc` lit la `capKey`). Mesuré sur la CHAÎNE que
 * l'écran monte : gestes RÉELS du store → `partyTokenOf` → les deux consommateurs.
 */
describe('le RENDU du jeton de groupe lit la clé de cap PUBLIÉE, pas l’id du meneur', () => {
  /** La chaîne de l'écran, depuis l'état courant. */
  const rendu = () => {
    const s = useGame.getState();
    const jeton = partyTokenOf(s.scene!, meneurDuMonde(s), s.partyPos)!;
    const marques = tokenChromes([], { ghostIds: new Set<string>(), hoveredId: null }, jeton);
    const marque = marques[marques.length - 1];
    return { jeton, pose: partyActorPose(jeton, s.facing), marque, capLuParLeDisque: s.facing[marque.capKey] };
  };

  it('PIVOTS : le quad et le disque servent le cap du GROUPE', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivotParty(1);
    useGame.getState().pivotParty(1);
    const cap = capDuGroupe(useGame.getState());
    const { pose, marque, capLuParLeDisque } = rendu();
    expect(pose.facing, 'ActorPose.facing du quad').toBe(cap);
    expect(marque.capKey, 'la marque du disque s’abonne à la clé de GROUPE').toBe(CAP_GROUPE);
    expect(capLuParLeDisque).toBe(cap);
    expect(marque.id, 'l’IDENTITÉ du jeton reste celle du meneur : bus, chrome et caméra la suivent').toBe('a');
  });

  it('MARCHE : le pas oriente ce que le quad dessine', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), { x: 2, y: 2 });
    useGame.getState().moveParty({ x: 3, y: 2 });
    expect(rendu().pose.facing, 'un pas vers l’est').toBe('E');
    expect(rendu().capLuParLeDisque).toBe('E');
  });

  it('ASSISE : le cap de la PLACE prime sur celui de la marche (`capActeur`)', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().interactEntity(PROP);
    const place = seatPoseOf(useGame.getState().scene!, MENEUR)!;
    const { pose } = rendu();
    expect(pose.seat?.facing, 'la place voyage avec la pose').toBe(place.facing);
    expect(actorPoseKey(pose), 'la clé de mémo porte le cap SERVI : celui de la place').toContain(`:${place.facing}:`);
  });

  it('CHANGEMENT DE MENEUR : l’identité du corps change, le regard NON', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivotParty(1);
    const avant = rendu();
    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? { ...h, wounds: { ...h.wounds, current: 0 } } : h)) }));
    const apres = rendu();
    expect(apres.marque.id, 'le corps dessiné est le nouveau meneur').toBe('b');
    expect(apres.pose.c.id).toBe('b');
    expect(apres.pose.facing, 'le quad ne saute pas au sud').toBe(avant.pose.facing);
    expect(apres.capLuParLeDisque).toBe(avant.capLuParLeDisque);
    expect(apres.marque.capKey).toBe(CAP_GROUPE);
  });
});

describe('le cap du GROUPE traverse le combat', () => {
  it('OUVERTURE : les héros reçoivent leur cap INDIVIDUEL, le cap du groupe reste intact', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivotParty(1);
    const capAvant = capDuGroupe(useGame.getState());
    const heros = useGame.getState().party.map((h, i) => ({ ...h, pos: { x: 1 + i, y: 1 } }));
    const orc = { id: 'orc', label: 'Orc', kind: 'enemy', wounds: { current: 8, max: 8 }, conditions: [], pos: { x: 5, y: 1 } } as unknown as Combatant;
    useGame.setState({ battle: { combatants: [...heros, orc] } as never });
    useGame.getState().faceAtCombatStart();

    const f = useGame.getState().facing;
    expect(f.a, 'un héros POSÉ face à un adversaire reçoit son cap individuel').toBe('E');
    expect(f.b).toBe('E');
    expect(capDuGroupe(useGame.getState()), 'la clé de groupe n’est pas un combattant : le combat n’y touche pas').toBe(capAvant);
  });

  it('OUVERTURE : un héros SANS adversaire posé n’hérite d’aucun cap — il retombe au défaut sud, comme ses pairs', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivotParty(1); // cap de groupe ≠ 'S'
    const heros = useGame.getState().party.map((h, i) => ({ ...h, pos: { x: 1 + i, y: 1 } }));
    useGame.setState({ battle: { combatants: heros } as never }); // aucun adversaire POSÉ
    useGame.getState().faceAtCombatStart();

    const f = useGame.getState().facing;
    expect(Object.keys(f), 'aucun cap individuel écrit : le combat n’a personne à viser').toEqual([CAP_GROUPE]);
    // `capActeur` (`gameIso/backends/webgl/sceneMeshes`) sert alors 'S' à CHAQUE héros : le cap
    // d'exploration appartient au groupe, aucun combattant n'en hérite.
    expect(f.a ?? 'S').toBe('S');
    expect(f.b ?? 'S').toBe('S');
  });

  it('SORTIE : le cap retrouvé est celui d’AVANT le combat', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivotParty(1);
    const capAvant = capDuGroupe(useGame.getState());
    useGame.setState({ battle: { combatants: useGame.getState().party.map((h, i) => ({ ...h, pos: { x: 1 + i, y: 1 } })) } as never });
    useGame.getState().faceAtCombatStart();
    useGame.setState({ battle: null, mode: 'exploration' });
    expect(capDuGroupe(useGame.getState())).toBe(capAvant);
  });
});

describe('un seul meneur — le Grimpeur lu est celui du meneur debout', () => {
  const PIED = { x: 2, y: 1 };
  const SOMMET = { x: 2, y: 0 };

  it('Talent porté par le héros AU SOL (premier du roster) : la paroi se refuse', () => {
    poser([hero('a', 0, [{ talentId: 'grimpeur', times: 1 }]), B_DEBOUT()], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    useGame.getState().climbAcross(PIED, SOMMET);
    expect(useGame.getState().partyPos).toMatchObject(PIED);
  });

  it('Talent porté par le meneur DEBOUT : la paroi s’ouvre (montée optimiste au sommet)', () => {
    // Héros COMPLETS : la paroi ouverte déclenche le Test d'Escalade, qui lit des Compétences réelles.
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', rng: makeRNG(2) });
    a.wounds.current = 0;
    b.talents = [...(b.talents ?? []), { talentId: 'grimpeur', times: 1 }];
    poser([a, b], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    useGame.getState().climbAcross(PIED, SOMMET);
    expect(useGame.getState().partyPos).toMatchObject(SOMMET);
  });

  it('meneur INCONSCIENT (8 Blessures) porteur du Talent : la paroi se refuse — il ne grimpe pas', () => {
    poser([A_INCONSCIENT([{ talentId: 'grimpeur', times: 1 }]), B_DEBOUT()], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    useGame.getState().climbAcross(PIED, SOMMET);
    expect(useGame.getState().partyPos).toMatchObject(PIED);
  });

  it('GROUPE ENTIER à terre : la paroi se refuse — aucun meneur n’est fabriqué pour grimper', () => {
    poser([hero('a', 0, [{ talentId: 'grimpeur', times: 1 }]), hero('b', 0, [{ talentId: 'grimpeur', times: 1 }])], scèneDeFalaise({ kind: 'surface', requiresGrimpeur: true }), PIED);
    useGame.getState().climbAcross(PIED, SOMMET);
    expect(useGame.getState().partyPos).toMatchObject(PIED);
  });
});
