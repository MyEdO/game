import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan, OPERA_WALL_LEGEND } from '../../scenes/opera/floorplan';
import { heightAt } from '../../noyau/monde/scene';
import { buildWalls } from './walls';
import { buildRoofs, clearedSpace } from '../../noyau/monde/volume/toits';

/**
 * Le théâtre est un CORPS architectural (`MapSpec.architecture`) : la loi de dégagement (`clearedSpace`,
 * `noyau/monde/volume/toits.ts`) y trouve, autour d'un allié, la pièce qu'il occupe et la couche d'étage qui le coiffe (#1771).
 * La géométrie du plan : `scenes/opera/floorplan.test.ts`.
 */
describe('plan de l’Opéra — corps architectural et loi de dégagement', () => {
  const s = buildOperaFloorplan();

  it('DÉGAGEMENT en salle verte (3,9,z0) : la PIÈCE se dégage, le couvercle se lève', () => {
    const cleared = clearedSpace(s, [{ x: 3, y: 9, z: 0 }]);
    // L'allié occupe une PIÈCE déclarée : la loi dégage son aire ENTIÈRE, pas l'emprise du bâtiment.
    expect([...cleared.zoneIds]).toContain('salle-verte');
    expect(cleared.roomlessCells.size, 'aucun repli sur l’emprise : la pièce a tranché').toBe(0);
    // COUVERCLE : la case (3,9) au niveau STRICTEMENT au-dessus du sien.
    expect(cleared.overheadCells.has('3,9,1'), 'la couche d’étage qui le surplombe se lève').toBe(true);
  });

  it('DÉGAGEMENT en LOGE de flanc (5,13,z1) : l’allié ne dégage QUE sa loge, pas l’anneau entier', () => {
    // DoD #1780 : les loges du folio 39 sont des pièces CLOSES, une par bande — un allié en loge ne doit
    // pas ouvrir la bande voisine ni les balcons. C'est `roomZoneIds` de l'étage qui le tient.
    const cleared = clearedSpace(s, [{ x: 5, y: 13, z: 1 }]);
    expect([...cleared.zoneIds]).toEqual(['loge-gauche-1']);
    expect(cleared.roomlessCells.size, 'aucun repli sur l’emprise : la loge a tranché').toBe(0);
  });
});

/**
 * #1180 — l'apparence d'un mur est une DONNÉE de la carte, la hauteur est de la géométrie. L'opéra
 * authore UNE apparence d'arête et une seule (`MapSpec.wallLegend` = `OPERA_WALL_LEGEND`, char `w`,
 * sans structure ni PV) : les refends entre loges voisines des deux flancs de l'étage la rendent, et
 * TOUT le reste du bâti — enveloppe, refends côté couloir, portes, rez entier — rend le mur nu
 * `plain`, y compris les arêtes de l'étage assises en hauteur.
 *
 * La garde porte sur les ÉLÉMENTS RENDUS, jamais sur `scene.walls`, et sa population est TOUT ce dont
 * la matière sort de la loi d'apparence d'arête (`edgeAppearance`, `noyau/monde/volume/structures`) :
 *  - `buildWalls` — les ARÊTES `wall:` (`wallGeometry`) et les COUTURES de nappes `seam:`
 *    (`roofSeamGeometry` → `closureAppearance`), matière lue sur `el.appearance` ;
 *  - `buildRoofs` — les PIGNONS de comble, `kind:'roof'` (`gableEnds` → `closureAppearance`), dont la
 *    matière de mur ne vit PAS dans `el.appearance` mais dans la face `material.domain === 'structure'`.
 * L'opéra coiffe son corps d'une CROUPE (`profile: 'hip'`, cf. « TOITURE DÉRIVÉE », `scenes/opera/floorplan.test.ts`) : une croupe
 * n'a aucune fermeture de comble, et une nappe seule n'a aucune couture avec une voisine. Ces deux familles
 * sont LUES quand même et leur compte va au MESSAGE (`diag`) : le contrat de matière porte sur la population
 * effectivement rendue, quelle que soit la famille qui la porte.
 */
describe('plan de l’Opéra — apparence des murs (#1180)', () => {
  const s = buildOperaFloorplan();
  const murs = buildWalls(s, 'jeu');
  const aretes = murs.filter((el) => el.key.startsWith('wall:'));
  const coutures = murs.filter((el) => el.key.startsWith('seam:'));
  const pignons = buildRoofs(s).flatMap((el) =>
    el.faces.filter((f) => f.material.domain === 'structure').map((f) => ({ key: el.key, appearance: f.material.id })));
  const rendus = [...aretes, ...coutures].map((el) => ({ key: el.key, appearance: el.appearance })).concat(pignons);
  const diag = `${aretes.length} arêtes, ${coutures.length} coutures, ${pignons.length} pignons`;

  it('la garde VOIT toute la population rendue : arêtes, coutures de nappes, pignons', () => {
    // Un élément de mur d'une AUTRE famille de clé échapperait au contrat sans que rien ne bronche.
    expect(murs.filter((el) => !el.key.startsWith('wall:') && !el.key.startsWith('seam:')).map((el) => el.key),
      `famille de clé non couverte (${diag})`).toEqual([]);
    // TÉMOIN NOMMÉ de la famille PEUPLÉE : la garde ne peut pas devenir vide en silence — les familles
    // dépeuplées (coutures, pignons) disent leur zéro par `diag`, qui accompagne chaque assertion.
    const arete = rendus.find((el) => el.key === 'wall:0,1,E,1'); // z1, assise en hauteur, nue
    expect(arete, `arête témoin de l’étage absente du rendu (${diag})`).toBeDefined();
    expect(arete!.appearance).toBe('plain');
    expect(rendus.length, `aucun élément de mur rendu — le contrat de matière ne mesurerait rien (${diag})`).toBeGreaterThan(0);
  });

  it('les arêtes NUES assises en hauteur rendent le mur nu — la cote ne fortifie plus', () => {
    const nuesHautes = new Set((s.walls ?? [])
      .filter((w) => !w.structure && !w.appearance && heightAt(s, w.x, w.y, w.z ?? 0) > 1)
      .map((w) => `wall:${w.x},${w.y},${w.side},${w.z ?? 0}`));
    expect(nuesHautes.has('wall:0,1,E,1'), 'l’arête témoin est bien nue ET assise en hauteur').toBe(true);
    const offenseurs = rendus.filter((el) => nuesHautes.has(el.key) && el.appearance !== 'plain');
    expect(offenseurs.map((el) => el.key),
      `arête(s) nue(s) en hauteur fortifiée(s) par leur cote — ${nuesHautes.size} arêtes nues en hauteur`).toEqual([]);
  });

  it('les arêtes du char `w` rendent l’apparence de la légende, toutes les autres rendent le mur nu', () => {
    const bois = OPERA_WALL_LEGEND.w.appearance;
    // ATTENDU dérivé de la carte compilée (le char `w` → `WallSeg.appearance`), jamais d'une liste tenue à
    // la main : rebâtir l'ASCII déplace l'attendu avec le plan.
    const authorees = (s.walls ?? []).filter((w) => w.appearance === bois)
      .map((w) => `wall:${w.x},${w.y},${w.side},${w.z ?? 0}`).sort();
    expect(authorees.length, `la carte n’authore aucune arête « ${bois} » — la garde ne mesurerait rien (${diag})`)
      .toBeGreaterThan(0);
    const enBois = rendus.filter((el) => el.appearance === bois).map((el) => el.key).sort();
    expect(enBois, `arêtes rendues en « ${bois} » ≠ arêtes authorées (${authorees.length} authorées, ${diag})`)
      .toEqual(authorees);
    const offenseurs = rendus.filter((el) => el.appearance !== 'plain' && el.appearance !== bois);
    expect(offenseurs.map((el) => `${el.key} → ${el.appearance}`),
      `élément(s) rendu(s) hors du mur nu et hors de la légende d’arête (${diag})`).toEqual([]);
  });
});
