import { describe, it, expect } from 'vitest';
import type { WallEl } from '../builders/types';
import { wallDepth, wallSvg, wallAccentsSvg, structureFaceSvg, dessusDeLaCoupe, dessusDuBlocPlein, dessusDuMur, dessusSvg, type TraitDuDessus } from './wallsSvg';
import { buildWalls, coupeDuMur, wallEnds, HAUTEUR_DE_COUPE_M } from '../builders/walls';
import { faceDepthM } from '../catalog/faceDepth';
import { projGP } from './project';
import { depth, tileEdge, type Dims } from '../../geometry/iso';
import { structureAppearance, wallPartColor } from '../catalog/structures';
import { materials, structureAppearances, terrains } from '../../data';
import { distanceTeinte, SEUIL_TEINTES_CONTIGUES } from '../../data/couleur';
import { shade, SIDE_N } from '../shade';
import { APPARENCE_MUR_NU } from '../../state/formeArete';
import { formesAdmises, type FormeArete } from '../../data/formesDArete';
import { emptyScene, setStructureDown, type Scene, type WallSeg } from '../../state/scene';

/**
 * Backend écran-affine des murs : projette les éléments `wall` du pivot via la projection partagée.
 * On vérifie la PARITÉ de géométrie avec `tileEdge` (l'arête historique), l'ombrage d'orientation
 * (arête N dans l'ombre), les couleurs tirées de la def (par `wallPartColor`), la profondeur de tri
 * (MAX des 2 cases bordantes + 0.45) et la branche VUE DU DESSUS (coupe horizontale).
 */

const dims: Dims = { w: 6, h: 6 };

function el(seg: WallSeg, edit?: (s: Scene) => Scene): WallEl {
  let s = emptyScene(6, 6);
  s.walls = [seg];
  if (edit) s = edit(s);
  return buildWalls(s)[0];
}

describe('wallSvg — parité de géométrie avec tileEdge (arête historique)', () => {
  it.each([0, 1, 2, 3] as const)('cran %s : la base de la face passe par les extrémités de tileEdge', (rot) => {
    const d: Dims = { ...dims, rot };
    for (const side of ['N', 'E'] as const) {
      const svg = wallSvg(el({ x: 2, y: 2, side }), d);
      const [a, b] = tileEdge(2, 2, side, d, 0);
      expect(svg).toContain(`${a.cx},${a.cy}`);
      expect(svg).toContain(`${b.cx},${b.cy}`);
    }
  });
});

describe('wallSvg — bois : couleurs de la def, ombrage par ORIENTATION MONDE', () => {
  const app = structureAppearance('plain');
  it('arête E (éclairée) : la face garde sa couleur de def, la plinthe aussi', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
    expect(svg).toContain(`fill="${app.face}"`);
    expect(svg).toContain(`fill="${app.wood!.skirt}"`);
    expect(svg).toContain(`stroke="${shade(app.face, 0.4)}"`); // liseré dérivé de la face
  });
  it('arête N (dans l’ombre) : face assombrie par SIDE_N', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N' }), dims);
    expect(svg).toContain(`fill="${shade(app.face, SIDE_N)}"`);
    expect(svg).not.toContain(`fill="${app.face}" stroke`); // la face pleine n'est plus au ton éclairé
  });
  it('PIGNON à parapet : la fermeture de comble d’un mur-en-pierre porte le MÊME liseré que la face de son mur', () => {
    const app = structureAppearance('mur-en-pierre');
    expect(app.parapet).toBeTruthy();
    const w = el({ x: 2, y: 2, side: 'N', structure: 'mur-en-bois', appearance: 'mur-en-pierre' });
    const face = w.faces.find((f) => f.material.part === 'face')!;
    const [A, B] = [face.poly[3], face.poly[2]];
    const pignon = { poly: [A, B, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, h: A.h + 1 }], material: face.material, side: 'N' as const, oriented: false };
    const lisere = (svg: string) => /<polygon points="[^"]*" fill="[^"]*"( stroke="[^"]*" stroke-width="[^"]*")\/>/.exec(svg)?.[1];
    const duMur = lisere(wallSvg({ ...w, faces: [face] }, dims));
    expect(duMur).toBeDefined();
    expect(lisere(structureFaceSvg(pignon, 'pignon', w.cell, dims))).toBe(duMur);
  });
  it('montants : 2 rects de poteau (corps + chapiteau + socle) aux extrémités', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
    expect((svg.match(new RegExp(`fill="${app.post}"`, 'g')) ?? []).length).toBe(2);
  });
  it('bayPanel : le panneau prend `wood.inset`, la moulure est sa ligne médiane 1.3 px en `wood.frame`', () => {
    const nu = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
    const def = structureAppearance('plain');
    def.bayPanel = true;
    try {
      const svg = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
      expect(svg).toContain(`fill="${app.wood!.inset}"`);
      expect(svg).toContain(`stroke="${app.wood!.frame}" stroke-width="1.3"`);
      expect(svg.length).toBeGreaterThan(nu.length);
    } finally {
      delete def.bayPanel;
    }
  });
});

describe('wallSvg — porte bois OUVERTE : un TROU bordé de jambages', () => {
  it('aucune face ne remplit l’ouverture ; les 2 jambages la bordent', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', door: true }), dims);
    expect(svg).not.toContain('opacity=');
    const app = structureAppearance('plain');
    expect((svg.match(new RegExp(`fill="${shade(app.face, 1.25)}"`, 'g')) ?? []).length).toBe(2); // chapiteaux de jambage (repli)
  });
});

describe('wallSvg — pierre : palette UNIFIÉE du JSON (hex), face ombrée par orientation comme le bois', () => {
  const pierre = structureAppearance('mur-en-pierre');
  it('courtine N : face assombrie (SIDE_N), bandes/arase/merlons aux hex de la def + motif d’appareillage', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }), dims);
    expect(svg).toContain(`fill="${shade(pierre.face, SIDE_N)}"`);
    expect(svg).toContain(`fill="${pierre.band}"`);
    expect(svg).toContain(`fill="${pierre.cap}"`); // arase + merlons
    expect(svg).toContain('fill="url(#dt-'); // motif de joints partagé (recette `detail.courses`)
    expect(svg).not.toContain('stroke-width="1.7"');
  });
  it('LOD 0 (fills plats) : plus aucun motif', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }), dims, { zoom: 0.4 });
    expect(svg).not.toContain('fill="url(#dt-');
  });
  it('porte-de-ville : 7 barreaux de claire-voie (lignes 1.7 px) + 2 traverses', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'porte-de-ville' }), dims);
    expect((svg.match(/stroke-width="1\.7"/g) ?? []).length).toBe(7);
    const trav = structureAppearance('porte-de-ville').claireVoie!.traverseColor;
    expect((svg.match(new RegExp(`fill="${trav}"`, 'g')) ?? []).length).toBe(2);
  });
  it('brèche : gravats + tas dentelé (liseré ferrure)', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }, (s) => setStructureDown(s, 2, 2, 'N', 0, true)), dims);
    expect(svg).toContain(`fill="${pierre.rubble}"`);
    expect(svg).toContain(`fill="${pierre.rubbleHi}"`);
    expect(svg).toContain('stroke-width="0.6"');
  });
});

describe('wallAccentsSvg — couche d’accents seedés (LOD 2), séparée du memo', () => {
  it('pierre : blocs nuancés + mouchetis, déterministes au seed monde ; vide en LOD < 2 / vue du dessus / brèche', () => {
    const w = el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' });
    const a1 = wallAccentsSvg(w, dims);
    const a2 = wallAccentsSvg(w, dims);
    expect(a1).toBe(a2);
    expect(a1).toContain('<path');
    expect(wallAccentsSvg(el({ x: 3, y: 2, side: 'N', structure: 'mur-en-pierre' }), dims)).not.toBe(a1); // seed = identité monde
    expect(wallAccentsSvg(w, dims, { zoom: 0.6 })).toBe('');
    expect(wallAccentsSvg(w, { ...dims, view: 'top' })).toBe('');
    expect(wallAccentsSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }, (s) => setStructureDown(s, 2, 2, 'N', 0, true)), dims)).toBe('');
  });
  it('bois : nuances de PLANCHES (rangs continus sans blocs, paletteVar) — pleine largeur de face', () => {
    const a = wallAccentsSvg(el({ x: 2, y: 2, side: 'N' }), dims);
    expect(a).toContain('<path'); // quelques planches plus claires/sombres
    expect(a).toBe(wallAccentsSvg(el({ x: 2, y: 2, side: 'N' }), dims));
  });
});

describe('wallSvg — colombage (recette `timber`, matériaux v2)', () => {
  const timber = structureAppearance('mur-en-bois').detail!.timber!;
  it('mur-en-bois : poteaux + écharpes en X à la couleur de la recette (LOD ≥ 1, pas en LOD 0)', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'E', structure: 'mur-en-bois' }), dims);
    expect(svg).toContain(`stroke="${timber.color}"`);
    expect(wallSvg(el({ x: 2, y: 2, side: 'E', structure: 'mur-en-bois' }), dims, { zoom: 0.4 })).not.toContain(`stroke="${timber.color}"`);
  });
  it('jamais sur une travée de PORTE (l’ouverture couperait les écharpes) ni un mur nu `plain`', () => {
    expect(wallSvg(el({ x: 2, y: 2, side: 'E', structure: 'mur-en-bois', door: true }), dims)).not.toContain(`stroke="${timber.color}"`);
    expect(wallSvg(el({ x: 2, y: 2, side: 'E' }), dims)).not.toContain(`stroke="${timber.color}"`);
  });
});

describe('wallSvg — apparence de façade authorée', () => {
  const authored = (): WallEl => {
    const s = emptyScene(6, 6);
    s.walls = [{ x: 2, y: 2, side: 'E' }];
    s.architecture = [{
      id: 'corps-auberge',
      style: 'taverne',
      storeys: [],
      facades: [{
        id: 'facade-rue',
        z: 0,
        edges: [{ x: 2, y: 2, side: 'E' }],
        appearance: 'auberge-relais-imperiale',
      }],
      masses: [],
    }];
    return buildWalls(s)[0];
  };

  it.each([0, 1, 2, 3] as const)('cran %s : résout le matériau partagé et conserve la même arête', (rot) => {
    const d: Dims = { ...dims, rot };
    const wall = authored();
    const svg = wallSvg(wall, d);
    const timber = structureAppearance('mur-a-ossature-en-bois');
    const [a, b] = tileEdge(2, 2, 'E', d, 0);
    expect(wall.appearance).toBe('mur-a-ossature-en-bois'); // l'apparence de MUR que résout `apparenceDeLArete`
    expect(wall.facadeAppearance).toBe('auberge-relais-imperiale');
    expect(svg).toContain(timber.detail!.timber!.color);
    expect(svg).toContain(`${a.cx},${a.cy}`);
    expect(svg).toContain(`${b.cx},${b.cy}`);
  });

  it.each([0, 1, 2, 3] as const)('cran %s : les features planaires restent attachées et identifiables', (rot) => {
    const s = emptyScene(6, 6);
    s.walls = [{ x: 2, y: 2, side: 'E' }];
    s.architecture = [{
      id: 'corps', style: 'taverne', storeys: [], masses: [],
      facades: [{
        id: 'rue', z: 0, edges: [{ x: 2, y: 2, side: 'E' }], appearance: 'auberge-relais-imperiale',
        features: [
          { id: 'fenetres', kind: 'window-band', edge: { x: 2, y: 2, side: 'E' }, width: 0.6 },
          { id: 'entree', kind: 'stone-entry', edge: { x: 2, y: 2, side: 'E' }, width: 0.7 },
          { id: 'pignon', kind: 'gable', edge: { x: 2, y: 2, side: 'E' }, width: 0.8 },
        ],
      }],
    }];
    const svg = wallSvg(buildWalls(s)[0], { ...dims, rot });
    for (const id of ['fenetres', 'entree', 'pignon'])
      expect(svg).toContain(`data-architecture-feature="corps:rue:${id}"`);
  });

  it('la géométrie de feature suit les quatre rotations sans coordonnées invalides', () => {
    const s = emptyScene(6, 6);
    s.walls = [{ x: 2, y: 2, side: 'N' }];
    s.architecture = [{
      id: 'corps', style: 'taverne', storeys: [], masses: [],
      facades: [{
        id: 'rue', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'auberge-relais-imperiale',
        features: [{ id: 'pignon', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, width: 0.8 }],
      }],
    }];
    const outputs = ([0, 1, 2, 3] as const).map((rot) => wallSvg(buildWalls(s)[0], { ...dims, rot }));
    expect(new Set(outputs).size).toBe(4);
    expect(outputs.every((svg) => !svg.includes('NaN') && !svg.includes('Infinity'))).toBe(true);
  });
});

describe('wallDepth — MAX des cases bordantes + 0.45, aux 4 rotations', () => {
  it.each([0, 1, 2, 3] as const)('cran %s', (rot) => {
    const d: Dims = { ...dims, rot };
    expect(wallDepth(el({ x: 2, y: 2, side: 'E' }), d)).toBe(Math.max(depth(2, 2, d), depth(3, 2, d)) + 0.45);
    expect(wallDepth(el({ x: 2, y: 2, side: 'N' }), d)).toBe(Math.max(depth(2, 2, d), depth(2, 1, d)) + 0.45);
    expect(wallDepth(el({ x: 2, y: 2, side: '\\' }), d)).toBe(depth(2, 2, d) + 0.45);
  });
  it('vue du dessus : +0.6 au-dessus des overlays de sol', () => {
    const d: Dims = { ...dims, view: 'top' };
    expect(wallDepth(el({ x: 2, y: 2, side: 'E' }), d)).toBe(Math.max(depth(2, 2, d), depth(3, 2, d)) + 0.45 + 0.6);
  });
});

describe('wallSvg — vue du DESSUS (coupe horizontale)', () => {
  const top: Dims = { ...dims, view: 'top' };
  const MPT = 2;
  const SEG_DE_FORME: Record<FormeArete, Partial<WallSeg>> = {
    'mur-nu': {},
    'mur-fenetre': { window: true },
    'porte-fermee': { structure: 'porte', door: true, closed: true },
    'porte-ouverte': { structure: 'porte', door: true },
    'fermeture-fixe': { structure: 'porte' },
  };
  /** Couleurs de SOL réelles : les terrains et le dessus des matières de relief. */
  const SOLS: [string, string][] = [
    ...terrains.map((t): [string, string] => [t.id, t.swatch]),
    ...materials.flatMap((m) => ('slopeTop' in m && m.slopeTop ? [[`relief:${m.id}`, m.slopeTop] as [string, string]] : [])),
  ];
  const seg = (appearance: string, forme: FormeArete): WallSeg => ({ x: 2, y: 2, side: 'N', structure: 'mur-en-bois', ...SEG_DE_FORME[forme], appearance });
  const abattu = (s: Scene) => setStructureDown(s, 2, 2, 'N', 0, true);
  /** Chaque apparence du catalogue dans chaque forme qu'elle admet, intacte puis abattue. */
  const elementsDuCatalogue = (): [string, WallEl][] =>
    structureAppearances.flatMap((app) => formesAdmises(app).flatMap((forme): [string, WallEl][] => {
      const w = el(seg(app.id, forme));
      expect(w.forme, `${app.id} ${forme}`).toBe(forme);
      return [[`${app.id} ${forme}`, w], [`${app.id} ${forme} abattue`, el(seg(app.id, forme), abattu)]];
    }));
  const bloc = (): [string, TraitDuDessus[]] => {
    const [A, B] = wallEnds({ x: 2, y: 2, side: 'N' });
    return ['bloc plein', dessusDuBlocPlein([{ ...A, h: 0 }, { ...B, h: 0 }], 4, top, MPT)];
  };
  const coupes = (dessus: TraitDuDessus[]) => dessus.filter((t) => t.classe === 'coupe');
  /** Chemins SÉRIALISÉS d'une vue du dessus : extrémités MONDE (segment unité posé sur son milieu, tourné,
   *  étiré à sa longueur monde), couleur peinte, tirets, classe et rôle. Chaque chemin est lu : aucun
   *  n'échappe au motif. */
  const chemins = (svg: string) => lus(svg, [...svg.matchAll(/<path d="M-0\.5 0L0\.5 0" fill="none" stroke="(#[0-9a-f]{6})" stroke-linecap="butt"(?: pathLength="([-\d.e]+)" stroke-dasharray="[^"]+" stroke-dashoffset="([-\d.e]+)")? class="mur-(\w+) mur-(\w+)" style="transform:translate\(([-\d.e]+)px, ([-\d.e]+)px\) rotate\(([-\d.e]+)rad\) scale\(max\(([-\d.e]+), [^)]+\)\), 1\);stroke-width:[^"]+"\/>/g)]
    .map((m) => {
      const [cx, cy, angle, long] = [+m[6], +m[7], +m[8], +m[9]];
      const [ux, uy] = [(Math.cos(angle) * long) / 2, (Math.sin(angle) * long) / 2];
      return { de: [cx - ux, cy - uy], a: [cx + ux, cy + uy], couleur: m[1], pathLength: m[2] === undefined ? undefined : +m[2], offset: m[3] === undefined ? undefined : +m[3], classe: m[4], role: m[5] };
    }));
  const lus = <T,>(svg: string, trouves: T[]): T[] => {
    expect(trouves.length, svg).toBe((svg.match(/<path /g) ?? []).length);
    return trouves;
  };

  it('CÂBLAGE : `dessusDuMur(el)` est la sérialisation de `coupeDuMur(el.faces)` à `HAUTEUR_DE_COUPE_M`, et `wallSvg` la peint', () => {
    for (const [quoi, w] of elementsDuCatalogue()) {
      const dessus = dessusDuMur(w, top, MPT);
      expect(dessus, quoi).toEqual(dessusDeLaCoupe(coupeDuMur(w.faces, w.ends, HAUTEUR_DE_COUPE_M, MPT), w.ends, top, MPT));
      expect(wallSvg(w, top, { mpt: MPT }), quoi).toBe(dessusSvg(dessus));
    }
  });

  it('CÂBLAGE, ancre : un mur nu coupé = poteau, face, poteau aux couleurs de la DÉF, le couronnement en surplomb dessous', () => {
    const app = structureAppearance(APPARENCE_MUR_NU);
    const dessus = dessusDuMur(el({ x: 2, y: 2, side: 'N' }), top, MPT);
    expect(dessus.map((t) => t.classe)).toEqual(['surplomb', 'coupe', 'coupe', 'coupe']);
    expect(coupes(dessus).map((t) => t.tons.coeur)).toEqual([app.post, app.face, app.post]);
  });

  it('CÂBLAGE, ancre : porte FERMÉE = vantail coupé sur toute l’arête, ses jambages aux deux bornes peints PAR-DESSUS, aux couleurs de la DÉF', () => {
    const portes = structureAppearances.filter((d) => !d.parapet && !d.claireVoie && formesAdmises(d).includes('porte-fermee'));
    expect(portes.length).toBeGreaterThan(0);
    for (const a of portes) {
      const traits = coupes(dessusDuMur(el(seg(a.id, 'porte-fermee')), top, MPT));
      const iVantail = traits.findIndex((t) => t.tons.coeur === wallPartColor(a, 'vantail') && t.troncons[0].t0 <= 0 && t.troncons[0].t1 >= 1);
      expect(iVantail, a.id).toBeGreaterThanOrEqual(0);
      const jambages = traits.map((t, i) => [t, i] as const).filter(([t]) => t.tons.coeur === wallPartColor(a, 'jambage'));
      expect(jambages.map(([t]) => (t.troncons[0].t0 < 0.5 ? 0 : 1)), a.id).toEqual([0, 1]);
      for (const [t, i] of jambages) {
        expect(i, a.id).toBeGreaterThan(iVantail);
        expect(t.troncons[0].t0 <= 0 || t.troncons[0].t1 >= 1, a.id).toBe(true);
        expect(t.troncons[0].t0 < 1 && t.troncons[0].t1 > 0, a.id).toBe(true);
      }
    }
  });

  it('CÂBLAGE, ancre : claire-voie = barreaux DISCRETS, chaque barreau du volume en un tronçon à SA place, disjoint, à la couleur de la DÉF', () => {
    let avecBarreaux = 0;
    for (const a of structureAppearances.filter((d) => d.claireVoie)) for (const forme of formesAdmises(a)) {
      const w = el(seg(a.id, forme));
      const [A, B] = w.ends;
      const tOf = (p: { x: number; y: number }) => ((p.x - A.x) * (B.x - A.x) + (p.y - A.y) * (B.y - A.y)) / ((B.x - A.x) ** 2 + (B.y - A.y) ** 2);
      const places = w.faces.filter((f) => f.material.part === 'barreau').map((f) => [Math.min(...f.poly.map(tOf)), Math.max(...f.poly.map(tOf))] as const);
      if (!places.length) continue;
      avecBarreaux++;
      const troncons = dessusDuMur(w, top, MPT).filter((t) => t.tons.coeur === wallPartColor(a, 'barreau')).flatMap((t) => t.troncons);
      for (const [t0, t1] of places)
        expect(troncons.some((r) => Math.abs(r.t0 - t0) < 1e-9 && Math.abs(r.t1 - t1) < 1e-9), `${a.id} ${forme} [${t0}, ${t1}]`).toBe(true);
      const tries = [...places].sort((x, y) => x[0] - y[0]);
      for (let i = 1; i < tries.length; i++) expect(tries[i][0], `${a.id} ${forme}`).toBeGreaterThan(tries[i - 1][1]);
    }
    expect(avecBarreaux).toBeGreaterThan(1);
  });

  it('épaisseur du trait = épaisseur de la part (`faceDepthM`) en unités de viewBox', () => {
    const w = el({ x: 2, y: 2, side: 'N' });
    const [a, b] = w.ends.map((gp) => projGP(gp, top));
    const vbParM = Math.hypot(b[0] - a[0], b[1] - a[1]) / MPT;
    const face = w.faces.find((f) => f.material.part === 'face')!;
    expect(coupes(dessusDuMur(w, top, MPT))[1].largeur).toBeCloseTo(faceDepthM(face)! * vbParM, 12);
  });

  it('`dessusSvg` : par tronçon, bord puis cœur en `butt`, segment unité posé et étiré LE LONG de l’arête à max(longueur, plancher), largeurs EN TRAVERS, tout en STYLE sur `var(--k)` ; le surplomb en tirets calés sur l’origine de l’arête', () => {
    const pose = (cx: number, cy: number, angle: number, long: number) => `transform:translate(${cx}px, ${cy}px) rotate(${angle}rad) scale(max(${long}, 2 / var(--k)), 1)`;
    const diag = pose(2, 3, Math.PI / 4, Math.hypot(2, 2));
    expect(dessusSvg([
      { classe: 'surplomb', troncons: [{ t0: 0.25, t1: 0.5, de: [1, 0], a: [2, 0] }], largeur: 3, tons: { coeur: '#222222', bord: '#aaaaaa' } },
      { classe: 'coupe', troncons: [{ t0: 0, t1: 1, de: [1, 2], a: [3, 4] }], largeur: 5, tons: { coeur: '#6e5940', bord: '#261f16' } },
    ])).toBe('<g>' +
      `<path d="M-0.5 0L0.5 0" fill="none" stroke="#aaaaaa" stroke-linecap="butt" pathLength="14" stroke-dasharray="3 5" stroke-dashoffset="14" class="mur-surplomb mur-bord" style="${pose(1.5, 0, 0, 1)};stroke-width:calc(max(3, 3 / var(--k)) + 2 / var(--k))"/>` +
      `<path d="M-0.5 0L0.5 0" fill="none" stroke="#222222" stroke-linecap="butt" pathLength="14" stroke-dasharray="3 5" stroke-dashoffset="14" class="mur-surplomb mur-coeur" style="${pose(1.5, 0, 0, 1)};stroke-width:max(3, 3 / var(--k))"/>` +
      `<path d="M-0.5 0L0.5 0" fill="none" stroke="#261f16" stroke-linecap="butt" class="mur-coupe mur-bord" style="${diag};stroke-width:calc(max(5, 3 / var(--k)) + 2 / var(--k))"/>` +
      `<path d="M-0.5 0L0.5 0" fill="none" stroke="#6e5940" stroke-linecap="butt" class="mur-coupe mur-coeur" style="${diag};stroke-width:max(5, 3 / var(--k))"/></g>`);
  });

  it('ordre de peinture sous, surplomb, coupe ; le surplomb, UN trait par couleur', () => {
    const rang = (c: string) => ['sous', 'surplomb', 'coupe'].indexOf(c);
    for (const [quoi, w] of elementsDuCatalogue()) {
      const dessus = dessusDuMur(w, top, MPT);
      const classes = dessus.map((t) => t.classe);
      expect([...classes].sort((x, y) => rang(x) - rang(y)), quoi).toEqual(classes);
      const couleurs = dessus.filter((t) => t.classe === 'surplomb').map((t) => t.tons.coeur);
      expect(new Set(couleurs).size, quoi).toBe(couleurs.length);
    }
  });

  it('SURPLOMB : chaque part garde SA couleur — tout tronçon en surplomb est couvert par le trait de sa couleur', () => {
    const fautes: string[] = [];
    let multicolores = 0;
    for (const [quoi, w] of elementsDuCatalogue()) {
      const traits = dessusDuMur(w, top, MPT).filter((t) => t.classe === 'surplomb');
      if (traits.length > 1) multicolores++;
      for (const e of coupeDuMur(w.faces, w.ends, HAUTEUR_DE_COUPE_M, MPT).filter((x) => x.classe === 'surplomb')) {
        const c = wallPartColor(structureAppearance(e.apparence), e.part);
        const trait = traits.find((t) => t.tons.coeur === c);
        if (!trait?.troncons.some((r) => r.t0 <= e.t0 + 1e-12 && r.t1 >= e.t1 - 1e-12)) fautes.push(`${quoi} : ${e.part} ${c} [${e.t0}, ${e.t1}]`);
      }
    }
    expect(multicolores).toBeGreaterThan(0);
    expect(fautes).toEqual([]);
  });

  it('SURPLOMB : la phase des tirets de CHAQUE chemin est calée sur l’origine de l’arête, à la même densité par arête', () => {
    const fautes: string[] = [];
    for (const [quoi, w] of [...elementsDuCatalogue(), ['diagonale', el({ x: 2, y: 2, side: '\\' })] as [string, WallEl]]) {
      const [A, B] = w.ends.map((gp) => projGP(gp, top));
      const arete = Math.hypot(B[0] - A[0], B[1] - A[1]);
      for (const p of chemins(wallSvg(w, top, { mpt: MPT })).filter((x) => x.classe === 'surplomb')) {
        const long = Math.hypot(p.a[0] - p.de[0], p.a[1] - p.de[1]);
        const origine = [p.de[0] - ((p.a[0] - p.de[0]) * p.offset!) / p.pathLength!, p.de[1] - ((p.a[1] - p.de[1]) * p.offset!) / p.pathLength!];
        if (Math.hypot(origine[0] - A[0], origine[1] - A[1]) > 1e-9) fautes.push(`${quoi} : origine ${origine} ≠ ${A}`);
        if (Math.abs(p.pathLength! / long - 56 / arete) > 1e-9) fautes.push(`${quoi} : densité ${p.pathLength! / long} ≠ ${56 / arete}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('bloc plein : la même coupe, d’UNE face de mur nu', () => {
    const [, dessus] = bloc();
    expect(dessus.map((t) => [t.classe, t.tons.coeur])).toEqual([['coupe', structureAppearance(APPARENCE_MUR_NU).face]]);
  });

  it("contrat BICOLORE : chaque trait, TOUTE classe, porte en cœur la couleur de sa part et en bord un ton à ≥ 2 × SEUIL_TEINTES_CONTIGUES — l'un des deux tient le seuil contre chaque sol du catalogue", () => {
    const fautes: string[] = [];
    expect(SOLS.length).toBeGreaterThan(10);
    const rendus: [string, TraitDuDessus[]][] = [bloc(), ...elementsDuCatalogue().map(([quoi, w]): [string, TraitDuDessus[]] => [quoi, dessusDuMur(w, top, MPT)])];
    for (const [quoi, dessus] of rendus) {
      expect(dessus.length, `${quoi} : au moins un trait`).toBeGreaterThan(0);
      for (const { classe, tons: { coeur, bord } } of dessus) {
        if (distanceTeinte(bord, coeur) < 2 * SEUIL_TEINTES_CONTIGUES) fautes.push(`${quoi} ${classe} : ${bord} ⇄ ${coeur}`);
        for (const [sol, c] of SOLS)
          if (Math.max(distanceTeinte(bord, c), distanceTeinte(coeur, c)) < SEUIL_TEINTES_CONTIGUES) fautes.push(`${quoi} ${classe} sur ${sol}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it.each([
    ['porte-de-ville', 'porte-ouverte', false, ['dalle', 'pave', 'roche', 'route', 'relief:pierre']],
    ['porte-de-ville', 'porte-fermee', true, ['roche']],
    ['porte-de-ville', 'porte-ouverte', true, ['roche']],
    ['porte-de-ville', 'fermeture-fixe', true, ['roche']],
    ['cloison-basse-a-ossature-en-bois', 'mur-fenetre', true, ['bois', 'boue', 'cendre', 'tourbe']],
    ['cloture-en-clayonnage', 'mur-nu', true, ['bois', 'boue', 'herbe', 'plancher', 'roche', 'sol', 'terre', 'tourbe']],
    ['garde-corps', 'mur-nu', true, ['bois', 'boue', 'cendre', 'tourbe']],
    ['cloison-basse-a-ossature-en-bois', 'mur-nu', true, ['bois', 'boue', 'cendre', 'tourbe']],
  ] as const)('VISIBLE, peint : %s %s (abattue : %s) se lit sur %j', (app, forme, down, sols) => {
    const svg = wallSvg(el(seg(app, forme), down ? abattu : undefined), top, { mpt: MPT });
    const peintes = chemins(svg);
    expect(peintes.length).toBeGreaterThan(0);
    for (const sol of sols) {
      const c = SOLS.find(([id]) => id === sol)![1];
      expect(peintes.some((p) => distanceTeinte(p.couleur, c) >= SEUIL_TEINTES_CONTIGUES), sol).toBe(true);
    }
  });

  it('porte FERMÉE à vantail : le cœur du vantail ⇄ le bord des jambages qui le coiffent au plancher des teintes contiguës', () => {
    const portes = structureAppearances.filter((d) => !d.parapet && !d.claireVoie && formesAdmises(d).includes('porte-fermee'));
    for (const a of portes) {
      const traits = coupes(dessusDuMur(el(seg(a.id, 'porte-fermee')), top, MPT));
      const vantail = traits.find((t) => t.tons.coeur === wallPartColor(a, 'vantail'))!;
      const jambage = traits.find((t) => t.tons.coeur === wallPartColor(a, 'jambage'))!;
      expect(distanceTeinte(vantail.tons.coeur, jambage.tons.bord), a.id).toBeGreaterThanOrEqual(SEUIL_TEINTES_CONTIGUES);
    }
  });

  it('chemin réel `layer.height` → `buildWalls` → `wallSvg` : le garde-corps peint les mêmes chemins aux bases 0 / 0,3 / 0,4 / 0,9 / 1,3', () => {
    const rendus = [0, 0.3, 0.4, 0.9, 1.3].map((base) => {
      const s = emptyScene(6, 6);
      s.layers[0].height = Array(36).fill(base);
      s.walls = [seg('garde-corps', 'mur-nu')];
      return chemins(wallSvg(buildWalls(s)[0], top, { mpt: MPT })).map((p) => `${p.classe}:${p.role}:${p.couleur}`);
    });
    expect(rendus[0].length).toBeGreaterThan(0);
    for (const r of rendus) expect(r).toEqual(rendus[0]);
  });

  it('`svgCache` : la chaîne ne lit l’échelle que par `var(--k)` — identique à tout zoom', () => {
    const w = el({ x: 2, y: 2, side: 'N' });
    const svgs = [0.4, 1, 4].map((zoom) => wallSvg(w, top, { mpt: MPT, zoom }));
    expect(svgs[0]).toContain('var(--k)');
    for (const s of svgs) expect(s).toBe(svgs[0]);
  });
});
