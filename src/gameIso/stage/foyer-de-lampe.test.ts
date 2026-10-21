/**
 * ANCRAGE DE LA LAMPE À SA PRIMITIVE (#1680 ligne 5) — le contrat qui MORD : la lampe ponctuelle d'un
 * décor volumique est posée au CENTRE de la primitive que sa recette déclare émettrice (`emet`), et
 * non à l'aplomb de sa case à une hauteur forfaitaire.
 *
 * Il se mesure contre la CUISSON RÉELLE, pas contre la donnée : le référent est le barycentre des
 * faces que le builder produit pour cette primitive (`builders/props.ts` → `buildPropVolumes`), passé
 * en monde par la MÊME conversion que le renderer (`backends/webgl/worldTris:gpToWorld`). Une lampe
 * calée sur la donnée mais fausse à la cuisson (repère, cap, échelle de case, altitude de sol) sortirait
 * verte d'un test écrit sur la donnée seule ; ici elle sort rouge.
 *
 * QUATRE CAPS : c'est la seule façon de voir la ROTATION. Une implémentation qui oublierait
 * `rotatePropLocal` reste juste au cap d'identité (`S`, où la rotation est l'identité) et fausse aux
 * trois autres — et le foyer de l'âtre est excentré en `y` (0,01 case), donc la rotation le déplace.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene } from '../../noyau/monde/scene';
import { mapLights } from '../../noyau/monde/vision';
import { props, findPropById, type PropVolumeRecipe } from '../../data';
import { setDataset } from '../../data/overrides';
import { buildProps } from '../builders/props';
import { gpToWorld } from '../backends/webgl/worldTris';
import { pointLightWrites, FLAME_LIFT_M } from './stagePointLights';
import type { Dir4 } from '../../noyau/monde/dir8';

/** Tolérance du contrat, en mètres — « la lampe est au foyer », pas « la lampe est à peu près là ». */
const TOLERANCE_M = 0.1;

const CAPS: Dir4[] = ['N', 'E', 'S', 'O'];

/** Scène d'épreuve : UN décor, posé au milieu, au cap demandé. Sol plat (`herbe`), donc `heightAt` = 0
 *  partout — la hauteur mesurée est bien celle du foyer, pas celle du relief. */
function sceneAvec(ref: string, facing: Dir4, pos = { x: 5, y: 4 }): Scene {
  const s = emptyScene('scene-test', 12, 9);
  s.entities = [{ id: 'src-1', kind: 'prop', ref, pos, facing }];
  return s;
}

/** Barycentre MONDE des faces CUITES d'un décor dont le matériau est `material` — la position que
 *  l'œil voit, à l'issue du chemin de rendu réel. */
function barycentreCuit(scene: Scene, material: string): { x: number; y: number; z: number } {
  const mpt = sceneMetresPerTile(scene);
  const faces = buildProps(scene)
    .flatMap((el) => ('faces' in el ? el.faces : []))
    .filter((f) => f.material.domain === 'prop' && f.material.id === material);
  expect(faces.length, `aucune face cuite en « ${material} » — le décor n’a pas été bâti en VOLUME`).toBeGreaterThan(0);
  const pts = faces.flatMap((f) => f.poly.map((p) => gpToWorld(p, mpt)));
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    z: pts.reduce((a, p) => a + p.z, 0) / pts.length,
  };
}

/** La lampe QUE LE RENDU ÉCRIT pour l'unique source de la scène. */
function lampeDe(scene: Scene) {
  const sources = mapLights(scene);
  expect(sources).toHaveLength(1);
  const slots = pointLightWrites(sources, { scene, mpt: sceneMetresPerTile(scene), ambianceLum: 0.05 });
  const w = slots.find((s) => s?.srcId === 'src-1');
  expect(w, 'aucune lampe écrite pour la source de la scène').toBeTruthy();
  return w!;
}

describe('la lampe d’un décor VOLUMIQUE est posée sur sa primitive émettrice (#1680 ligne 5)', () => {
  // Le décor est choisi par ce qu'il EST (une recette volumique qui éclaire), pas par son nom : si le
  // catalogue en gagne un second demain, ce test le couvre sans qu'on y touche.
  const MATIERE_DU_FOYER = 'braises';

  it('la recette de l’âtre déclare UNE primitive émettrice, et sa matière la désigne sans ambiguïté', () => {
    const prims = findPropById('cheminee-interieure')?.volume?.primitives ?? [];
    const emettrices = prims.filter((p) => p.emet);
    expect(emettrices).toHaveLength(1);
    expect(emettrices[0].material).toBe(MATIERE_DU_FOYER);
    // La sélection des faces par matériau est EXACTE : aucune autre primitive ne porte cette matière.
    expect(prims.filter((p) => p.material === MATIERE_DU_FOYER)).toHaveLength(1);
  });

  it.each(CAPS)('cap %s : la lampe est à ≤ 10 cm du barycentre des faces CUITES du foyer', (facing) => {
    const scene = sceneAvec('cheminee-interieure', facing);
    const lampe = lampeDe(scene);
    const foyer = barycentreCuit(scene, MATIERE_DU_FOYER);
    const ecart = Math.hypot(lampe.x - foyer.x, lampe.y - foyer.y, lampe.z - foyer.z);
    expect(ecart, `cap ${facing} : lampe ${JSON.stringify(lampe)} vs foyer cuit ${JSON.stringify(foyer)}`)
      .toBeLessThanOrEqual(TOLERANCE_M);
  });

  it('la lampe DESCEND au foyer : elle n’est plus à la hauteur forfaitaire des billboards', () => {
    // Le contrat « ≤ 10 cm » ne dit pas à lui seul que quelque chose a bougé (une tolérance peut être
    // satisfaite par hasard) : celui-ci dit que la valeur POSÉE n'est plus le défaut.
    const lampe = lampeDe(sceneAvec('cheminee-interieure', 'S'));
    expect(lampe.y).toBeLessThan(FLAME_LIFT_M);
    expect(lampe.y).toBeCloseTo(0.24, 6);
  });

  it('la CONVENTION de case est la MÊME pour la lampe et pour la géométrie', () => {
    // Un décalage d'un demi-pas de case (`pos.x·mpt` contre `(pos.x + 0,5)·mpt`) entre la lampe et le
    // monde cuit vaudrait 1 m à 2 m la case : dix fois la tolérance. Mesuré aux deux axes séparément,
    // pour qu'un décalage sur UN seul ne se fonde pas dans une norme.
    const scene = sceneAvec('cheminee-interieure', 'S');
    const lampe = lampeDe(scene);
    const foyer = barycentreCuit(scene, MATIERE_DU_FOYER);
    expect(Math.abs(lampe.x - foyer.x)).toBeLessThanOrEqual(TOLERANCE_M);
    expect(Math.abs(lampe.z - foyer.z)).toBeLessThanOrEqual(TOLERANCE_M);
    // Et le SOL de la case entre bien dans la hauteur : `heightAt` vaut 0 ici, la hauteur EST le foyer.
    expect(heightAt(scene, 5, 4, 0)).toBe(0);
  });

  /**
   * EMPREINTE NON 1×1 — l'ancre d'un décor n'est PAS sa case : c'est le CENTRE de son empreinte
   * (`decorAncre`, `noyau/monde/footprint.ts`), que le builder applique à la recette. Une lampe calée sur
   * `pos` seul reste juste tant que tous les émetteurs sont 1×1 (offset nul) et se détache dès la
   * première empreinte plus large — mesuré à 1,414 m sur un 2×2, quatorze fois la tolérance.
   *
   * Le décor d'épreuve est l'âtre RÉEL, son CORPS élargi le temps de la mesure : la recette, le foyer
   * déclaré et la cuisson sont ceux du catalogue, seule l'étendue du corps varie. Depuis #1509
   * l'empreinte d'un décor à recette se DÉRIVE de ce corps tourné — poser un `foot` sur un volumique
   * ne déplacerait plus rien. Le catalogue n'a aujourd'hui aucun émetteur volumique à corps large —
   * c'est exactement pourquoi ce cas se teste ici plutôt que de s'attendre à être découvert par la
   * première donnée qui le posera.
   */
  it.each(CAPS)('cap %s : empreinte 2×2 — la lampe suit l’ANCRE, pas la case', (facing) => {
    const scene = sceneAvec('cheminee-interieure', facing);
    // Le builder comme `mapLights` (`foyerDe`) lisent la MÊME entrée de catalogue, par la même
    // `findPropById` : lui poser sa recette élargie le temps de la mesure les sert tous deux, et c'est
    // la seule façon de mesurer les deux chemins sur une donnée strictement identique. L'édition passe
    // par la PORTE du seam (`setDataset`) : entrée et recette sont des objets NEUFS, ce qui versionne
    // l'écriture pour les index mémoïsés et clé le cache d'empreinte (#1717).
    const recetteInitiale = findPropById('cheminee-interieure')!.volume!;
    const avant = [...props];
    // Une semelle de 3,5 m de côté ⇒ 1,75 case ⇒ empreinte 2×2 ; posée au ras du sol et dans un
    // matériau qui n'est pas celui du foyer, elle ne touche ni la mesure du barycentre ni le foyer.
    const elargie: PropVolumeRecipe = {
      ...recetteInitiale,
      primitives: [...recetteInitiale.primitives, {
        kind: 'box', center: { xM: 0, yM: 0, hM: 0.01 }, size: { xM: 3.5, yM: 3.5, hM: 0.02 },
        material: recetteInitiale.primitives[0].material,
      }],
    };
    setDataset('props', props.map((p) => (p.id === 'cheminee-interieure' ? { ...p, volume: elargie } : p)));
    try {
      const lampe = lampeDe(scene);
      const foyer = barycentreCuit(scene, MATIERE_DU_FOYER);
      const ecart = Math.hypot(lampe.x - foyer.x, lampe.y - foyer.y, lampe.z - foyer.z);
      expect(ecart, `cap ${facing} : lampe ${JSON.stringify(lampe)} vs foyer cuit ${JSON.stringify(foyer)}`)
        .toBeLessThanOrEqual(TOLERANCE_M);
      // Et l'offset est bien NON NUL : sans lui, le test ci-dessus ne prouverait rien de plus que le 1×1.
      expect(mapLights(scene)[0].foyer!.x).not.toBeCloseTo(0, 6);
    } finally {
      setDataset('props', avant);
    }
  });

  it('un émetteur SANS primitive déclarée garde la hauteur par DÉFAUT, à l’aplomb de sa case', () => {
    // Le brasero est un BILLBOARD qui éclaire : aucune recette, donc aucun foyer à déclarer. Ce n'est
    // pas un second régime — c'est l'autre valeur du même paramètre.
    const scene = sceneAvec('brasero', 'S');
    expect(mapLights(scene)[0].foyer).toBeUndefined();
    const lampe = lampeDe(scene);
    const mpt = sceneMetresPerTile(scene);
    expect(lampe.x).toBe(5 * mpt);
    expect(lampe.z).toBe(4 * mpt);
    expect(lampe.y).toBe(FLAME_LIFT_M);
  });
});
