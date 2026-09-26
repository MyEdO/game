/**
 * POSE ASSISE CONSOMMÉE AU RENDU — `Scene.seatAssignments` ne s'arrête pas au builder : la place
 * résolue (`SeatPose`) porte l'ANCRE du quad, le CAP du corps et sa POSE, pour les deux corps qui
 * peuvent s'attabler — le PNJ authoré (voie `collectBillboards`) et le MENEUR du groupe (voie
 * `actorBillboards`). Une donnée exposée sans lecteur serait une affordance morte : chaque assertion
 * ci-dessous compare le corps ASSIS à ce que le MÊME corps rend DEBOUT.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import { seatPoseOf, seatSitHeight, type SeatPose } from '../../state/seating';
import { boxUnitsPerM } from '../backends/webgl/billboardMath';
import { entityTokenScale } from '../sizeScale';
import { GROUND_Y, rigComposition } from '../rig/composeRig';
import { entityRigProfileFor } from '../rig/enemyProfile';
import { apply, worldTransforms } from '../rig/kinematics';
import { addPose } from '../rig/poses';
import type { BoneId } from '../rig/bones';
import type { View } from '../rig/facing';
import { dynamicMarks } from '../builders/dynamicMarks';
import { EYE_H, EYE_H_ASSIS, makeCamera, seatedEyeH } from '../pov/camera';
import { buildTokens, partyTokenOf } from '../builders/tokens';
import { actorBillboards, actorPoseKey, collectBillboards, memesBillboardEls, type ActorPose } from '../backends/webgl/sceneMeshes';
import type { TokenEl } from '../builders/types';
import type { Combatant } from '../../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';

/** Table en (2,2) cap N ; le PNJ attablé à l'EST, sa `pos` étant son abord (2+1, 2). */
function scèneAttablée(assis: boolean, species = 'humain'): Scene {
  const s = emptyScene(8, 8);
  s.entities = [
    { id: PROP, kind: 'prop', pos: { x: 2, y: 2 }, ref: TABLE, facing: 'N', usable: { assise: true } },
    { id: 'f1', kind: 'personnage', ref: 'humain', pos: { x: 3, y: 2 }, facing: 'S', appearance: { species } },
  ] as unknown as SceneEntity[];
  if (assis) s.seatAssignments = { [PROP]: { 'place-2': { kind: 'entity', entityId: 'f1' } } };
  return s;
}

const mpt = sceneMetresPerTile(emptyScene(8, 8));
const toutVisible = (s: Scene) => {
  const v = new Set<string>();
  for (let y = 0; y < s.dimensions.h; y++) for (let x = 0; x < s.dimensions.w; x++) v.add(`${x},${y},0`);
  return v;
};
const élémentsDe = (s: Scene) => ({ tokens: buildTokens(s, toutVisible(s), null, { activeZ: 0, viewZ: null, top: false }), props: [] as never[] });
const sujetFigurant = (s: Scene) => collectBillboards(s, mpt, élémentsDe(s)).find((b) => b.identity.startsWith('perso:f1'))!;

const meneur = (): Combatant =>
  ({
    id: 'h', label: 'Meneur', kind: 'hero', pos: { x: 3, y: 2 }, size: 'moyenne', wounds: { current: 12, max: 12 },
    weapons: [], characteristics: {}, advantage: 0, conditions: [], armour: {}, skills: [], talents: [], movement: 4,
    career: 'soldat', species: 'humain',
  }) as unknown as Combatant;

/**
 * MESURE D'UNE SILHOUETTE ASSISE — sondes A (toise) et C (sommet) prises sur le FRAGMENT RENDU, os
 * par os : chaque os du rig y porte sa matrice monde (`data-bone` + `matrix(a b c d e f)`, `f` = son
 * origine en y dans la boîte 120×150). Comparer deux chaînes SVG ne prouvait rien — la pose de
 * cavalier passait ce contrat à 0,8 % près, un corps DEBOUT hissé sur son siège.
 */
const originY = (svg: string, os: string): number => {
  const m = new RegExp(`data-bone="${os}" transform="matrix\\(([^)]*)\\)"`).exec(svg);
  expect(m, `os « ${os} » absent du fragment`).not.toBeNull();
  return Number(m![1].trim().split(/\s+/)[5]);
};

/** Toise d'un fragment : du sommet de la TÊTE à l'appui des PIEDS (origines d'os, même squelette
 *  des deux côtés — c'est la DIFFÉRENCE qui porte le sens). */
const toise = (svg: string) => Math.max(originY(svg, 'piedG'), originY(svg, 'piedD')) - originY(svg, 'tete');

/**
 * Contrats MÉTRIQUES de l'assise, tous DÉRIVÉS de la hauteur d'assise du catalogue (`seatSitHeight`)
 * et de l'échelle art→monde du quad (`boxUnitsPerM`) — aucun nombre posé à la main.
 */
function mesureAssise(assis: string, debout: string, place: SeatPose, entId: string) {
  const ent = scèneAttablée(true).entities.find((e) => e.id === entId)!;
  const assiseUnites = seatSitHeight(place) * boxUnitsPerM('personnage', entityTokenScale(ent));
  // Hauteur de HANCHE d'un corps debout, dans sa boîte : c'est de là que le bassin tombe au siège.
  const hancheDebout = GROUND_Y - originY(debout, 'cuisseD');
  expect(assiseUnites).toBeLessThan(hancheDebout); // un tabouret est plus bas qu'une hanche

  // SONDE C — le SOMMET descend, et il descend d'EXACTEMENT ce que le siège retire à la hanche.
  expect(originY(assis, 'tete') - originY(debout, 'tete')).toBeCloseTo(hancheDebout - assiseUnites, 0);
  // PIEDS AU SOL — l'appui ne bouge pas : le corps s'assoit, il ne lévite pas avec son siège.
  expect(Math.max(originY(assis, 'piedG'), originY(assis, 'piedD')))
    .toBeCloseTo(Math.max(originY(debout, 'piedG'), originY(debout, 'piedD')), 0);
  // SONDE A — la toise assise est nettement plus courte (la pose de cavalier n'en retirait que 0,8 %).
  expect(toise(assis)).toBeLessThan(toise(debout) * 0.85);
  expect(toise(assis)).toBeGreaterThan(toise(debout) * 0.6);
}

describe('PNJ authoré attablé — le billboard de figurant consomme sa place', () => {
  it('ancre, cap et corps viennent de la PLACE, pas de la case du PNJ', () => {
    const assis = sujetFigurant(scèneAttablée(true));
    const debout = sujetFigurant(scèneAttablée(false));
    const place = seatPoseOf(scèneAttablée(true), { kind: 'entity', entityId: 'f1' })!;

    // ANCRE — EN PLAN, le point posé est celui de la place (fraction de case × mètres/case)…
    expect(assis.anchor.x).toBeCloseTo(place.anchor.x * mpt, 6);
    expect(assis.anchor.z).toBeCloseTo(place.anchor.y * mpt, 6);
    expect(assis.anchor.x).not.toBeCloseTo(debout.anchor.x, 6); // …et pas celui de sa case.
    // …EN HAUTEUR, c'est le SOL : un corps assis a les pieds par terre. La hauteur d'assise du
    // catalogue (`seatSitHeight`) est l'écart MESURÉ entre le siège et cette ancre — elle appartient
    // à la posture, jamais à l'ancre, sinon le corps entier lévite d'une hauteur de tabouret.
    expect(assis.anchor.y).toBeCloseTo(place.ground, 6);
    expect(assis.anchor.y).toBeCloseTo(debout.anchor.y, 6);
    expect(place.anchor.h - assis.anchor.y).toBeCloseTo(seatSitHeight(place), 6);
    expect(seatSitHeight(place)).toBeGreaterThan(0);

    // CAP : celui du corps assis (place « est » d'une recette face au N → regard à l'ouest).
    expect(assis.facing).toBe('O');
    expect(debout.facing).toBe('S'); // témoin : debout, c'est le `facing` authoré de l'entité

    // CORPS : la POSTURE porte l'assise, et elle se MESURE sur le fragment rendu (sonde A/C).
    mesureAssise(assis.svg('front', false, 0), debout.svg('front', false, 0), place, 'f1');

    // CASE : inchangée — c'est elle qui porte la teinte de visibilité et le tri.
    expect(assis.cell).toEqual(debout.cell);
  });

  it('la place entre dans l’IDENTITÉ de cache et dans l’égalité des lots', () => {
    const assise = scèneAttablée(true);
    const debout = scèneAttablée(false);
    expect(sujetFigurant(assise).identity).not.toBe(sujetFigurant(debout).identity);
    expect(memesBillboardEls(élémentsDe(assise), élémentsDe(debout))).toBe(false);
    // TÉMOIN : deux dérivations de la MÊME scène restent égales (le lot neuf ne remonte rien).
    expect(memesBillboardEls(élémentsDe(assise), élémentsDe(assise))).toBe(true);
  });
});

describe('MENEUR attablé — l’acteur du monde volumique consomme la même place', () => {
  const place = () => seatPoseOf(scèneAttablée(true), { kind: 'entity', entityId: 'f1' })!;
  const poseDebout = (): ActorPose => ({ c: meneur(), x: 3, y: 2, z: 0, facing: 'S' });
  const poseAssise = (): ActorPose => ({ ...poseDebout(), seat: place() });

  it('ancre, cap et corps viennent de la place ; la case logique ne bouge pas', () => {
    const scene = scèneAttablée(true);
    const assis = actorBillboards([poseAssise()], scene, mpt)[0];
    const debout = actorBillboards([poseDebout()], scene, mpt)[0];

    expect(assis.anchor.x).toBeCloseTo(place().anchor.x * mpt, 6);
    expect(assis.anchor.z).toBeCloseTo(place().anchor.y * mpt, 6);
    expect(assis.anchor.y).toBeCloseTo(place().ground, 6); // au SOL, comme le figurant
    expect(place().anchor.h - assis.anchor.y).toBeCloseTo(seatSitHeight(place()), 6);
    expect(assis.facing).toBe('O');
    expect(debout.facing).toBe('S');
    mesureAssise(assis.svg('front', false, 0), debout.svg('front', false, 0), place(), 'f1');
    expect(assis.cell).toEqual(debout.cell); // brouillard et tri restent sur la case d'abord
    expect(assis.identity).not.toBe(debout.identity);
  });

  it('s’asseoir REFORGE l’acteur : la clé de mémo change', () => {
    expect(actorPoseKey(poseAssise())).not.toBe(actorPoseKey(poseDebout()));
  });

  it('aucun `mountId` : une chaise n’est pas une monture', () => {
    const assis = actorBillboards([poseAssise()], scèneAttablée(true), mpt)[0];
    expect(assis).not.toHaveProperty('mountId');
    expect(JSON.stringify(Object.keys(assis))).not.toContain('mount');
  });
});

describe('partyTokenOf — la dérivation UNIQUE du jeton de groupe', () => {
  it('meneur assis : la position de RENDU devient l’ancre, la place voyage avec lui', () => {
    const scene = scèneAttablée(false);
    scene.seatAssignments = { [PROP]: { 'place-2': { kind: 'party', rang: 1 } } };
    const jeton = partyTokenOf(scene, meneur(), { x: 3, y: 2 })!;
    const place = seatPoseOf(scene, { kind: 'party', rang: 1 })!;
    expect(jeton.seat).toEqual(place);
    expect(jeton.pos.x).toBeCloseTo(place.anchor.x, 6);
    expect(jeton.pos.y).toBeCloseTo(place.anchor.y, 6);
    expect(jeton.pos).not.toEqual({ x: 3, y: 2 });
  });

  it('meneur debout : la case logique telle quelle, aucune place', () => {
    const jeton = partyTokenOf(scèneAttablée(false), meneur(), { x: 3, y: 2 })!;
    expect(jeton.pos).toEqual({ x: 3, y: 2 });
    expect(jeton.seat).toBeUndefined();
  });

  it('aucun meneur → aucun jeton', () => {
    expect(partyTokenOf(scèneAttablée(false), undefined, { x: 3, y: 2 })).toBeNull();
  });
});

/**
 * MARQUE DE SOL — 5ᵉ consommateur de la pose. Le repère « groupe » se peint sur une case ENTIÈRE : il
 * dit « le groupe se tient ici ». Attablé, le corps n'est plus sur sa case d'abord et son anneau
 * d'équipe l'a suivi ; le repère de sol S'ÉTEINT (le poser à l'abord montrerait le groupe à côté de
 * lui-même, le poser à l'ancre peindrait un carré de sol sous la table).
 */
describe('marque de sol du groupe — cohérente avec la pose', () => {
  const jeton = (seat?: SeatPose) => ({ leader: meneur(), pos: { x: 3, y: 2 }, ...(seat ? { seat } : {}) });

  it('meneur DEBOUT : le repère de sol est posé à sa case', () => {
    const marks = dynamicMarks(null, { x: 3, y: 2 }, [], jeton());
    expect(marks.party).toEqual({ x: 3, y: 2, z: 0 });
  });

  it('meneur ASSIS : le repère s’éteint, l’anneau d’équipe reste (il suit le corps)', () => {
    const place = seatPoseOf(scèneAttablée(true), { kind: 'entity', entityId: 'f1' })!;
    const marks = dynamicMarks(null, { x: 3, y: 2 }, [], jeton(place));
    expect(marks.party).toBeNull();
    expect(marks.rings.map((r) => r.id)).toContain('h');
  });
});

/**
 * HAUTEUR D'ŒIL — la vue subjective d'un corps assis ne se prend pas à hauteur d'homme debout. Elle
 * se dérive de l'ancre de la PLACE (hauteur d'assise réelle) et d'une seule constante nommée.
 */
describe('œil POV assis', () => {
  it('descend sous l’œil debout, et se dérive de la hauteur d’assise', () => {
    const scene = scèneAttablée(true);
    const place = seatPoseOf(scene, { kind: 'entity', entityId: 'f1' })!;
    const h = seatedEyeH(scene, place, 0);
    expect(h).toBeCloseTo(place.anchor.h + EYE_H_ASSIS, 6); // sol à 0 dans cette scène
    expect(h).toBeLessThan(EYE_H);
  });

  it('un siège PLUS HAUT lève l’œil d’autant (aucun nombre magique)', () => {
    const scene = scèneAttablée(true);
    const place = seatPoseOf(scene, { kind: 'entity', entityId: 'f1' })!;
    const perche = { anchor: { ...place.anchor, h: place.anchor.h + 0.3 } };
    expect(seatedEyeH(scene, perche, 0) - seatedEyeH(scene, place, 0)).toBeCloseTo(0.3, 6);
  });

  it('`makeCamera` POSE réellement l’œil à la hauteur reçue', () => {
    const scene = scèneAttablée(true);
    const place = seatPoseOf(scene, { kind: 'entity', entityId: 'f1' })!;
    const debout = makeCamera(scene, { x: 3, y: 2 }, 'S');
    const assis = makeCamera(scene, { x: place.anchor.x, y: place.anchor.y }, place.facing, seatedEyeH(scene, place, 0));
    expect(assis.eye.z).toBeLessThan(debout.eye.z);
    expect(debout.eye.z - assis.eye.z).toBeCloseTo(EYE_H - (place.anchor.h + EYE_H_ASSIS), 6);
  });
});

/** Le token du builder porte bien la place — la SOURCE que les deux voies de rendu consomment. */
describe('buildTokens → rendu : la chaîne complète', () => {
  it('le sujet `figurant` d’un attablé expose sa place, et le billboard la lit', () => {
    const els = buildTokens(scèneAttablée(true), toutVisible(scèneAttablée(true)), null, { activeZ: 0, viewZ: null, top: false });
    const tk = els.find((e) => e.id === 'f1') as TokenEl;
    expect(tk.subject).toMatchObject({ kind: 'figurant', seat: { propId: PROP, slotId: 'place-2' } });
  });
});

/**
 * CONTRAT 4 ESPÈCES × 3 VUES — le tabouret d'auberge a UNE hauteur, les corps qui s'y posent n'ont
 * pas la même jambe. Une espèce COURTE ne s'étire pas pour rejoindre le sol : elle PEND de son
 * siège. Aucun seuil n'est posé par espèce — tout se dérive du SQUELETTE du corps rendu (les deux
 * seams que le rendu emploie : `entityRigProfileFor` + `rigComposition`) confronté à la hauteur
 * d'assise du catalogue, et se vérifie sur le FRAGMENT RENDU, os par os.
 */
const ESPÈCES = ['humain', 'nain', 'halfling', 'elfe-sylvain'];
const VUES: View[] = ['front', 'back', 'profile'];

/** Repères de jambe du corps DEBOUT + hauteur d'assise, dans le repère de sa boîte. */
function repèresDe(species: string, view: View) {
  const ent = scèneAttablée(false, species).entities.find((e) => e.id === 'f1')!;
  const place = seatPoseOf(scèneAttablée(true, species), { kind: 'entity', entityId: 'f1' })!;
  const prof = entityRigProfileFor(ent, false)!;
  const comp = rigComposition(prof.appearance, prof.equip, prof.tenue, view);
  const w = worldTransforms(comp.sk, addPose(comp.speciesPose, comp.viewPose));
  const y = (id: BoneId, dy = 0) => apply(w[id], { x: 0, y: dy }).y;
  const cheville = y('piedD');
  return {
    drop: seatSitHeight(place) * boxUnitsPerM('personnage', entityTokenScale(ent)),
    solY: Math.max(y('piedG', comp.sk.piedG.length), y('piedD', comp.sk.piedD.length)),
    // Ce que le TIBIA seul descend sous le genou, MESURÉ COMME LE SOLVEUR le borne, canal par canal :
    // de profil il redresse le tibia à la VERTICALE (angle monde 0) — c'est sa longueur entière qui
    // descend ; de face/dos il raisonne sur la descente PROJETÉE au repos. Mesurer la projection pour
    // les deux laissait 0,07 unité de marge au contrat de pendant (rouge au moindre changement
    // d'angle de repos d'un gabarit) ; mesuré par canal, le résidu tombe à 0,02.
    tibia: view === 'profile' ? comp.sk.tibiaD.length : cheville - y('tibiaD'),
    semelle: y('piedD', comp.sk.piedD.length) - cheville, // hauteur du PIED sous la cheville
    jambe: cheville - y('cuisseD'),                       // descente hanche → cheville, corps debout
  };
}

describe.each(ESPÈCES)('assise d’un %s — le siège est le même, la jambe non', (species) => {
  it.each(VUES)('vue %s : bassin au siège, jambe jamais étirée, pieds au sol ou pendants', (view) => {
    const r = repèresDe(species, view);
    const a = sujetFigurant(scèneAttablée(true, species)).svg(view, false, 0);
    const d = sujetFigurant(scèneAttablée(false, species)).svg(view, false, 0);
    const hancheA = originY(a, 'cuisseD'), hancheD = originY(d, 'cuisseD');
    const piedA = originY(a, 'piedD'), piedD = originY(d, 'piedD');

    // TÉMOIN de dérivation — le squelette mesuré est bien celui du corps rendu.
    expect(piedD - hancheD).toBeCloseTo(r.jambe, 0);

    // BASSIN AU SIÈGE — le corps est porté par son bassin, à la hauteur d'assise du catalogue.
    expect(r.solY - hancheA).toBeCloseTo(r.drop, 0);

    // JAMAIS D'ÉTIREMENT — la jambe assise ne descend pas plus bas que ce que le TIBIA seul permet,
    // la cuisse reposant sur le plan d'assise ; et elle est toujours PLIÉE par rapport au debout.
    expect(piedA - hancheA).toBeLessThan(r.tibia + 0.5);
    expect(piedA - hancheA).toBeLessThan(piedD - hancheD);

    // APPUI DU SOL tant que le tibia l'atteint — sinon les pieds PENDENT, de l'écart exact.
    const atteignable = r.drop <= r.tibia + r.semelle;
    if (atteignable) expect(piedA).toBeCloseTo(piedD, 0);
    else {
      expect(piedA).toBeLessThan(piedD - 1);
      expect(r.solY - (piedA + r.semelle)).toBeCloseTo(r.drop - r.tibia - r.semelle, 0);
    }

    // TOISE — un corps assis est plus court que debout ; les pieds à l'appui, franchement plus court.
    const ratio = toise(a) / toise(d);
    expect(ratio).toBeLessThan(atteignable ? 0.8 : 1);
    expect(ratio).toBeGreaterThan(0.6);
  });
});

it('la population de contrôle exerce les DEUX régimes (aucune assertion à vide)', () => {
  const régimes = ESPÈCES.map((sp) => {
    const r = repèresDe(sp, 'front');
    return r.drop <= r.tibia + r.semelle ? 'appui' : 'pendant';
  });
  expect(new Set(régimes).size).toBe(2);
});
