/**
 * POLITIQUE DE VUE (#1176, P3-5) — les verdicts de STYLE d'un regard, et le RÉGIME de lumière qu'un
 * de ces verdicts commande. Ce fichier tient trois choses :
 *  - les contrats POSITIFS par regard (plateau iso, plateau du dessus, première personne) ;
 *  - la FRONTIÈRE : la politique ne dit rien de la projection — les vérités géométriques
 *    (`isSquareView` de l'authoring SVG) ne lui demandent rien et ne lui doivent rien ;
 *  - le RÉGIME SANS SOLEIL, dit UNE fois dans `stageLightScalars` : `fade = 0`, donc `lit` faux,
 *    ambiante PLEINE, aucune part solaire dans l'exposition, modelé de forme PLEIN et disque de
 *    contact des pions rendu. Aucun consommateur n'a de porte à poser : c'est la thèse du lot.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { setNorthDeg } from '../../noyau/sceneEdit';
import { ambientScalar } from '../../noyau/monde/vision';
import { AMBIENT_INTENSITY, shadeSousSoleil, wantsContactShadow } from '../backends/webgl/sceneMeshes';
import { ambianceLuminance } from '../catalog/ambiance';
import { stageLightScalars, stageLights } from './stageLights';
import { viewPolicy } from './viewPolicy';

const MIDI = 12 * 60;
const NUIT = 23 * 60;
const BOITE = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20));
const dehors = (): Scene => setNorthDeg({ ...emptyScene(6, 6), ambiance: 'exterieur' }, 0);

describe('viewPolicy — un regard, ses verdicts de style', () => {
  it('PLATEAU ISO : tout se montre — toits, soleil, nappes, précipitations, murs PEINTS, sans grille', () => {
    expect(viewPolicy({ view: 'iso' })).toEqual({
      toitsVisibles: true,
      etageIsole: false,
      nappesMonde: true,
      precipitations: true,
      ombreSoleil: true,
      mursAuTrait: false,
      grilleTactique: false,
      montesDissocies: false,
      pionsEnDisques: false,
    });
    // `view` absent = le losange : le défaut de `Dims.view`, pas un cas particulier.
    expect(viewPolicy({})).toEqual(viewPolicy({ view: 'iso' }));
  });

  it('PLATEAU DU DESSUS : découvert permanent, régime sans soleil, murs au TRAIT et grille de cases', () => {
    expect(viewPolicy({ view: 'top' })).toEqual({
      toitsVisibles: false,
      etageIsole: true,
      nappesMonde: false,
      precipitations: false,
      ombreSoleil: false,
      mursAuTrait: true,
      grilleTactique: true,
      montesDissocies: true,
      pionsEnDisques: true,
    });
  });

  it('PREMIÈRE PERSONNE : inchangée — toits, soleil et pluie comme sur le plateau, jamais de nappe', () => {
    const pov = viewPolicy({ pov: true });
    expect([pov.toitsVisibles, pov.ombreSoleil, pov.precipitations, pov.etageIsole, pov.montesDissocies])
      .toEqual([true, true, true, false, false]);
    // On regarde le monde par les yeux d'un pion : il n'y a pas de plateau où en poser.
    expect(pov.pionsEnDisques).toBe(false);
    expect(pov.nappesMonde).toBe(false); // le POV a sa brume de DISTANCE, pas des nappes empilées
    // La première personne n'est pas un plan : ni trait de mur, ni grille de cases.
    expect([pov.mursAuTrait, pov.grilleTactique]).toEqual([false, false]);
    // La projection de plateau ne décide plus rien sous ce regard : le POV n'en a pas.
    expect(viewPolicy({ pov: true, view: 'top' })).toEqual(pov);
  });

  it('FRONTIÈRE : la politique ne connaît QUE le regard — ni scène, ni heure, ni dimensions', () => {
    // Deux regards identiques rendent des verdicts identiques, quoi qu'il arrive ailleurs : c'est ce
    // qui rend le module pur, et ce qui interdit d'y faire entrer une vérité de projection.
    expect(viewPolicy({ view: 'top' })).toEqual(viewPolicy({ view: 'top' }));
  });
});

describe('RÉGIME SANS SOLEIL — la loi se dit dans les lampes, les consommateurs suivent', () => {
  const scalaires = (ombreSoleil: boolean) =>
    stageLightScalars({ scene: dehors(), gameTime: MIDI, lightLevel: null, ombreSoleil });
  const lampes = (ombreSoleil: boolean) =>
    stageLights({ scene: dehors(), gameTime: MIDI, lightLevel: null, shadowBox: BOITE, ombreSoleil });

  it('le régime est COMPLET, pas une lampe amputée : fondu à zéro, éteint, aucune part solaire', () => {
    const iso = scalaires(true);
    const top = scalaires(false);
    expect([iso.fade, iso.lit], 'témoin : à midi dehors, l’iso a bien un soleil PLEIN').toEqual([1, true]);
    expect([top.fade, top.lit, top.sunIntensity]).toEqual([0, false, 0]);
    expect(lampes(false).sun).toBeNull();
    expect(lampes(true).sun).not.toBeNull();
  });

  it('l’ambiante REMONTE à sa part pleine — l’exposition est celle du palier seul', () => {
    const top = scalaires(false);
    // Le régime sans soleil est celui, déjà tenu, de l'intérieur et de la nuit : l'ambiante porte la
    // scène ENTIÈRE (part 1, non `AMBIENT_INTENSITY`), et l'exposition vaut le palier × météo.
    expect(top.ambianceLum).toBeCloseTo(ambianceLuminance(1), 12);
    expect(top.surfaceLuminance).toBeCloseTo(top.ambianceLum * top.meteo.dim, 12);
    expect(top.ambientIntensity).toBeCloseTo(top.surfaceLuminance * Math.PI, 12);
    // …et c'est bien un régime DIFFÉRENT de l'iso de midi, pas la même frame amputée.
    expect(scalaires(true).ambientIntensity).toBeCloseTo(top.ambientIntensity * AMBIENT_INTENSITY, 12);
    expect(scalaires(true).surfaceLuminance).toBeGreaterThan(top.surfaceLuminance);
  });

  it('MODELÉ DE FORME plein et DISQUE DE CONTACT rendu : les deux descendent du même régime', () => {
    const top = scalaires(false);
    // `shadeSousSoleil` est le NEUTRE en plein soleil (le facteur de famille s'efface, la
    // directionnelle modèle seule) et l'IDENTITÉ sans lui : le monde du dessus garde donc son modelé
    // d'orientation, sans aucune porte au site d'appel de `applyVisibilityTint`.
    expect(shadeSousSoleil(0.62, top.fade)).toBe(0.62);
    expect(shadeSousSoleil(0.62, scalaires(true).fade)).toBe(1);
    // …et le socle de figurine revient sur les BILLBOARDS de ce régime (intérieur, nuit, plateau iso),
    // exactement là où l'ombre portée cesse d'ancrer le corps. La vue du DESSUS, elle, n'a plus aucun
    // billboard de personnage (`pionsEnDisques`) : son pion porte son propre socle, en SVG.
    expect(wantsContactShadow('personnage', top.lit)).toBe(true);
    expect(wantsContactShadow('personnage', scalaires(true).lit)).toBe(false);
  });

  it('le PALIER jour/nuit ne dépend d’aucun regard : la nuit reste la nuit', () => {
    expect(ambientScalar(dehors(), NUIT, null)).toBeLessThan(ambientScalar(dehors(), MIDI, null));
    expect(scalaires(false).ambianceLum).toBe(scalaires(true).ambianceLum);
    // Et de NUIT, les deux regards rendent le MÊME régime : il n'y avait déjà plus de soleil.
    const nuit = (ombreSoleil: boolean) =>
      stageLightScalars({ scene: dehors(), gameTime: NUIT, lightLevel: null, ombreSoleil });
    expect(nuit(false).surfaceLuminance).toBe(nuit(true).surfaceLuminance);
  });

  it('la porte est un DÉFAUT ouvert : un appelant qui n’en dit rien garde son soleil', () => {
    expect(stageLights({ scene: dehors(), gameTime: MIDI, lightLevel: null, shadowBox: BOITE }).sun).not.toBeNull();
  });
});
