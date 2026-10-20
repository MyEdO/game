import { describe, it, expect } from 'vitest';
import { buildFloors, edgeBlends, isOverhang, capsSolid, capsSolidDirect, fogFloorZ } from './floors';
import type { Face, FloorEl } from './types';
import { emptyScene, heightAt, type Scene } from '../../noyau/monde/scene';
import { gradeBetween, STEP_MAX_M } from '../../noyau/monde/relief';
import { terrainMatiere } from '../../noyau/monde/terrain';

/**
 * Builder de sols du PIVOT : le franchissement vertical S'AUTO-DÉRIVE du delta de hauteur MÉTRIQUE
 * entre cases voisines (`heightAt`/`gradeBetween`). On teste ici la sortie MONDE (camera-free) :
 * faces de relief (falaise/rampe/tablier/piliers), raccords d'arêtes (`edgeBlends` → wedges),
 * surplombs (`isOverhang`, fantôme vs surplomb PLEIN) et clés stables.
 */

/** Scène 4×4 « plancher » avec un tableau de hauteurs métriques à 0 partout (édité par test). */
function withHeight(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  s.layers[0].tiles = new Array(16).fill('plancher');
  s.layers[0].height = new Array(16).fill(0);
  return s;
}
const setH = (s: Scene, x: number, y: number, h: number) => { s.layers[0].height![y * 4 + x] = h; };

const elAt = (els: FloorEl[], x: number, y: number, z = 0) => els.find((e) => e.key === `floor:${x},${y},${z}`);
/** Faces de RELIEF (parois) d'un élément — exclut base, wedges et piliers. */
const reliefParts = (el: FloorEl | undefined) => (el?.faces ?? []).filter((f) => f.material.domain === 'relief' && f.material.part !== 'pilier');
/** Face de BASE (losange de sol) : domaine terrain, sans `part` (≠ wedge). L'orientation « sol » n'est
 *  plus un champ (`plane` retiré) → les backends la dérivent de `domain`+`part`, les tests aussi. */
const isBaseFace = (f: Face) => f.material.domain === 'terrain' && !f.material.part;

describe('edgeBlends (raccord d’arêtes de terrain)', () => {
  it('un voisin de priorité plus haute déborde ; même priorité ne déborde pas', () => {
    const s = emptyScene('scene-test', 3, 3); // tout herbe (priorité 1)
    s.layers[0].tiles[1 * 3 + 2] = 'pave'; // E (x=2,y=1) = pavé (priorité 5)
    const blends = edgeBlends(s, 1, 1);
    expect(blends).toContainEqual({ dir: 'E', terrain: 'pave' });
    expect(blends.find((b) => b.terrain === 'herbe')).toBeUndefined();
  });
  it('aucun débordement si tous les voisins ≤ priorité du centre', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles[1 * 3 + 1] = 'pave'; // centre = pavé (haute priorité)
    expect(edgeBlends(s, 1, 1)).toEqual([]); // voisins herbe (basse)
  });
  it('opère sur le NIVEAU demandé (z) — chaque couche a ses propres raccords', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers.push({ z: 1, tiles: new Array(9).fill('herbe') });
    s.layers[1].tiles[1 * 3 + 2] = 'pave'; // voisin E au niveau 1
    expect(edgeBlends(s, 1, 1, 1)).toContainEqual({ dir: 'E', terrain: 'pave' });
    expect(edgeBlends(s, 1, 1, 0)).toEqual([]); // niveau 0 inchangé (tout herbe)
  });
});

describe('gradeBetween — rampe (≤ STEP_MAX) vs falaise (>STEP_MAX)', () => {
  it('classe le lien vertical par |Δhauteur| (mètres)', () => {
    expect(gradeBetween(2, 2)).toBe('flat');
    expect(gradeBetween(0, STEP_MAX_M)).toBe('ramp');       // exactement le pas max → franchissable
    expect(gradeBetween(0, STEP_MAX_M + 0.5)).toBe('cliff'); // au-delà → falaise
  });
});

describe('buildFloors — parois de relief auto-dérivées du dénivelé métrique', () => {
  it('un plateau surélevé de +4 m porte 4 FALAISES verticales (terre en z0), en unités de grille+mètres', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces).toHaveLength(4);
    expect(faces.every((f) => f.material.part === 'cliff')).toBe(true);
    expect(faces.every((f) => f.material.id === 'terre')).toBe(true); // talus de terrain (couche de base)
    // Quad d'arête [haut-A, haut-B, bas-B, bas-A] : haut à la hauteur de la case, bas à celle du voisin.
    const n = faces.find((f) => f.side === 'N')!;
    expect(n.poly.map((p) => p.h)).toEqual([4, 4, 0, 0]);
    expect(n.poly[0]).toEqual({ x: 0.5, y: 0.5, h: 4 }); // coin NO de (1,1) en coordonnées de grille
  });

  it('un ressaut de +0.5 m (≤ STEP_MAX) porte des RAMPES (plan incliné), pas des falaises', () => {
    const s = withHeight();
    setH(s, 1, 1, 0.5);
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.every((f) => f.material.part === 'ramp')).toBe(true);
  });

  it('de niveau avec tous ses voisins → seule la face de BASE (matériau = id du terrain)', () => {
    const el = elAt(buildFloors(withHeight()), 1, 1)!;
    expect(el.faces).toHaveLength(1);
    expect(el.faces[0].material).toEqual({ domain: 'terrain', id: 'plancher' });
    expect(el.faces[0].poly.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 1.5, y: 1.5 }, { x: 0.5, y: 1.5 }, // NO→NE→SE→SO
    ]);
  });

  it('plateau (2 cases à même hauteur) → pas de paroi sur l’arête PARTAGÉE, mais bien sur les bords', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    setH(s, 2, 1, 4); // voisin E à la même hauteur
    const dirs = reliefParts(elAt(buildFloors(s), 1, 1)).map((f) => f.side);
    expect(dirs).not.toContain('E'); // arête partagée : de niveau
    expect(dirs).toContain('S');     // bord du plateau : chute
  });

  it('la case BASSE ne porte pas la paroi : c’est le RIM (haut) qui descend vers la fosse', () => {
    const s = withHeight();
    setH(s, 1, 2, -2); // fosse en (1,2), Δ2 m = falaise
    const els = buildFloors(s);
    expect(reliefParts(elAt(els, 1, 2))).toEqual([]);                       // la fosse (plus basse) ne dessine rien
    expect(reliefParts(elAt(els, 1, 1)).some((f) => f.side === 'S')).toBe(true); // le rim (1,1) descend au sud
  });

  it('les tuiles « vide » d’un étage ne produisent AUCUN élément (on voit le dessous)', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers.push({ z: 1, tiles: new Array(9).fill('vide') });
    s.layers[1].tiles[1 * 3 + 1] = 'plancher';
    const els = buildFloors(s, undefined, { activeZ: 1 });
    expect(els.filter((e) => e.cell.z === 1)).toHaveLength(1); // seule la tuile construite
    expect(els.filter((e) => e.cell.z === 0)).toHaveLength(9);
  });
});

describe('buildFloors — bloc PLEIN d’un terrain (solidHeightM, ex. mur) : RENDU seul, combat intouché', () => {
  it('une tuile mur cernée d’herbe s’affiche comme un bloc : 4 FALAISES + dessus à solidHeightM, heightAt=0', () => {
    const s = emptyScene('scene-test', 3, 3); // tout herbe, hauteur COMBAT 0 partout
    s.layers[0].tiles[1 * 3 + 1] = 'mur'; // centre = mur (solidHeightM ≈ 2.25 m)
    const el = elAt(buildFloors(s), 1, 1)!;
    const cliffs = reliefParts(el);
    expect(cliffs).toHaveLength(4); // le bloc domine ses 4 voisins herbe
    expect(cliffs.every((f) => f.material.part === 'cliff')).toBe(true);
    // Dessus (losange de base) à la hauteur d’AFFICHAGE (= solidHeightM du mur), matériau = swatch du mur.
    const base = el.faces.find(isBaseFace)!;
    const H = base.poly[0].h;
    expect(H).toBeGreaterThan(STEP_MAX_M); // > pas franchissable → falaise (bloc plein), pas rampe
    expect(base.material).toEqual({ domain: 'terrain', id: 'mur' });
    expect(cliffs[0].poly.map((p) => p.h)).toEqual([H, H, 0, 0]); // haut au sommet du bloc, bas au sol
    // INVARIANT COMBAT : heightAt (vérité) reste 0 — la hauteur d’affichage ne le touche pas.
    expect(heightAt(s, 1, 1)).toBe(0);
  });

  it('deux tuiles mur adjacentes : pas de paroi sur l’arête PARTAGÉE (bloc continu), falaise vers l’herbe', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles[1 * 3 + 1] = 'mur';
    s.layers[0].tiles[1 * 3 + 2] = 'mur'; // voisin E, même bloc
    const dirs = reliefParts(elAt(buildFloors(s), 1, 1)).map((f) => f.side);
    expect(dirs).not.toContain('E'); // arête partagée entre deux murs : de niveau
    expect(dirs).toContain('O');     // bord du bloc vers l’herbe : falaise
  });

  it('le bloc s’AJOUTE à la hauteur propre de la tuile (mur posé sur un étage surélevé)', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].height = new Array(9).fill(0);
    s.layers[0].tiles[1 * 3 + 1] = 'mur';
    s.layers[0].height[1 * 3 + 1] = 4; // étage surélevé de 4 m SOUS le mur
    const base = buildFloors(s).find((e) => e.key === 'floor:1,1,0')!.faces.find(isBaseFace)!;
    expect(base.poly[0].h).toBeGreaterThan(4 + STEP_MAX_M); // dessus = 4 m (étage) + solidHeightM (bloc)
  });
});

/**
 * #1691 — la MATIÈRE d'une face de relief vient de la DONNÉE, jamais du builder. Deux sources, deux
 * contrats : la SCÈNE pour les parois de relief (`reliefDefaults`, une par partie émise), le TERRAIN
 * pour le flanc d'un bloc plein (`terrains.json › matiere`). Chaque cas pose une valeur DIFFÉRENTE du
 * défaut : un id réécrit en dur dans `floors.ts` rendrait ces cas rouges.
 */
describe('buildFloors — la matière de relief est LUE dans la donnée (#1691)', () => {
  it('falaise : la matière est celle que la SCÈNE pose pour `cliff`', () => {
    const s = withHeight();
    s.reliefDefaults = { ...s.reliefDefaults, cliff: 'pierre' }; // ≠ le défaut `terre` d'une scène neuve
    setH(s, 1, 1, 4);
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.every((f) => f.material.part === 'cliff')).toBe(true);
    expect(faces.every((f) => f.material.id === s.reliefDefaults.cliff)).toBe(true);
  });

  it('rampe : la matière est celle que la SCÈNE pose pour `ramp`', () => {
    const s = withHeight();
    s.reliefDefaults = { ...s.reliefDefaults, ramp: 'pierre' };
    setH(s, 1, 1, 0.5);
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.every((f) => f.material.part === 'ramp')).toBe(true);
    expect(faces.every((f) => f.material.id === s.reliefDefaults.ramp)).toBe(true);
  });

  it('dalle de tablier et pilier : les matières que la SCÈNE pose pour `deck` et `pilier`', () => {
    const s = emptyScene('scene-test', 4, 4);
    s.layers[0].tiles = new Array(16).fill('plancher');
    s.layers[0].height = new Array(16).fill(0);
    s.layers.push({ z: 1, tiles: new Array(16).fill('vide'), height: new Array(16).fill(0) });
    s.layers[1].tiles[1 * 4 + 1] = 'planches';
    s.layers[1].height![1 * 4 + 1] = 4;
    s.reliefDefaults = { ...s.reliefDefaults, deck: 'terre', pilier: 'terre' }; // ≠ défauts `pierre`/`pilier`
    const el = elAt(buildFloors(s, undefined, { activeZ: 1 }), 1, 1, 1)!;
    const decks = el.faces.filter((f) => f.material.part === 'deck');
    const piliers = el.faces.filter((f) => f.material.part === 'pilier');
    expect(decks.length).toBeGreaterThan(0);
    expect(piliers.length).toBeGreaterThan(0);
    expect(decks.every((f) => f.material.id === s.reliefDefaults.deck)).toBe(true);
    expect(piliers.every((f) => f.material.id === s.reliefDefaults.pilier)).toBe(true);
  });

  it('flanc d’un BLOC PLEIN : la matière est celle de son TERRAIN, pas celle de la scène', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].height = new Array(9).fill(0);
    s.layers[0].tiles[1 * 3 + 1] = 'mur';
    const attendue = terrainMatiere('mur');
    expect(attendue, '`mur` n’est plus un terrain à bloc plein porté par sa matière').toBeDefined();
    expect(s.reliefDefaults.cliff).not.toBe(attendue); // la scène dit AUTRE CHOSE : le terrain gagne
    const faces = reliefParts(elAt(buildFloors(s), 1, 1));
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.every((f) => f.material.id === attendue)).toBe(true);
  });
});

describe('buildFloors — TOIT d’un bloc plein (chemin de ronde sur le mur), vu d’un étage inférieur', () => {
  /** Bloc `mur` en (1,1) à z0 (dessus 4 m) COIFFÉ d’un sol `pierre` en (1,1) à z1, hauteur 4 m coïncidente. */
  function cappedWall(): Scene {
    const s = emptyScene('scene-test', 3, 3); // z0 tout herbe (hauteur combat 0)
    s.layers[0].tiles[1 * 3 + 1] = 'mur'; // masse pleine (solidHeightM) → dessus à 4 m
    s.layers.push({ z: 1, tiles: new Array(9).fill('vide'), height: new Array(9).fill(0) });
    s.layers[1].tiles[1 * 3 + 1] = 'pierre'; // chemin de ronde
    s.layers[1].height![1 * 3 + 1] = 4;      // coïncide avec le dessus du bloc
    return s;
  }

  it('capsSolid : vrai pour le sol qui coiffe le bloc plein ; faux pour z0 et pour un surplomb sur du marchable', () => {
    const s = cappedWall();
    expect(capsSolid(s, 1, 1, 1)).toBe(true);
    expect(capsSolid(s, 1, 1, 0)).toBe(false); // z0 jamais
    // un tablier au-dessus d’une surface MARCHABLE (plancher, pas un bloc plein) n’est PAS un toit de bloc
    const deck = emptyScene('scene-test', 3, 3);
    deck.layers[0].tiles = new Array(9).fill('plancher');
    deck.layers.push({ z: 1, tiles: new Array(9).fill('vide'), height: new Array(9).fill(0) });
    deck.layers[1].tiles[1 * 3 + 1] = 'planches';
    deck.layers[1].height![1 * 3 + 1] = 4;
    expect(capsSolid(deck, 1, 1, 1)).toBe(false);
  });

  it('vu du SOL (activeZ=0) le chemin de ronde est ÉMIS, OPAQUE (pas fantôme) et PERÇU — le dessus du mur n’est plus à nu', () => {
    const el = elAt(buildFloors(cappedWall(), undefined, { activeZ: 0 }), 1, 1, 1);
    expect(el).toBeDefined();                 // n’est PLUS culé comme un fantôme non-surplomb
    expect(el!.states.ghost).toBe(false);     // opaque (toit de structure solide), pas translucide
    expect(el!.states.visible).toBe(true);    // perçu au-dessus du voile, comme le bloc qu’il coiffe
  });

  it('non-régression : un vrai surplomb (tablier sur route marchable) reste FANTÔME vu d’en bas', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles = new Array(9).fill('plancher');
    s.layers.push({ z: 1, tiles: new Array(9).fill('vide'), height: new Array(9).fill(0) });
    s.layers[1].tiles[1 * 3 + 1] = 'planches';
    s.layers[1].height![1 * 3 + 1] = 4;
    const el = elAt(buildFloors(s, undefined, { activeZ: 0 }), 1, 1, 1)!;
    expect(el.states.ghost).toBe(true); // surplomb flottant → fantôme (comportement inchangé)
  });

  it('le DESSUS d’un bloc coiffé n’est PAS dessiné (le chemin de ronde EST la surface — pas de « double dalle »)', () => {
    const mur = elAt(buildFloors(cappedWall(), undefined, { activeZ: 0 }), 1, 1, 0)!;
    expect(mur.faces.filter(isBaseFace)).toHaveLength(0);                       // dessus du bloc supprimé
    expect(reliefParts(mur).length).toBeGreaterThan(0);                         // MAIS les flancs (mur) restent
    const walkway = elAt(buildFloors(cappedWall(), undefined, { activeZ: 0 }), 1, 1, 1)!;
    expect(walkway.faces.some(isBaseFace)).toBe(true);                          // le chemin de ronde fournit LA surface
  });

  it('un sol posé DIRECTEMENT sur un bloc plein ne dessine AUCUNE paroi (le bloc s’en charge) → pas de falaise fantôme qui recouvre une rampe DEVANT', () => {
    // (1,0) = mur (bloc 4 m) coiffé par un chemin de ronde `pierre` z1 4 m. Les parois de ce toit seraient
    // REDONDANTES avec celles du bloc et, à base égale, la couche z1 gagne le tri → elles recouvriraient une
    // rampe z0 de même hauteur posée devant. Donc : ZÉRO paroi sur le toit ; le bloc `mur` en dessous les porte.
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles[0 * 3 + 1] = 'mur';
    s.layers.push({ z: 1, tiles: new Array(9).fill('vide'), height: new Array(9).fill(0) });
    s.layers[1].tiles[0 * 3 + 1] = 'pierre'; s.layers[1].height![0 * 3 + 1] = 4;
    expect(capsSolidDirect(s, 1, 0, 1)).toBe(true);
    const walkway = elAt(buildFloors(s, undefined, { activeZ: 0 }), 1, 0, 1)!;
    expect(reliefParts(walkway)).toHaveLength(0);          // AUCUNE paroi sur le toit du bloc
    expect(walkway.faces.some(isBaseFace)).toBe(true);     // mais bien le dessus (chemin de ronde)
    const mur = elAt(buildFloors(s, undefined, { activeZ: 0 }), 1, 0, 0)!;
    expect(reliefParts(mur).length).toBeGreaterThan(0);    // c'est le BLOC qui porte les parois (vers l'herbe basse)
  });

  it('TOIT DE GATEHOUSE : chemin de ronde sur un TUNNEL passable bordé de bloc plein → caps, ZÉRO piloti', () => {
    // (1,1) z0 = tunnel passable (plancher) BORDÉ par deux murs (0,1)/(2,1) montant à 4 m ; coiffé z1 à 4 m.
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles[1 * 3 + 0] = 'mur';
    s.layers[0].tiles[1 * 3 + 2] = 'mur';
    s.layers.push({ z: 1, tiles: new Array(9).fill('vide'), height: new Array(9).fill(0) });
    s.layers[1].tiles[1 * 3 + 1] = 'pierre';
    s.layers[1].height![1 * 3 + 1] = 4;
    expect(capsSolid(s, 1, 1, 1)).toBe(true); // tunnel bordé de bloc plein = toit solide
    const roof = elAt(buildFloors(s, undefined, { activeZ: 0 }), 1, 1, 1)!;
    expect(roof.faces.filter((f) => f.material.part === 'pilier')).toHaveLength(0); // aucun montant dans le tunnel
    expect(roof.states.ghost).toBe(false); // toit solide, opaque
  });
});

describe('buildFloors — wedges de raccord de terrain', () => {
  it('un voisin de plus haute précédence pose un wedge sur l’arête qui lui fait face (inset 0.4)', () => {
    const s = emptyScene('scene-test', 3, 3); // tout herbe
    s.layers[0].tiles[1 * 3 + 2] = 'pave'; // voisin E
    const el = elAt(buildFloors(s), 1, 1)!;
    const wedges = el.faces.filter((f) => f.material.part === 'wedge');
    expect(wedges).toHaveLength(1);
    expect(wedges[0].side).toBe('E');
    expect(wedges[0].material).toEqual({ domain: 'terrain', id: 'pave', part: 'wedge' });
    // Trapèze : arête E pleine (x=1.5) + points inset de 0.4 vers le centre (1,1) → x = 1.3.
    expect(wedges[0].poly.map((p) => p.x)).toEqual([1.5, 1.5, 1.3, 1.3]);
    // Le wedge se peint APRÈS la base (ordre de peinture du builder).
    expect(el.faces.indexOf(wedges[0])).toBeGreaterThan(el.faces.findIndex(isBaseFace));
  });
});

describe('buildFloors — surplomb (tablier au-dessus d’une surface marchable)', () => {
  /** z0 praticable partout ; tablier 1×1 en (1,1) à z1, 4 m, cerné de vide. */
  function deckScene(): Scene {
    const s = emptyScene('scene-test', 4, 4);
    s.layers[0].tiles = new Array(16).fill('plancher');
    s.layers[0].height = new Array(16).fill(0);
    s.layers.push({ z: 1, tiles: new Array(16).fill('vide'), height: new Array(16).fill(0) });
    s.layers[1].tiles[1 * 4 + 1] = 'planches';
    s.layers[1].height![1 * 4 + 1] = 4;
    return s;
  }

  it('isOverhang : marchable dessous → surplomb ; rien dessous → pas de surplomb ; z0 jamais', () => {
    const s = deckScene();
    expect(isOverhang(s, 1, 1, 1)).toBe(true);
    expect(isOverhang(s, 1, 1, 0)).toBe(false);
    const noFloor = deckScene();
    noFloor.layers[0].tiles = new Array(16).fill('vide');
    expect(isOverhang(noFloor, 1, 1, 1)).toBe(false);
  });

  it('bords sur le vide = DALLE FINE (deck, pierre) + PILIERS aux coins (dédupliqués), pas des falaises', () => {
    const el = elAt(buildFloors(deckScene(), undefined, { activeZ: 1 }), 1, 1, 1)!;
    expect(el.states.overhang).toBe(true);
    const decks = el.faces.filter((f) => f.material.part === 'deck');
    expect(decks).toHaveLength(4); // 4 arêtes sur le vide
    expect(decks.every((f) => f.material.id === 'pierre')).toBe(true);
    // Dalle fine : descend de l'épaisseur du tablier (0.3 m), pas jusqu'au sol.
    expect(decks[0].poly.map((p) => p.h)).toEqual([4, 4, 4 - 0.3, 4 - 0.3]);
    const pillars = el.faces.filter((f) => f.material.part === 'pilier');
    expect(pillars).toHaveLength(4); // 4 coins uniques (coins d'arêtes adjacentes dédupliqués)
    expect(pillars.every((f) => f.poly.length === 2 && f.poly[1].h === 0)).toBe(true); // jusqu'à la surface inférieure
    // Ordre de peinture : piliers (les plus en arrière) AVANT les parois, base ensuite, wedges à la fin.
    expect(el.faces.findIndex((f) => f.material.part === 'pilier')).toBe(0);
  });

  it('fantôme au-dessus de la zone active : SEULS les surplombs sont émis', () => {
    const s = deckScene();
    const els = buildFloors(s, undefined, { activeZ: 0 });
    const z1 = els.filter((e) => e.cell.z === 1);
    expect(z1).toHaveLength(1); // le tablier seulement (les vides ne rendent rien de toute façon)
    expect(z1[0].states.ghost).toBe(true);
  });

  it('surplomb FANTÔME si la surface du dessous est VISIBLE ; PLEIN (et au-dessus du voile) sinon', () => {
    const s = deckScene();
    const seen = new Set(['1,1,0']); // le sol sous le tablier est en vue
    const ghost = elAt(buildFloors(s, seen, { activeZ: 0 }), 1, 1, 1)!;
    expect(ghost.states).toMatchObject({ ghost: true, solidOverhang: false, visible: false });
    const solid = elAt(buildFloors(s, new Set<string>(), { activeZ: 0 }), 1, 1, 1)!;
    expect(solid.states).toMatchObject({ ghost: true, solidOverhang: true, visible: true });
  });

  it('à SON étage (activeZ = 1), le tablier n’est pas un fantôme', () => {
    const el = elAt(buildFloors(deckScene(), new Set<string>(), { activeZ: 1 }), 1, 1, 1)!;
    expect(el.states.ghost).toBe(false);
    expect(el.states.solidOverhang).toBe(false);
  });
});

describe('buildFloors — sélection des couches et clés', () => {
  it('viewZ isole une seule couche (debug viewLevel)', () => {
    const s = emptyScene('scene-test', 2, 2);
    s.layers.push({ z: 1, tiles: new Array(4).fill('plancher') });
    const els = buildFloors(s, undefined, { activeZ: 1, viewZ: 1 });
    expect(els.every((e) => e.cell.z === 1)).toBe(true);
    expect(els).toHaveLength(4);
  });

  it('clés STABLES d’identité monde (floor:x,y,z), identiques d’un appel à l’autre', () => {
    const s = emptyScene('scene-test', 2, 2);
    const a = buildFloors(s).map((e) => e.key);
    const b = buildFloors(s).map((e) => e.key);
    expect(a).toEqual(b);
    expect(a).toContain('floor:1,0,0');
    expect(new Set(a).size).toBe(a.length); // aucune collision
  });
});

describe('fogFloorZ — étage de sol effectif sous un trou', () => {
  it('retombe sur le premier sol construit sous l’étage actif ; sans trou, rend activeZ', () => {
    const s = emptyScene('scene-test', 2, 2);
    s.layers.push({ z: 1, tiles: new Array(4).fill('vide') });
    s.layers[1].tiles[0] = 'plancher'; // (0,0) construit à z1
    expect(fogFloorZ(s, 0, 0, 1)).toBe(1); // construit à l'étage actif
    expect(fogFloorZ(s, 1, 1, 1)).toBe(0); // trou à z1 → sol de z0
    expect(fogFloorZ(s, 1, 1, 0)).toBe(0); // mono-niveau : activeZ
  });
});
