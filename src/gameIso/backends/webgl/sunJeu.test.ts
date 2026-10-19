/**
 * COURSE DU SOLEIL DE JEU (#1176, P2-5) — la table de vérité de `sunJeu` : heures clés × nord de scène.
 * Ce qui est tenu ici est le CONTRAT de la courbe, pas ses décimales :
 *  - la nuit n'a pas de soleil, l'arche diurne est fermée aux deux bouts ;
 *  - lever à l'EST, midi au SUD (hémisphère nord du Vieux Monde), coucher à l'OUEST ;
 *  - le NORD de la scène tourne l'azimut d'autant, dans le SENS HORAIRE — un nord à 90° met le soleil
 *    de midi à l'ouest du plan ;
 *  - l'élévation est nulle aux crépuscules, maximale à midi, et passe par l'élévation calibrée du
 *    soleil de PLANCHE (38°) à mi-course.
 * Le soleil de planche, lui, ne bouge pas d'un iota : c'est le dernier test du fichier.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from '../../../noyau/monde/scene';
import { SUN_AZIMUTH, SUN_ELEVATION_DEG, sunRig } from './sceneMeshes';
import { SUN_JEU_MAX_ELEVATION_DEG, sceneSun, sunElevationOf, sunJeu } from './sunJeu';
import * as THREE from 'three';

/** Minute d'horloge d'une heure du jour (l'horloge de jeu compte les minutes depuis l'époque). */
const h = (heure: number, minute = 0) => heure * 60 + minute;

/** Cap CARDINAL de la direction au sol, aux 8 crans (repère three : x = est, z = sud). */
function cardinal(dir: { x: number; z: number }): string {
  const az = (((Math.atan2(dir.x, -dir.z) * 180) / Math.PI) % 360 + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(az / 45) % 8];
}

describe('sunJeu — la course du soleil de JEU (heure × nord de la scène)', () => {
  it('la NUIT n’a pas de soleil : l’arche est fermée, et rien n’en dépasse', () => {
    const heures: [number, number | null][] = [
      [h(0), null], [h(3), null], [h(4, 59), null],
      [h(5), 0], [h(12), 1], [h(19), 0],
      [h(19, 1), null], [h(22), null], [h(23, 59), null],
    ];
    expect(heures.map(([m]) => (sunJeu(m) ? 'soleil' : 'nuit'))).toEqual(
      heures.map(([, v]) => (v == null ? 'nuit' : 'soleil')),
    );
    // Le jour SUIVANT donne la même course (l'heure de jeu est absolue, la course est journalière).
    expect(sunJeu(h(12) + 5 * 24 * 60)).toEqual(sunJeu(h(12)));
  });

  it('une heure NON FINIE n’a pas de soleil (elle poserait la lampe en NaN)', () => {
    // Une `DirectionalLight` à position non finie cesse d'éclairer sans un mot de console : la porte est
    // ici, au calcul de la course, pas au montage.
    expect([sunJeu(Number.NaN), sunJeu(Number.POSITIVE_INFINITY), sunJeu(Number.NEGATIVE_INFINITY)])
      .toEqual([null, null, null]);
    // Un NORD non fini, lui, ne détruit pas la course : il se lit comme le nord implicite.
    expect(sunJeu(h(12), Number.NaN)).toEqual(sunJeu(h(12), 0));
  });

  it('EST au lever, SUD à midi, OUEST au coucher — et l’élévation s’annule aux deux bouts', () => {
    const table = [h(5), h(8, 30), h(12), h(15, 30), h(19)].map((m) => {
      const s = sunJeu(m)!;
      return { cap: cardinal(s.dir), az: +s.azimuthDeg.toFixed(1), elev: +s.elevationDeg.toFixed(2) };
    });
    expect(table).toEqual([
      { cap: 'E', az: 90, elev: 0 },
      { cap: 'SE', az: 135, elev: 38 },
      { cap: 'S', az: 180, elev: +SUN_JEU_MAX_ELEVATION_DEG.toFixed(2) },
      { cap: 'SO', az: 225, elev: 38 },
      { cap: 'O', az: 270, elev: 0 },
    ]);
    // À mi-course, la courbe passe EXACTEMENT par l'élévation calibrée du soleil de planche.
    expect(sunJeu(h(8, 30))!.elevationDeg).toBeCloseTo(SUN_ELEVATION_DEG, 9);
    // L'élévation est bien un MAXIMUM à midi (aucune heure ne monte plus haut).
    const plusHaut = Math.max(...Array.from({ length: 24 * 60 }, (_, m) => sunJeu(m)?.elevationDeg ?? 0));
    expect(plusHaut).toBeCloseTo(SUN_JEU_MAX_ELEVATION_DEG, 9);
    // La direction est UNITAIRE et son élévation est bien celle annoncée (pose ⇄ lecture).
    const midi = sunJeu(h(12))!;
    expect(Math.hypot(midi.dir.x, midi.dir.y, midi.dir.z)).toBeCloseTo(1, 12);
    expect(sunElevationOf(midi.dir)).toBeCloseTo(midi.elevationDeg, 9);
  });

  it('le NORD de la scène tourne l’azimut d’autant, dans le sens HORAIRE', () => {
    const caps = (nord: number) => [h(5), h(12), h(19)].map((m) => cardinal(sunJeu(m, nord)!.dir));
    expect(caps(0)).toEqual(['E', 'S', 'O']);
    expect(caps(90)).toEqual(['S', 'O', 'N']);
    expect(caps(180)).toEqual(['O', 'N', 'E']);
    expect(caps(270)).toEqual(['N', 'E', 'S']);
    // 90° de nord = 90° d'azimut EN PLUS, à toute heure (et un tour complet ne change rien).
    for (const m of [h(6), h(10), h(13, 20), h(18)]) {
      expect(sunJeu(m, 90)!.azimuthDeg).toBeCloseTo((sunJeu(m)!.azimuthDeg + 90) % 360, 9);
      expect(sunJeu(m, 360)!.azimuthDeg).toBeCloseTo(sunJeu(m)!.azimuthDeg, 9);
    }
    // Le nord ne touche QUE l'azimut : l'heure seule décide de la hauteur du soleil.
    expect([0, 90, 180, 270].map((n) => sunJeu(h(12), n)!.elevationDeg)).toEqual(
      [0, 90, 180, 270].map(() => sunJeu(h(12))!.elevationDeg),
    );
  });
});

describe('sceneSun — la porte de la scène (intérieur, nord authoré)', () => {
  const dehors = (northDeg?: number): Scene => ({ ...emptyScene(4, 4), ambiance: 'exterieur', northDeg });
  const dedans = (): Scene => ({ ...emptyScene(4, 4), ambiance: 'interieur' });

  it('un INTÉRIEUR n’a pas de soleil direct, à aucune heure', () => {
    expect([h(5), h(9), h(12), h(18)].map((m) => sceneSun(dedans(), m))).toEqual([null, null, null, null]);
  });

  it('un EXTÉRIEUR suit la course de l’heure, tournée par SON nord', () => {
    expect(cardinal(sceneSun(dehors(), h(12))!.dir)).toBe('S');
    expect(cardinal(sceneSun(dehors(90), h(12))!.dir)).toBe('O');
    expect(sceneSun(dehors(), h(23))).toBeNull(); // dehors, mais de nuit
    // `northDeg` absent = nord implicite (0) : le champ neuf ne change rien aux scènes existantes.
    expect(sceneSun(dehors(), h(9))).toEqual(sceneSun(dehors(0), h(9)));
  });
});

describe('Soleil de PLANCHE — il ne suit NI l’heure NI le nord (c’est son contrat)', () => {
  it('sa direction reste celle des constantes épinglées par les gardes de planche', () => {
    const rig = sunRig(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20)));
    const d = rig.position.clone().sub(rig.target).normalize();
    expect(sunElevationOf(d)).toBeCloseTo(SUN_ELEVATION_DEG, 9);
    expect(cardinal(d)).toBe('SO');
    expect([SUN_AZIMUTH.x, SUN_AZIMUTH.z]).toEqual([-Math.SQRT1_2, Math.SQRT1_2]);
  });

  it('son RÉGLAGE D’OMBRE est celui d’avant le lot, au chiffre près (la planche QC en dépend)', () => {
    // Formule de référence RECOPIÉE (aucun appel au module) : distance = 2r + marge, frustum serré sur
    // la sphère englobante, biais de normale en TEXELS. Si `sunRigFrom` change, la planche change —
    // c'est ce que ce test empêche de faire par inadvertance.
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20));
    const rig = sunRig(box);
    const centre = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const elev = (38 * Math.PI) / 180;
    const dir = new THREE.Vector3(-Math.SQRT1_2 * Math.cos(elev), Math.sin(elev), Math.SQRT1_2 * Math.cos(elev)).normalize();
    const distance = r * 2 + 4;
    expect(rig.position.toArray().map((v) => +v.toFixed(9)))
      .toEqual(centre.clone().addScaledVector(dir, distance).toArray().map((v) => +v.toFixed(9)));
    expect(rig.target.toArray()).toEqual(centre.toArray());
    expect([rig.span, rig.near, rig.far, rig.mapSize, rig.normalBias])
      .toEqual([r, Math.max(0.1, distance - r - 4), distance + r + 4, 2048, ((2 * r) / 2048) * 3]);
  });
});
