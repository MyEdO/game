import { describe, it, expect } from 'vitest';
import {
  buildOperaFloorplan, puitsRim, ZONES_REZ, ZONES_ETAGE,
  OPERA_WALL_LEGEND, OPERA_ZONE_SEEDS, OPERA_ZONE_LAYERS, OPERA_BASE, OPERA_LEGEND,
} from './floorplan';
import { ETAGE_ASCII } from './floorplan.ascii';
import { walledRowsOf, zonesFromSeeds } from '../../state/asciiMap';
import { scenarioEntities } from './furnished';
import { scenario as operaPlan } from '../test-scenarios/opera-plan';
import { tileAt, heightAt, isWalkable, wallBetween, type Scene } from '../../state/scene';
import { reachable, walkComponentAt, type Pt } from '../../state/path';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { unreachableDescriptiveZones, reachedFloors } from '../../state/mapQC';
import { scenePlanDefects } from '../../state/planDefects';
import { METRES_PER_LEVEL } from '../../state/relief';
import { buildWalls } from '../../gameIso/builders/walls';
import { buildRoofs, clearedSpace } from '../../gameIso/builders/roofs';

/** Case TÉMOIN au cœur du PUITS (l'ovale du folio 39, qui court du MUR DE FOND DE SCÈNE — rangée 1, sous le
 *  mur nord, au NORD des coulisses — au bas de la salle)
 *  — lue par la garde « PUITS CENTRAL OVALE » ET par la composante connexe de vide du dernier describe :
 *  UNE seule ancre, faute de quoi un recalage du puits n'en déplacerait qu'une des deux. */
const PUITS_TEMOIN = { x: 22, y: 28 };

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est COMPILÉ par `buildScene(MapSpec)` depuis l'ASCII box-drawing
 * (`floorplan.ascii.ts`) via `MapSpec.walled` (2 grilles = rez z0 + étage z1) + `MapSpec.relief` (l'ÉLÉVATION
 * MÉTRIQUE, seule donnée non portée par l'ASCII) : deux COUCHES (`layers`), scène surélevée (+1 m) et fosse
 * en contrebas (−1 m) portées par `Layer.height`, parterre en ÉVENTAIL bloquant, salles latérales desservies
 * par des portes, puits central OVALE vide à l'étage (il monte jusqu'au mur NORD, que ferme le MUR DE FOND
 * DE SCÈNE : l'axe de la scène ne porte aucun plancher à l'étage),
 * loges de flanc en quatre bandes et balcons en fer à cheval. L'étage (loges
 * assises à `ETAGE_M`) se rejoint par DEUX RAMPES d'angle (cases de hauteur croissante, puits TROUÉ dans l'ASCII même) —
 * AUCUN escalier explicite : la connectivité verticale s'auto-dérive du dénivelé (`surfaceLink`).
 */
describe('plan de l’Opéra — géométrie (relief unifié)', () => {
  const s = buildOperaFloorplan();
  const W = s.dimensions.w, H = s.dimensions.h;
  const AX = Math.round((W - 1) / 2); // axe de symétrie (22)
  const tilesOf = (z: number) => s.layers.find((l) => l.z === z)!.tiles;

  it('grille DÉRIVÉE du plan : 44×60, nettement plus haute que large', () => {
    expect(W).toBe(44);
    expect(H).toBe(60);
    expect(H).toBeGreaterThan(W);
  });

  it('deux COUCHES (rez z0 + étage z1) partageant les dimensions', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(tilesOf(0)).toHaveLength(W * H);
    expect(tilesOf(1)).toHaveLength(W * H);
  });

  it('SCÈNE surélevée (hauteur > 0) et FOSSE en contrebas (< 0), portées par Layer.height', () => {
    expect(tileAt(s, AX, 8, 0)).toBe('planches'); // scène
    expect(heightAt(s, AX, 8, 0)).toBeGreaterThan(0);
    expect(tileAt(s, AX, 17, 0)).toBe('planches'); // fosse d'orchestre
    expect(heightAt(s, AX, 17, 0)).toBeLessThan(0);
  });

  it('l’ÉTAGE (galerie de loges) se pose un PLEIN NIVEAU au-dessus du point HAUT du rez (la scène)', () => {
    const scene = heightAt(s, AX, 8, 0); // planches de la scène, le plancher le plus haut du rez
    expect(heightAt(s, 8, 3, 1)).toBe(scene + METRES_PER_LEVEL); // 30 Loge royale, z1
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => tilesOf(0).filter((t, i) => Math.floor(i / W) === y && t === 'plancher').length;
    expect(widthAt(42)).toBeGreaterThan(widthAt(18)); // le fond est plus large que l'avant
  });

  it('éventail : la cloison parterre↔salles latérales BLOQUE (pas de mur fantôme à traverser)', () => {
    const doorRow = Math.floor((20 + 43) / 2); // porte parterre↔côtés à mi-hauteur
    for (let y = 21; y <= 42; y++) {
      if (y === doorRow) continue;
      const row = tilesOf(0).slice(y * W, y * W + W);
      const lp = row.indexOf('plancher');
      const rp = row.lastIndexOf('plancher');
      expect(wallBetween(s, lp, y, lp - 1, y)).toBe(true); // on ne sort pas à gauche
      expect(wallBetween(s, rp, y, rp + 1, y)).toBe(true); // ni à droite
    }
  });

  it('PUITS CENTRAL OVALE : le cœur du parterre est VIDE au premier étage (ouvert sur le rez)', () => {
    expect(tileAt(s, PUITS_TEMOIN.x, PUITS_TEMOIN.y, 1)).toBe('vide');     // centre du puits ovale
    expect(tileAt(s, PUITS_TEMOIN.x, PUITS_TEMOIN.y, 0)).toBe('plancher'); // parterre en dessous
  });

  it('LOGE ROYALE (marbre) à l’étage : HORS de l’axe, contre l’antichambre ducale du coin nord-ouest', () => {
    // NADJ 08 folio 39 : l'axe de la scène est le PUITS (cage de scène ouverte sur le parterre) ; 30 Loge
    // royale est au flanc GAUCHE, entre 32 Antichambre ducale et le puits.
    expect(tileAt(s, 8, 3, 1)).toBe('marbre');
  });

  it('AXE de la scène : du mur nord au bas du puits, l’étage n’y porte AUCUN terrain marchable', () => {
    // NADJ 08 folio 39 : sous le mur nord, la cage de scène est fermée par le MUR DE FOND DE SCÈNE ('#'), puis
    // s'ouvre en PUITS sur le parterre — un seul point de l'axe suffirait à rendre les deux flancs
    // communicants par le haut. Le contrat court donc sur TOUTE la colonne, sans cardinal : il s'arrête au
    // premier plancher rencontré, et doit avoir dépassé la case témoin du puits.
    const axe: string[] = [];
    for (let y = 1; y < H && !isWalkable(s, AX, y, 1); y++) axe.push(`${AX},${y}=${tileAt(s, AX, y, 1)}`);
    expect(tileAt(s, AX, 1, 1), 'contre le mur nord : la masse du fond de scène').toBe('mur');
    expect(axe.filter((c) => !c.endsWith('=mur') && !c.endsWith('=vide')),
      `l’axe ne porte que maçonnerie et puits : ${axe.join(' ')}`).toEqual([]);
    expect(axe.length, `course non marchable de l’axe : ${axe.join(' ')}`).toBeGreaterThan(PUITS_TEMOIN.y);
    expect(tileAt(s, AX, PUITS_TEMOIN.y, 1), 'la course englobe le cœur du puits').toBe('vide');
  });

  it('SALONS de l’étage : les deux refends de la façade courbe s’ouvrent à la MÊME rangée', () => {
    // NADJ 08 folio 39 : deux portes blanches SYMÉTRIQUES, une par refend (38|37 et 37|39), au même
    // niveau. Le contrat lit le refend de gauche et son MIROIR autour de l'axe — il ne nomme aucune
    // rangée, si bien que recaler la porte au plan la déplace des deux côtés ou rougit.
    const mir = (x: number) => W - 1 - x;
    const ouvertures = (a: number, b: number) => {
      const out: number[] = [];
      for (let y = 50; y < H; y++) if (tileAt(s, a, y, 1) !== 'vide' && !wallBetween(s, a, y, b, y, 1)) out.push(y);
      return out;
    };
    const gauche = ouvertures(12, 13);
    const droite = ouvertures(mir(13), mir(12));
    expect(gauche.length, `le refend 38|37 ne s’ouvre nulle part (droite : ${droite.join(',')})`).toBeGreaterThan(0);
    expect(gauche, `rangées ouvertes — 38|37 : ${gauche.join(',')} · 37|39 : ${droite.join(',')}`).toEqual(droite);
  });

  it('ENTRÉES : portes d’honneur (façade) + entrée des artistes, débouchant à l’intérieur', () => {
    expect(s.entryPoints?.['entree-principale']).toBeDefined();
    expect(s.entryPoints?.['entree-artistes']).toBeDefined();
    const dx = 17, dy = 58; // Porte des Dames (façade sud)
    expect(wallBetween(s, dx, dy, dx, dy + 1)).toBe(false); // arête sud = porte (franchissable)
    expect(isWalkable(s, dx, dy, 0)).toBe(true);            // le seuil est marchable
  });

  it('CONNEXE par RAMPE : depuis le foyer on gagne la GALERIE (z1) — toute loge est atteignable, sans escalier', () => {
    // Départ : le seuil d'honneur (foyer, z0). `reachable` traverse portes ET rampes (surfaceLink), donc
    // change de couche là où une rampe rejoint la galerie à hauteur ÉGALE — plus aucun escalier explicite.
    const start: Pt = { ...s.entryPoints!['entree-principale'], z: 0 };
    expect(isWalkable(s, start.x, start.y, 0), 'le seuil de départ est marchable').toBe(true);
    const R = reachable(s, start, 99999, { blocked: new Set<string>() });
    const key = (x: number, y: number, z: number) => (z ? `${x},${y},${z}` : `${x},${y}`);
    // témoins z0 : scène (surélevée +1 m, rejointe par rampe douce) et parterre (sol).
    expect(R.has(key(AX, 8, 0)), 'scène atteignable').toBe(true);
    expect(R.has(key(AX, 28, 0)), 'parterre atteignable').toBe(true);
    // LOGES : la galerie (z1) est jointe DEPUIS LE REZ par les rampes — aucune loge scellée.
    let sealedUpper = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (isWalkable(s, x, y, 1) && !R.has(key(x, y, 1))) sealedUpper++;
    expect(sealedUpper, 'toute case de l’étage (loges) est atteignable depuis le foyer par la rampe').toBe(0);
  });
});

/**
 * Le théâtre est un CORPS architectural (`MapSpec.architecture`) : sans lui, `buildScene` ne dérive
 * AUCUNE masse (`deriveArchitectureMasses` n'itère que `scene.architecture`) et la loi de dégagement
 * (`clearedSpace`, `gameIso/builders/roofs.ts`) ne trouve, autour d'un allié posé au rez, ni pièce ni
 * emprise : elle le déclare à ciel ouvert et ne lève rien — le groupe reste en silhouette sous une
 * couche d'étage qui le coiffe (#1771).
 */
describe('plan de l’Opéra — corps architectural et loi de dégagement', () => {
  const s = buildOperaFloorplan();
  // La carte n'a pas de `heroStart` (`startOf` rend `null`) : les scénarios posent le groupe. Le départ
  // de QC est donc le seuil d'honneur, l'entrée par laquelle un joueur entre.
  const start = { ...s.entryPoints!['entree-principale'], z: 0 };
  const W = s.dimensions.w, H = s.dimensions.h;

  it('CONSTRUCTION : un corps unique NON BORNÉ ne déclenche aucun résiduel (`validateArchitectureResiduals`)', () => {
    expect(() => buildOperaFloorplan()).not.toThrow();
    expect(s.architecture?.map((b) => b.id)).toEqual(['opera-staatsoper']);
    expect(s.architecture?.[0].storeys.map((st) => st.z)).toEqual([0, 1]);
  });

  it('QC de plan : aucune zone descriptive inatteignable, les deux étages habités sont atteints', () => {
    expect(unreachableDescriptiveZones(s, start)).toEqual([]);
    expect([...reachedFloors(s, start)].sort()).toEqual(expect.arrayContaining([0, 1]));
  });

  it('TOITURE DÉRIVÉE : les masses coiffent le plancher RÉEL et rien que lui — aucune sur le vide', () => {
    // Contrat POSITIF, la forme va au MESSAGE : une masse est une conséquence du bâti, pas un cardinal à
    // figer. Ce qui est exigible : (a) tout est dérivé du corps, (b) aucune masse ne coiffe une case que
    // les DEUX niveaux laissent `vide` — une poche fantôme close par des arêtes d'angle (cases comptées
    // par `interiorCells`, `realFloorAt(0)`, `sceneEdit.ts`) se toiturerait alors au-dessus du dehors —,
    // (c) tout plancher d'étage est coiffé, sans quoi un allié de l'étage resterait à ciel ouvert.
    const masses = effectiveArchitecture(s).flatMap((b) => b.masses);
    const cases = (m: (typeof masses)[number]) => m.footprint.reduce((n, r) => n + r.w * r.h, 0);
    const forme = masses.map((m) => `z${m.z} ${m.levels}niv ${m.profile} ${cases(m)} cases`).join(' · ');
    expect(masses.length, `le corps porte au moins une masse : ${forme}`).toBeGreaterThan(0);
    expect(masses.filter((m) => !m.derived).map((m) => `z${m.z} ${m.profile}`),
      `masse(s) AUTHORÉE(s) alors que la dérivation fait foi — ${forme}`).toEqual([]);
    const couvertes = new Set<string>();
    const surVide: string[] = [];
    for (const m of masses)
      for (const r of m.footprint)
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) {
            couvertes.add(`${x},${y}`);
            if (tileAt(s, x, y, 0) === 'vide' && tileAt(s, x, y, 1) === 'vide') surVide.push(`${x},${y}`);
          }
    expect(surVide, `masse(s) coiffant une case VIDE aux deux niveaux — ${forme}`).toEqual([]);
    const decouvert: string[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (tileAt(s, x, y, 1) !== 'vide' && !couvertes.has(`${x},${y}`)) decouvert.push(`${x},${y}`);
    expect(decouvert, `plancher d’étage NON coiffé — ${forme}`).toEqual([]);
  });

  it('LÉGENDES de zone : les chars du rez et de l’étage sont DISJOINTS', () => {
    // `zoneLegend` est indexé par le SEUL char (`mapSpec.ts` : `zoneLegend[b.char].id`) : un char partagé
    // donnerait la pièce d'un niveau à l'autre, en silence, à la fusion `{ ...ZONES_REZ, ...ZONES_ETAGE }`.
    const communs = Object.keys(ZONES_REZ).filter((ch) => ch in ZONES_ETAGE);
    expect(communs, `char(s) de zone partagé(s) entre les deux niveaux : ${communs.join(' ')}`).toEqual([]);
  });

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

  it('chaque PIÈCE est d’UN SEUL TENANT : aucun pas de son aire ne traverse un mur', () => {
    // Le calque de zones est LIBRE, l'ASCII porte les murs : rien ne les tient ensemble sinon ce test.
    // Une pièce morcelée est une pièce fausse — la loi de dégagement dégage l'aire ENTIÈRE de la zone
    // occupée (`clearedSpace` → `interiorZoneTilesById`), donc un allié enfermé dans l'îlot A ouvrirait
    // aussi l'îlot B, de l'autre côté d'un mur qu'il n'a pas franchi.
    const morcelees: string[] = [];
    for (const zone of s.effectZones ?? []) {
      const z = zone.z ?? 0;
      const cells = new Set((zone.tiles ?? []).map((t) => `${t.x},${t.y}`));
      if (!cells.size) continue;
      const [x0, y0] = [...cells][0].split(',').map(Number);
      const vus = new Set([`${x0},${y0}`]);
      const q = [[x0, y0] as [number, number]];
      while (q.length) {
        const [cx, cy] = q.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = `${cx + dx},${cy + dy}`;
          if (!cells.has(k) || vus.has(k) || wallBetween(s, cx, cy, cx + dx, cy + dy, z)) continue;
          vus.add(k);
          q.push([cx + dx, cy + dy]);
        }
      }
      if (vus.size !== cells.size)
        morcelees.push(`« ${zone.id} » (z${z}) : ${vus.size}/${cells.size} cases jointes — îlot(s) séparé(s) par un mur : ${[...cells].filter((k) => !vus.has(k)).join(' ')}`);
    }
    expect(morcelees, `pièce(s) morcelée(s) par un mur de l’ASCII :\n${morcelees.join('\n')}`).toEqual([]);
  });

  it('les `roomZoneIds` d’un étage COUVRENT exactement les pièces de son niveau', () => {
    // ÉGALITÉ, pas inclusion : une pièce oubliée au corps n'est plus coiffée par sa nappe
    // (`massRoomZoneIds`/`cutawayForSection`) alors que la loi de dégagement, elle, la connaît encore par
    // `effectZones` — un trou qu'une simple vérification d'existence laisse passer en silence.
    for (const storey of s.architecture![0].storeys) {
      const declarees = (s.effectZones ?? []).filter((zone) => (zone.z ?? 0) === storey.z).map((zone) => zone.id);
      expect(declarees.length, `l’étage ${storey.id} porte des pièces`).toBeGreaterThan(0);
      expect([...storey.roomZoneIds].sort(), `pièces de ${storey.id}`).toEqual([...declarees].sort());
    }
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
 * la matière sort de la loi d'apparence d'arête (`edgeAppearance`, `gameIso/builders/roofs.ts`) :
 *  - `buildWalls` — les ARÊTES `wall:` (`wallGeometry`) et les COUTURES de nappes `seam:`
 *    (`roofSeamGeometry` → `closureAppearance`), matière lue sur `el.appearance` ;
 *  - `buildRoofs` — les PIGNONS de comble, `kind:'roof'` (`gableEnds` → `closureAppearance`), dont la
 *    matière de mur ne vit PAS dans `el.appearance` mais dans la face `material.domain === 'structure'`.
 * L'opéra coiffe son corps d'une CROUPE (`profile: 'hip'`, cf. « TOITURE DÉRIVÉE » ci-dessus) : une croupe
 * n'a aucune fermeture de comble, et une nappe seule n'a aucune couture avec une voisine. Ces deux familles
 * sont LUES quand même et leur compte va au MESSAGE (`diag`) : le contrat de matière porte sur la population
 * effectivement rendue, quelle que soit la famille qui la porte.
 */
describe('plan de l’Opéra — apparence des murs (#1180)', () => {
  const s = buildOperaFloorplan();
  const murs = buildWalls(s);
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

  /**
   * `OPERA_WALL_LEGEND` est PORTEUSE du cloisonnement, pas décorative : le char `w` ne vaut mur que pour
   * le lecteur à qui la table est passée. Omise à un seul des lecteurs de la grille, la pièce fuit à
   * travers le refend et deux graines se disputent la même case (`zonesFromSeeds`, `state/asciiMap.ts`).
   */
  it('la même légende va à TOUS les lecteurs de la grille : sans elle, le zonage de l’étage fuit', () => {
    const rows = walledRowsOf(ETAGE_ASCII, s.dimensions.w);
    expect(() => zonesFromSeeds(rows, OPERA_BASE, OPERA_LEGEND, OPERA_ZONE_SEEDS.z1))
      .toThrow(/revendiquée/);
    expect(zonesFromSeeds(rows, OPERA_BASE, OPERA_LEGEND, OPERA_ZONE_SEEDS.z1, { wallLegend: OPERA_WALL_LEGEND }))
      .toBe(OPERA_ZONE_LAYERS.z1);
  });
});

/**
 * #1179 — le pourtour du PUITS n'est pas un mur : le plan (NADJ 08 folio 39) y montre un bord de balcon
 * OUVERT sur la salle, donc la seule frontière `plancher | vide`, sans arête. Les refends de loge qui
 * meurent sur ce bord ne sont pas des impasses — un quadrant infranchissable n'offre aucun bout à
 * contourner (`auditWallDeadEndsInside`, famille 11).
 */
describe('plan de l’Opéra — l’ovale de l’étage est fermé (#1179)', () => {
  const s = buildOperaFloorplan();
  const W = s.dimensions.w, H = s.dimensions.h;
  const impasses = (z: number) => scenePlanDefects(s)
    .filter((d) => d.family === 'mur-en-impasse' && d.at.z === z)
    .map((d) => (d.at.kind === 'edge' ? `${d.at.x},${d.at.y}${d.at.side}` : d.at.kind));

  it('ÉTAGE : plus AUCUN mur en impasse — aucun bout libre, aucun segment isolé', () => {
    expect(impasses(1), `${(s.walls ?? []).filter((w) => w.z === 1).length} arêtes à l’étage`).toEqual([]);
  });

  it('REZ : plus AUCUN mur en impasse — les cages 8/9 du foyer sont closes, tout est chaîné', () => {
    expect(impasses(0), `${(s.walls ?? []).filter((w) => (w.z ?? 0) === 0).length} arêtes au rez`).toEqual([]);
  });

  /** Composante connexe de vide qui contient le CENTRE du puits (cf. « PUITS CENTRAL OVALE ») — le
   *  vide du dehors, qui borde l'enveloppe du bâtiment et EXIGE ses murs, en est exclu par
   *  construction : il ne communique pas avec le puits. */
  const puits = (() => {
    const set = new Set([`${PUITS_TEMOIN.x},${PUITS_TEMOIN.y}`]);
    const pile = [[PUITS_TEMOIN.x, PUITS_TEMOIN.y]];
    while (pile.length) {
      const [cx, cy] = pile.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || set.has(`${nx},${ny}`) || tileAt(s, nx, ny, 1) !== 'vide') continue;
        set.add(`${nx},${ny}`);
        pile.push([nx, ny]);
      }
    }
    return set;
  })();

  it('le PUITS est OUVERT : aucune arête entre une case du puits et sa voisine de plancher', () => {
    expect(tileAt(s, PUITS_TEMOIN.x, PUITS_TEMOIN.y, 1), 'le centre du puits est bien vide').toBe('vide');
    const offenseurs: string[] = [];
    let paires = 0;
    for (const key of puits) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || tileAt(s, nx, ny, 1) === 'vide') continue;
        paires++;
        if (wallBetween(s, x, y, nx, ny, 1)) offenseurs.push(`${x},${y}|${nx},${ny}`);
      }
    }
    expect(paires, 'le puits borde bien du plancher de balcon').toBeGreaterThan(0);
    expect(offenseurs, `${puits.size} cases de puits, ${paires} paires puits|plancher`).toEqual([]);
  });

  it('un refend de loge qui MEURT sur le vide reste posé, et n’est PAS un défaut : l’à-pic exempte', () => {
    const temoin = (s.walls ?? []).find((w) => w.x === 9 && w.y === 16 && w.side === 'N' && w.z === 1);
    expect(temoin, 'refend témoin (9,16)N absent de la grille').toBeDefined();
    expect(tileAt(s, 10, 16, 1), 'le quadrant est du coin (10,16) est bien le puits').toBe('vide');
    expect(impasses(1)).not.toContain('9,16N');
  });
});

/**
 * #1780 — le mobilier app-owned se pose SUR le plan compilé : ce que le folio ne montre pas (statues du
 * foyer, lustres) reste éditable, mais aucune de ses cases ne peut tomber hors d'une pièce, sur une
 * RAMPE (dont la pente est le seul chemin vers l'étage) ni dans une cage d'escalier.
 */
describe('plan de l’Opéra — mobilier posé sur le plan (#1780)', () => {
  const s = buildOperaFloorplan();
  const zonesAt = (x: number, y: number, z: number) => (s.effectZones ?? [])
    .filter((zone) => (zone.z ?? 0) === z && (zone.tiles ?? []).some((t) => t.x === x && t.y === y))
    .map((zone) => zone.id);
  // CAGES DÉRIVÉES de la légende (les pièces dont le `label` verbatim du folio commence par « Escalier ») :
  // une liste littérale redoublerait des ids et se tairait au premier renommage de pièce.
  const CAGES = new Set(Object.values({ ...ZONES_REZ, ...ZONES_ETAGE })
    .filter((p) => p.label?.startsWith('Escalier')).map((p) => p.id));
  it('tout décor de l’étage repose sur la dalle, dans une pièce — aucun ne surplombe le puits', () => {
    // Une case `vide` sous un décor de l'étage est un défaut de pose (un fauteuil de loge au-dessus du
    // parterre) ; ce qui repose sur la dalle DOIT avoir sa pièce, sinon la loi de dégagement ne le trouve pas.
    const etage = scenarioEntities.filter((e) => (e.z ?? 0) === 1);
    expect(etage.length, 'l’étage porte bien du décor posé').toBeGreaterThan(0);
    const surPuits = etage.filter((e) => tileAt(s, e.pos.x, e.pos.y, 1) === 'vide').map((e) => `${e.id} (${e.pos.x},${e.pos.y})`);
    expect(surPuits, `décor(s) de l’étage au-dessus du VIDE : ${surPuits.join(' ')}`).toEqual([]);
    const horsPiece = etage
      .filter((e) => zonesAt(e.pos.x, e.pos.y, 1).length === 0)
      .map((e) => `${e.id} (${e.pos.x},${e.pos.y})`);
    expect(horsPiece, `décor(s) posé(s) à l’étage hors de toute pièce : ${horsPiece.join(' ')}`).toEqual([]);
  });

  it('LUSTRES : chacun est posé dans une pièce NOMMÉE de son niveau, jamais sur un vide de ce niveau', () => {
    // La recette porte la hauteur (patron `applique-murale`) : le lustre se pose au NIVEAU de la pièce
    // qu'il éclaire. Un volume à double hauteur (l'étage `vide` au-dessus) appartient au niveau inférieur.
    // Sa hauteur contre la dalle ou le toit est tenue par `scenes/decor-sous-plafond.test.ts`.
    const lustres = scenarioEntities.filter((e) => e.ref === 'lustre-opera');
    expect(lustres.length, 'le plan porte des lustres').toBeGreaterThan(0);
    const malPoses = lustres
      .filter((e) => {
        const z = e.z ?? 0;
        return tileAt(s, e.pos.x, e.pos.y, z) === 'vide' || zonesAt(e.pos.x, e.pos.y, z).length === 0;
      })
      .map((e) => `${e.id} (${e.pos.x},${e.pos.y}) z${e.z ?? 0}`);
    expect(malPoses, `lustre(s) sur un vide de leur niveau ou hors de toute pièce nommée : ${malPoses.join(' ')}`).toEqual([]);
  });

  it('LIMITE : la donnée ne dit pas QUELLE pièce un lustre éclaire — sous chaque lustre d’étage, le rez porte aussi une pièce nommée', () => {
    // Descendre un lustre de la galerie au rez le poserait dans une autre pièce nommée (le Salon) : le test
    // de pièce ci-dessus ne peut pas le refuser, seul le niveau authoré dit la pièce éclairée.
    const lustresDEtage = scenarioEntities.filter((e) => e.ref === 'lustre-opera' && (e.z ?? 0) > 0);
    expect(lustresDEtage.length, 'le plan porte des lustres d’étage').toBeGreaterThan(0);
    for (const l of lustresDEtage)
      expect(zonesAt(l.pos.x, l.pos.y, 0), `${l.id} (${l.pos.x},${l.pos.y}) : le rez dessous porte une pièce nommée`).not.toEqual([]);
  });

  it('GARDE-CORPS : chaque case de RIVE du puits porte une balustrade, et aucune autre case du plan', () => {
    // Contrat de COUVERTURE, sans cardinal : l'ensemble des cases balustradées EST celui de la rive que
    // `puitsRim` dérive de l'ASCII — recreuser l'ovale déplace les deux ensembles du même geste.
    const cle = (x: number, y: number) => `${x},${y}`;
    const balustrades = scenarioEntities.filter((e) => e.ref === 'balustrade-loge');
    const posees = balustrades.map((e) => `${cle(e.pos.x, e.pos.y)}z${e.z ?? 0}`);
    const rive = puitsRim();
    expect(rive.length, 'la rive du puits n’est pas vide').toBeGreaterThan(0);
    expect([...new Set(posees)].sort(), `${balustrades.length} balustrade(s) pour ${rive.length} case(s) de rive — doublon(s) : ${posees.filter((p, i) => posees.indexOf(p) !== i).join(' ')}`)
      .toEqual(rive.map((c) => `${cle(c.x, c.y)}z1`).sort());
    expect(posees.length, 'une seule balustrade par case').toBe(new Set(posees).size);
    // CAP : la voisine visée par chaque travée est le VIDE du puits — le garde-corps regarde le dénivelé.
    const VERS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], O: [-1, 0] };
    const malCapees = balustrades
      .filter((e) => { const [dx, dy] = VERS[e.facing as string]; return tileAt(s, e.pos.x + dx, e.pos.y + dy, 1) !== 'vide'; })
      .map((e) => `${e.id} cap ${e.facing}`);
    expect(malCapees, `balustrade(s) qui ne regardent pas le puits : ${malCapees.join(' ')}`).toEqual([]);
  });

  it('BALUSTRADES : elles ne retirent QUE les cases de rive, et n’enclavent aucune case de l’étage', () => {
    // La balustrade est un décor SOLIDE (`props.json` `balustrade-loge`) : elle MURE sa case pour la
    // marche (`isWalkable` → `entityBlockedAt`, `src/state/scene.ts:540`). Connexité lue à la SOURCE
    // UNIQUE (`walkComponentAt`, `src/state/path.ts:175`) : 8-connexe et cross-couche, donc plus
    // permissive qu'un flood 4-connexe — une case enclavée y reste une composante de plus.
    const meuble = operaPlan.scene; // la scène RÉELLE du scénario (plan + mobilier)
    const sansGardeCorps = { ...meuble, entities: meuble.entities.filter((e) => e.ref !== 'balustrade-loge') };
    const cle = (x: number, y: number) => `${x},${y}`;
    const { w, h } = meuble.dimensions;
    const marchablesEtage = (sc: Scene) => {
      const out = new Set<string>();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isWalkable(sc, x, y, 1)) out.add(cle(x, y));
      return out;
    };
    const composantesEtage = (sc: Scene) => {
      const ids = new Set<number>();
      for (const k of marchablesEtage(sc)) {
        const [x, y] = k.split(',').map(Number);
        ids.add(walkComponentAt(sc, x, y, 1)!);
      }
      return ids;
    };
    const avec = marchablesEtage(meuble);
    const sans = marchablesEtage(sansGardeCorps);
    const rive = puitsRim().map((c) => cle(c.x, c.y)).sort();
    expect(rive.length, 'la rive du puits n’est pas vide').toBeGreaterThan(0);
    expect(sans.size, 'l’étage sans garde-corps porte des cases marchables').toBeGreaterThan(rive.length);
    // (a) ENSEMBLES, pas cardinaux : ce que les balustrades ferment EST la rive, ni plus ni moins.
    const fermees = [...sans].filter((k) => !avec.has(k)).sort();
    const horsRive = fermees.filter((k) => !rive.includes(k));
    const riveOuverte = rive.filter((k) => !fermees.includes(k));
    expect(fermees, `case(s) fermée(s) hors rive : ${horsRive.join(' ')} — case(s) de rive restées marchables : ${riveOuverte.join(' ')}`)
      .toEqual(rive);
    const ouvertes = [...avec].filter((k) => !sans.has(k));
    expect(ouvertes, `retirer les balustrades ne peut rien OUVRIR : ${ouvertes.join(' ')}`).toEqual([]);
    // (b) AUCUNE ENCLAVE : poser les garde-corps ne crée pas une composante marchable de plus.
    const compAvec = composantesEtage(meuble), compSans = composantesEtage(sansGardeCorps);
    expect(compAvec.size, `les balustrades découpent l’étage : ${compSans.size} composante(s) marchable(s) sans elles, ${compAvec.size} avec`)
      .toBe(compSans.size);
  });

  it('aucun décor ne se pose sur une RAMPE ni dans une cage d’escalier 8/9', () => {
    expect([...CAGES], 'la légende déclare des cages d’escalier — sinon ce contrat ne mesure rien').not.toEqual([]);
    // La RAMPE se lit à la SEULE chose qui la distingue : son plancher est en pente (`heightAt` ≠ la cote
    // du foyer). Aucun cardinal de colonnes ici — la pente bouge avec `PENTE_RAMPE_M`, pas ce contrat.
    const fautifs = scenarioEntities
      .filter((e) => {
        const z = e.z ?? 0;
        const surRampe = z === 0 && heightAt(s, e.pos.x, e.pos.y, 0) > 0 && tileAt(s, e.pos.x, e.pos.y, 0) === 'marbre';
        return surRampe || zonesAt(e.pos.x, e.pos.y, z).some((id) => CAGES.has(id));
      })
      .map((e) => `${e.id} (${e.pos.x},${e.pos.y},z${e.z ?? 0})`);
    expect(fautifs, `décor(s) posé(s) sur une rampe ou dans une cage : ${fautifs.join(' ')}`).toEqual([]);
  });
});
