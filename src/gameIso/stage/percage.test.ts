/**
 * DÉCOUPE LOCALE — LE VERDICT (#1176, M2). Sur La Diligence RÉELLE, avec le montage du stage
 * (`stage/MondeDeCampagne` : nappes projetées + capsules d'acteurs), jamais une géométrie de laboratoire.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { type Dims } from '../../geometry/iso';
import { elOccluder } from './occluders';
import { buildRoofs, massFootprintCells } from '../builders/roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { chebyshev } from '../../engine/grid';
import { heightAt } from '../../state/scene';
import { actorCapsuleOf } from './actorCapsule';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';
import type { Lid } from './architectureVisibility';
import { avancerRayon, centrePercage, clePercage, creerPercage, verdictPercage, type ActeurPerce, type Percage } from './percage';
import { PERCAGE_FONDU_MS, PERCAGE_MAX_HEROS, PERCAGE_RAYON_PX, trousPercage } from '../backends/webgl/percageLocal';

const scene = paquetDuJeu(diligenceCampaign).scenes[0];
const dims: Dims = { ...scene.dimensions, rot: 0, view: 'iso' };
/** Le montage de l'hôte, mot pour mot (`stage/MondeDeCampagne`) : une nappe par masse de toit, projetée. */
const lids: Lid[] = buildRoofs(scene).map((el) => ({
  sectionId: el.sectionId ?? el.key, z: el.cell.z, cells: el.cells, occluder: elOccluder(el, dims),
}));
const acteur = (x: number, y: number, z = 0): ActeurPerce => ({
  capsule: actorCapsuleOf({ x, y, h: heightAt(scene, x, y, z) }, dims),
  z,
  monde: new THREE.Vector3(x, heightAt(scene, x, y, z), y),
});

const camera = (() => {
  const cam = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 200);
  cam.position.set(20, 30, 40);
  cam.lookAt(16, 0, 19);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
})();

/**
 * LES POSTES SE DÉRIVENT DU PLAN, jamais d'une coordonnée recopiée : les masses de bâtiment se lisent
 * par `effectiveArchitecture` (les masses `derived` s'y recalculent du plan). Le poste COIFFÉ d'une
 * masse est la case de son emprise la plus PROFONDE (distance de Chebyshev maximale au premier voisin
 * hors emprise) PARMI celles que le verdict coiffe — l'occlusion est une affaire d'écran, une case de
 * bord d'emprise peut n'être coiffée par aucune nappe. À l'opposé, les cases les plus ÉLOIGNÉES de
 * toute masse sont les postes NUS. Les deux familles suivent l'auteur : déplacer un bâtiment les déplace.
 */
type Case = { x: number; y: number };
const cle = (p: Case) => `${p.x},${p.y}`;
const cellulesDe = (footprint: Parameters<typeof massFootprintCells>[0]): Case[] =>
  [...massFootprintCells(footprint)].map((c) => { const [x, y] = c.split(',').map(Number); return { x, y }; });
/** Profondeur d'une case DANS son emprise : l'anneau de Chebyshev où apparaît la première case hors emprise. */
function profondeur(p: Case, dans: Set<string>): number {
  for (let k = 1; ; k++)
    for (let dy = -k; dy <= k; dy++)
      for (let dx = -k; dx <= k; dx++)
      { const voisin = { x: p.x + dx, y: p.y + dy }; if (chebyshev(p, voisin) === k && !dans.has(cle(voisin))) return k; }
}
const EMPRISES = effectiveArchitecture(scene)
  .flatMap((corps) => corps.masses.map((masse) => ({ id: `${corps.id}/${masse.id}`, cells: cellulesDe(masse.footprint) })))
  .sort((a, b) => b.cells.length - a.cells.length || a.cells[0].y - b.cells[0].y || a.cells[0].x - b.cells[0].x);
const coiffe = (p: Case) => verdictPercage(lids, [acteur(p.x, p.y)])[0];
/** Le poste coiffé d'une emprise : la plus profonde de ses cases COIFFÉES (départage par balayage). */
function posteCoiffeDe(cells: Case[]): Case | null {
  const dans = new Set(cells.map(cle));
  const coiffees = cells.filter(coiffe);
  if (!coiffees.length) return null;
  return coiffees.reduce((m, p) =>
    (profondeur(p, dans) - profondeur(m, dans) || m.y - p.y || m.x - p.x) > 0 ? p : m);
}
const POSTES = EMPRISES.map((e) => ({ ...e, poste: posteCoiffeDe(e.cells) }));
const SOUS_MASSE = EMPRISES.flatMap((e) => e.cells);
const DANS_MASSE = new Set(SOUS_MASSE.map(cle));
const ECART = (p: Case) => Math.min(...SOUS_MASSE.map((m) => chebyshev(m, p)));
const NUES = [...Array(scene.dimensions.h).keys()]
  .flatMap((y) => [...Array(scene.dimensions.w).keys()].map((x) => ({ x, y })))
  .filter((p) => !DANS_MASSE.has(cle(p)));
const LOIN_MAX = Math.max(...NUES.map(ECART));
/** Les postes NUS : les cases que la plus proche des masses laisse le plus loin. */
const DECOUVERTS = NUES.filter((p) => ECART(p) === LOIN_MAX);
/** Le poste COIFFÉ de référence : celui de la plus grande masse qui en porte un. */
const COIFFE = POSTES.map((e) => e.poste).find((p): p is Case => !!p);
if (!COIFFE) throw new Error('perçage : aucune masse de la carte ne porte de case coiffée — le banc n’a plus de sujet');
const DECOUVERT = DECOUVERTS[0];

describe('verdict — qui est CACHÉ par une masse, sur La Diligence', () => {
  it('chaque masse porte une case coiffée, son poste dérivé l’est, et les cases les plus loin de toute masse ne le sont pas', () => {
    expect(POSTES.length, 'la carte porte des masses de bâtiment').toBeGreaterThan(0);
    expect(POSTES.filter((e) => !e.poste).map((e) => e.id), 'masse(s) qu’AUCUNE nappe ne coiffe').toEqual([]);
    expect(POSTES.filter((e) => e.poste && !coiffe(e.poste)).map((e) => e.id)).toEqual([]);
    // TÉMOIN : sans lui, un verdict constamment vrai passerait pour une loi.
    expect(DECOUVERTS.length, 'la carte porte des cases hors de toute masse').toBeGreaterThanOrEqual(1);
    expect(DECOUVERTS.filter(coiffe)).toEqual([]);
  });

  it('le verdict est PAR HÉROS : un même appel rend un booléen par acteur, dans l’ordre', () => {
    const autreNu = DECOUVERTS[1] ?? NUES.filter((p) => !coiffe(p) && cle(p) !== cle(DECOUVERT))[0];
    expect(autreNu, 'un SECOND poste nu, distinct du premier').toBeTruthy();
    expect(verdictPercage(lids, [acteur(DECOUVERT.x, DECOUVERT.y), acteur(COIFFE.x, COIFFE.y), acteur(autreNu.x, autreNu.y)]))
      .toEqual([false, true, false]);
  });

  it('CENSUS de la carte : la loi tranche des deux côtés, et chaque famille dérivée tombe du côté qu’elle nomme', () => {
    const libres = new Set<string>();
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) if (!coiffe({ x, y })) libres.add(`${x},${y}`);
    expect(DECOUVERTS.filter((p) => !libres.has(cle(p))), 'poste(s) NU(S) que le balayage dit coiffé(s)').toEqual([]);
    expect(POSTES.flatMap((e) => (e.poste && libres.has(cle(e.poste)) ? [e.id] : [])), 'poste(s) COIFFÉ(S) que le balayage dit libre(s)').toEqual([]);
    // Bornes DÉRIVÉES des deux familles — aucun chiffre recopié de la carte.
    expect(libres.size).toBeGreaterThanOrEqual(DECOUVERTS.length);
    expect(libres.size).toBeLessThanOrEqual(scene.dimensions.w * scene.dimensions.h - POSTES.filter((e) => e.poste).length);
  });

  it('une nappe SOUS les pieds ne cache pas : la garde de niveau du verdict', () => {
    const enHauteur = acteur(COIFFE.x, COIFFE.y, 2);
    const dessous = lids.filter((l) => l.z < 2);
    expect(dessous.length, 'la carte porte bien des nappes sous le niveau 2').toBeGreaterThan(0);
    expect(verdictPercage(dessous, [enHauteur])[0]).toBe(false);
  });
});

describe('cadence — le verdict ne se rejoue qu’à la CLÉ', () => {
  const entree = (cle: string) => ({ cle, lids, acteurs: [acteur(COIFFE.x, COIFFE.y)] });

  it('la clé porte le PAS, le cran de caméra et l’étage — pas la frame', () => {
    const tuiles = [{ id: 'h1', x: COIFFE.x, y: COIFFE.y, z: 0 }];
    const base = clePercage({ tuiles, rot: 0, view: 'iso', activeZ: 0 });
    expect(clePercage({ tuiles, rot: 0, view: 'iso', activeZ: 0 })).toBe(base);
    expect(clePercage({ tuiles: [{ id: 'h1', x: COIFFE.x + 1, y: COIFFE.y, z: 0 }], rot: 0, view: 'iso', activeZ: 0 })).not.toBe(base);
    expect(clePercage({ tuiles, rot: 1, view: 'iso', activeZ: 0 })).not.toBe(base);
    expect(clePercage({ tuiles, rot: 0, view: 'top', activeZ: 0 })).not.toBe(base);
    expect(clePercage({ tuiles, rot: 0, view: 'iso', activeZ: 1 })).not.toBe(base);
  });

  it('à clé CONSTANTE le pilote ne retire pas — cent frames, un seul verdict', () => {
    const percage = creerPercage();
    expect(percage.majVerdict(entree('a'))).toBe(true);
    let horloge = 0;
    for (let i = 0; i < 100; i++) {
      expect(percage.majVerdict(entree('a'))).toBe(false);
      horloge += 16;
      percage.avancer(horloge, camera, 1280, 720);
    }
    expect(percage.verdictsJoues()).toBe(1);
    expect(percage.majVerdict(entree('b'))).toBe(true);
    expect(percage.verdictsJoues()).toBe(2);
  });
});

/** Sert des IMAGES au pilote jusqu'à ce que le fondu ait convergé : il tient SON horloge (`avancer`
 *  reçoit l'horodatage de l'image et borne son propre pas), une seule avance ne le mène nulle part.
 *  Rend l'horodatage de la dernière image servie. */
function fondreEnEntier(percage: Percage): number {
  let t = 0;
  for (; t <= PERCAGE_FONDU_MS + 100; t += 50) percage.avancer(t, camera, 1280, 720);
  return t - 50;
}

describe('fondu et écriture des trous', () => {
  it('le rayon atteint sa cible en exactement `PERCAGE_FONDU_MS`, et se referme de même', () => {
    expect(avancerRayon(0, PERCAGE_RAYON_PX, PERCAGE_FONDU_MS)).toBe(PERCAGE_RAYON_PX);
    expect(avancerRayon(0, PERCAGE_RAYON_PX, PERCAGE_FONDU_MS / 2)).toBeCloseTo(PERCAGE_RAYON_PX / 2, 10);
    expect(avancerRayon(PERCAGE_RAYON_PX, 0, PERCAGE_FONDU_MS)).toBe(0);
    // Aucun dépassement : le fondu ne rebondit pas au-delà de la cible.
    expect(avancerRayon(0, PERCAGE_RAYON_PX, PERCAGE_FONDU_MS * 10)).toBe(PERCAGE_RAYON_PX);
  });

  it('le pilote écrit les quatre trous : centre projeté + rayon, et ZÉRO pour qui n’est pas caché', () => {
    const percage = creerPercage();
    const acteurs = [acteur(COIFFE.x, COIFFE.y), acteur(DECOUVERT.x, DECOUVERT.y)];
    percage.majVerdict({ cle: 'x', lids, acteurs });
    fondreEnEntier(percage);
    const trous = trousPercage();
    expect(trous).toHaveLength(PERCAGE_MAX_HEROS);
    const attendu = centrePercage(camera, acteurs[0].monde, 1280, 720);
    expect(trous[0].x).toBeCloseTo(attendu.x, 6);
    expect(trous[0].y).toBeCloseTo(attendu.y, 6);
    expect(trous[0].z).toBeCloseTo(attendu.z, 6);
    expect(trous[0].w, 'le héros couvert a son trou en grand').toBe(PERCAGE_RAYON_PX);
    expect(trous[1].w, 'le héros à découvert n’a pas de trou').toBe(0);
    expect(trous[3].w, 'un emplacement sans héros reste éteint').toBe(0);
  });

  /** LE CENTRE SUIT LA CAMÉRA DE LA FRAME, pas celle du verdict (#1176, M3) : le sujet est tenu par
   *  RÉFÉRENCE et reprojeté à chaque `avancer`. Deux caméras, un seul verdict. */
  it('sans REJOUER le verdict, une autre caméra déplace le centre du trou', () => {
    const percage = creerPercage();
    const acteurs = [acteur(COIFFE.x, COIFFE.y)];
    percage.majVerdict({ cle: 'y', lids, acteurs });
    const fin = fondreEnEntier(percage);
    const avant = trousPercage()[0].clone();
    const autre = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 200);
    autre.position.set(-20, 30, 40);
    autre.lookAt(16, 0, 19);
    autre.updateMatrixWorld();
    autre.updateProjectionMatrix();
    expect(percage.majVerdict({ cle: 'y', lids, acteurs }), 'la clé n’a pas bougé').toBe(false);
    percage.avancer(fin + 16, autre, 1280, 720);
    const apres = trousPercage()[0];
    const attendu = centrePercage(autre, acteurs[0].monde, 1280, 720);
    expect(apres.x, 'la nouvelle caméra déplace réellement le sujet').not.toBeCloseTo(avant.x, 1);
    expect(apres.x).toBeCloseTo(attendu.x, 6);
    expect(apres.y).toBeCloseTo(attendu.y, 6);
    expect(apres.w, 'le rayon ne se referme pas pour un simple battement').toBe(PERCAGE_RAYON_PX);
  });

  it('ORTHO — la profondeur écran est AFFINE en profondeur monde : la comparaison du shader est exacte', () => {
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 101);
    cam.position.set(0, 0, 50);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const z = [0, 10, 20, 30].map((d) => centrePercage(cam, new THREE.Vector3(0, 0, -d), 100, 100).z);
    const pas = z[1] - z[0];
    for (let i = 1; i < z.length; i++) expect(z[i] - z[i - 1]).toBeCloseTo(pas, 12);
    expect(pas, 's’éloigner de la caméra fait CROÎTRE la profondeur écran').toBeGreaterThan(0);
  });
});
