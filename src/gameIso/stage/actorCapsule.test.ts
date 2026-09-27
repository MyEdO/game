import { describe, it, expect } from 'vitest';
import { TW, type Dims } from '../../geometry/iso';
import { actorCapsuleOf, ACTOR_CAPSULE_R_M } from './actorCapsule';
import { ISO_PX_PER_M } from '../iso';
import { billboardHeightM } from '../backends/webgl/billboardMath';
import { baseSkeleton, applyBuild, groundSkeleton } from '../rig/skeletons';
import { gabaritById, type GabaritDef } from '../rig/gabarits';
import { raceById } from '../rig/races';
import { worldTransforms, apply } from '../rig/kinematics';
import { BONE_IDS } from '../rig/bones';
import { sizeTokenScale } from '../sizeScale';
import { COMBAT_TOKEN_BASE } from '../builders/dynamicMarks';
import type { SizeCategory } from '../../engine/size';
import { sexeSchema, type Sexe } from '../../data/schemas/grammaire/valeurs';

/**
 * LA CAPSULE EST CALÉE SUR LE CORPS DESSINÉ (#907). Elle sert la visée CAMÉRA du sujet et la loi de
 * DÉGAGEMENT du monde (`stage/MondeDeCampagne` → `cleared`) : trop étroite, elle manque les occulteurs posés sur
 * les épaules (le défaut d'origine) ; trop large, elle dégage des masses qui ne cachent rien.
 * Le contrat se REMESURE sur le rig, il ne fige aucun nombre.
 */
describe('actorCapsuleOf — la boîte du jeton est calée sur le CORPS DESSINÉ (#907)', () => {
  const dims: Dims = { w: 20, h: 20, rot: 0, view: 'iso' };
  const radiusOf = () => actorCapsuleOf({ x: 5, y: 5, h: 0 }, dims).radius;

  /** Échelle de token d'un combattant : `COMBAT_TOKEN_BASE` × speciesScale × `sizeTokenScale`.
   *  `speciesScale` vaut 1 pour toute espèce jouable — ni `perso.scale` sur la def de créature, ni
   *  `scale` sur la race (`raceAppearance.json`). */
  const tokenScale = (size: SizeCategory) => COMBAT_TOKEN_BASE * sizeTokenScale(size);

  /** Demi-largeur ÉCRAN de la silhouette RÉELLEMENT dessinée par le rig, sur le squelette de
   *  production (`groundedBodySkeleton`, composeRig.tsx) : FK de la pose de repos, extrémités de
   *  chaque os élargies de sa demi-épaisseur, écart maximal à l'axe du bassin — l'axe que le jeton
   *  aligne sur le centre de la tuile. */
  const drawnHalfWidth = (g: GabaritDef, sex: Sexe, build: number, scale: number) => {
    const sk = groundSkeleton(applyBuild(baseSkeleton(g, sex), build));
    const world = worldTransforms(sk, {});
    let half = 0;
    for (const id of BONE_IDS) {
      const bone = sk[id];
      if (bone.thickness === 0 && bone.length === 0) continue;
      const t = bone.thickness / 2;
      for (const along of [0, bone.length])
        for (const across of [-t, t])
          half = Math.max(half, Math.abs(apply(world[id], { x: across, y: along }).x - sk.bassin.pivot.x));
    }
    return half * scale;
  };

  /** Carrures qu'un HÉROS présente à la capsule (elle ne sert que les héros et le meneur du groupe —
   *  `stage/MondeDeCampagne`), de Taille Moyenne ou moindre. La Taille vient du talent d'espèce (`species.json` :
   *  `petit` → Petite, `talents.json`). */
  const HERO_RIGS: { race: string; size: SizeCategory }[] = [
    { race: 'humain', size: 'moyenne' },
    { race: 'nain', size: 'moyenne' },
    { race: 'haut-elfe', size: 'moyenne' },
    { race: 'elfe-sylvain', size: 'moyenne' },
    { race: 'halfling', size: 'petite' },
    { race: 'gnome', size: 'petite' },
  ];
  /** Gabarit résolu comme en production : celui de la race, surchargé par son `gabaritOverride`. */
  const gabaritOf = (raceId: string): GabaritDef => {
    const r = raceById(raceId);
    return { ...gabaritById(r.gabarit), ...(r.gabaritOverride ?? {}) };
  };
  const SEXES = sexeSchema.options;
  const BUILDS = [0, 0.5, 1]; // `Appearance.build` est libre sur [0,1] — la carrure MAXIMALE compte

  const widestHeroBody = () => Math.max(...HERO_RIGS.flatMap(({ race, size }) =>
    SEXES.flatMap((sex) => BUILDS.map((b) => drawnHalfWidth(gabaritOf(race), sex, b, tokenScale(size))))));

  it('couvre le corps dessiné de CHAQUE carrure de héros, jusqu’à la carrure maximale', () => {
    const radius = radiusOf();
    for (const { race, size } of HERO_RIGS)
      for (const sex of SEXES)
        for (const build of BUILDS)
          expect(radius, `${race} ${sex} build=${build}`)
            .toBeGreaterThanOrEqual(drawnHalfWidth(gabaritOf(race), sex, build, tokenScale(size)));
  });

  it('sans doubler ce corps : la capsule n’est pas une colonne de verre', () => {
    expect(radiusOf()).toBeLessThan(widestHeroBody() * 1.3);
  });

  /**
   * LE RAYON EST MÉTRIQUE (#1176, C6). La capsule est de la géométrie de SCÈNE : son rayon se pose en
   * MÈTRES, comme une carrure, et ne se convertit en pixels qu'à la frontière où la géométrie
   * d'occlusion 2D le consomme (son remplacement par un raycast est le ticket #1324). Il valait
   * jusqu'ici une fraction de la largeur d'un LOSANGE de grille — une longueur d'écran pour une
   * dimension de corps.
   */
  it('le rayon se pose en MÈTRES et ne se convertit qu’au consommateur 2D', () => {
    // La toise de référence est celle du corps DESSINÉ sur cette scène, pas un nombre posé.
    const toise = billboardHeightM('heroique', 'personnage');
    expect(ACTOR_CAPSULE_R_M).toBeGreaterThan(0);
    expect(ACTOR_CAPSULE_R_M / toise).toBeLessThan(0.5); // une carrure, pas un cercle circonscrit
    // La capsule RENDUE est exactement ce rayon métrique passé par la cadence px↔m de la projection.
    expect(radiusOf()).toBeCloseTo(ACTOR_CAPSULE_R_M * ISO_PX_PER_M, 12);
    // …et le corps qu'elle doit couvrir, RAMENÉ EN MÈTRES, y tient.
    expect(ACTOR_CAPSULE_R_M).toBeGreaterThanOrEqual(widestHeroBody() / ISO_PX_PER_M);
  });

  /**
   * PROVENANCE ÉPINGLÉE. Le rapport carrure/toise n'est pas une remesure du rig : il conserve le rayon
   * CALIBRÉ de la voie SVG (`TW × 0,37 = 23,68 px`, #907), seulement exprimé en mètres. Cette clause
   * tient ce fait — si quelqu'un remesure vraiment la carrure au rig (le geste de #1324), elle rougit
   * et l'oblige à DIRE que le réglage a changé, au lieu de le laisser glisser sous couvert d'unités.
   */
  it('le rayon conserve le calibrage de la voie SVG — l’unité change, pas le réglage (#907 → #1324)', () => {
    const CALIBRE_SVG_PX = TW * 0.37; // ce que la capsule mesurait avant C6
    expect(radiusOf()).toBeCloseTo(CALIBRE_SVG_PX, 1); // 23,664 contre 23,68 : l'arrondi au millième
    expect(Math.abs(radiusOf() - CALIBRE_SVG_PX)).toBeLessThan(0.02);
  });
});
