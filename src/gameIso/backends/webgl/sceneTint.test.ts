/**
 * SCISSION bake ⇄ teinte, et CHAMP CONTINU DE VISIBILITÉ (#1176, C6). Deux affaires, un seul canal :
 *  - la géométrie du monde ne se rejoue PAS quand la visibilité change (identité du bake, pureté de la
 *    passe, budget) ;
 *  - la teinte s'échantillonne AU SOMMET, à sa position monde, dans le champ que
 *    `visibilityTint.visibilityField` interpole entre centres de case. La grille est du système de jeu :
 *    une masse qui couvre 17 cases ne se teinte plus d'un bloc par sa case d'ancrage, et la frontière
 *    du brouillard traverse les faces au lieu de se décalquer sur le quadrillage.
 *
 * La loi n'est pas relue depuis l'implémentation : les attendus se RE-DÉRIVENT ici, de la couleur nue
 * du span × sa variance × le champ échantillonné à la position du sommet × la porte du modelé.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyVisibilityTint,
  bakeWorldGeometry,
  buildWorldGeometry,
  shadeSousSoleil,
  worldBakeDeps,
  type BakedWorld,
  type TintAt,
} from './sceneMeshes';
import { memoByRefDeps } from '../../../state/sceneMemo';
import { tintOf, visibilityField } from './visibilityTint';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
const areneConstruit = arene.construire();

const scene = areneConstruit.scene;
const mpt = sceneMetresPerTile(scene);

/** Le bake d'une scène, RETENU par son read-set réel (`worldBakeDeps`) — exactement le patron de
 *  l'écran (`stage/GameStage3D.tsx`, `memoByRefDeps`). Ce banc rejoue la même scène d'un `it` à
 *  l'autre : la passe LOURDE se paie une fois, la TEINTE (`applyVisibilityTint`, en place) se
 *  recalcule à chaque appel. Un `it` qui MUTE la scène obtient une identité neuve, donc un bake frais.
 *  Le contrat de NON-RETRIANGULATION ci-dessous, dont le SUJET est la géométrie cuite elle-même, cuit
 *  la sienne et ne passe pas par ici. */
const bakeRetenu = memoByRefDeps<Scene, BakedWorld>();
const cuire = (s: Scene, m: number): BakedWorld => bakeRetenu(s, worldBakeDeps(s, m), () => bakeWorldGeometry(s, m));

/** Teinte de VISIBILITÉ non triviale : les trois états de la politique se répartissent sur la carte —
 *  une teinte constante ne prouverait rien d'un index sommet → monde. */
const tintA: TintAt = (x, y) => {
  const k = (Math.round(x) + Math.round(y)) % 3;
  return k === 0 ? 1 : k === 1 ? 0.42 : 0.15;
};
const tintB: TintAt = (x, y, z) => 1 - tintA(x, y, z) * 0.5;
/** Champ UNIFORME — le neutre de l'échantillonnage : quelle que soit la position du sommet, une seule
 *  valeur. C'est le régime où la loi d'AVANT (une teinte par span) et celle-ci coïncident. */
const uniforme = (v: number): TintAt => () => v;

const couleurs = (g: { getAttribute(n: string): { array: ArrayLike<number> } }): Float32Array =>
  (g.getAttribute('color').array as Float32Array).slice();

describe('BAKE ⇄ TEINTE — la visibilité ne retriangule rien', () => {
  it('repeindre la visibilité n’écrit que `color` : même géométrie rendue, aucun attribut ne bouge, aucune retriangulation', () => {
    // CONTRAT DE TRAVAIL, jamais un chronomètre : ce qu'on refuse à la teinte, c'est de REFAIRE la
    // passe lourde — triangulation, uv, normales, index. Cela se lit sur la géométrie elle-même (les
    // tampons qu'elle porte et leur `version`), pas sur une durée : un rapport de deux durées reste
    // deux mesures d'horloge, et la CI est une machine partagée au débit variable.
    // Cuisson FRAÎCHE, jamais `cuire` : le SUJET est CE bake, que les passes de teinte ne doivent pas
    // toucher — un bake retenu ferait dépendre l'empreinte d'avant d'un `it` voisin.
    const baked = bakeWorldGeometry(scene, mpt);
    const g = baked.geometry;
    /** Tout ce que la cuisson a posé sur la géométrie — relevé par LECTURE de la géométrie, jamais
     *  d'une liste écrite ici : un attribut ajouté au bake entre de lui-même sous le contrat. */
    const noms = Object.keys(g.attributes).sort();
    const attr = (n: string) => g.getAttribute(n) as THREE.BufferAttribute;
    const empreinte = () =>
      noms.map((n) => ({ n, array: attr(n).array, version: attr(n).version, count: attr(n).count, itemSize: attr(n).itemSize }));
    // La cuisson pose position/color/uv/uv1/perçabilité et calcule `normal` : sans ces attributs le
    // balayage ci-dessous serait vert par vacuité.
    expect(noms).toEqual(expect.arrayContaining(['color', 'normal', 'position', 'uv', 'uv1']));
    const avant = empreinte();
    const index = g.getIndex() as THREE.BufferAttribute;
    const indexArray = index.array;
    const indexVersion = index.version;
    const sommets = attr('position').count;
    const triangles = index.count / 3;
    const groupes = g.groups.map((gr) => ({ ...gr }));
    const nu = couleurs(g);

    const PASSES = 3;
    const rendus = new Set<THREE.BufferGeometry>();
    for (let i = 0; i < PASSES; i++) rendus.add(applyVisibilityTint(baked, i % 2 ? tintA : tintB).geometry);

    // La géométrie RENDUE est celle du bake : c'est le contrat de propriété de `BakedWorld` — la
    // seconde teinte remplace la première à l'écran, elle ne coexiste pas avec elle. Un second
    // consommateur de teinte cuit SON bake.
    expect([...rendus]).toEqual([g]);
    const après = empreinte();
    expect(après.map((a) => a.n)).toEqual(noms); // aucun attribut ajouté ni retiré en cours de teinte
    for (let k = 0; k < noms.length; k++) {
      const a = avant[k];
      const b = après[k];
      expect(b.array, `attribut \`${b.n}\` : tampon RÉALLOUÉ par la teinte`).toBe(a.array);
      expect(b.count, `attribut \`${b.n}\` : nombre de sommets changé`).toBe(a.count);
      expect(b.itemSize, `attribut \`${b.n}\``).toBe(a.itemSize);
      // `needsUpdate = true` incrémente la `version` de l'attribut (three r1xx, `BufferAttribute` :
      // accesseur en écriture seule) — mesuré ici à UNE unité par passe. Seul `color` la voit monter :
      // sans ça le GPU garderait les couleurs de la frame précédente ; toute autre montée signalerait
      // un attribut ré-écrit, donc une part de la cuisson rejouée.
      expect(b.version, `attribut \`${b.n}\` : version ${a.version} → ${b.version} pour ${PASSES} passes`)
        .toBe(b.n === 'color' ? a.version + PASSES : a.version);
    }
    // INDEX : le même objet, le même tampon, intouché — la teinte ne redessine aucun triangle.
    expect(g.getIndex()).toBe(index);
    expect(g.getIndex()!.array).toBe(indexArray);
    expect(g.getIndex()!.version).toBe(indexVersion);
    expect(attr('position').count).toBe(sommets);
    expect(index.count / 3).toBe(triangles);
    expect(g.groups.map((gr) => ({ ...gr }))).toEqual(groupes);
    // …et la teinte a bien PEINT : sans ce volet, une teinte qui ne ferait rien du tout passerait tout
    // ce qui précède.
    expect(couleurs(g)).not.toEqual(nu);
  });

  it('la teinte se re-multiplie sur la couleur NUE, jamais sur la précédente (A → B → A)', () => {
    const baked = cuire(scene, mpt);
    const premier = couleurs(applyVisibilityTint(baked, tintA).geometry);
    applyVisibilityTint(baked, tintB);
    const retour = couleurs(applyVisibilityTint(baked, tintA).geometry);
    expect(retour.length).toBe(premier.length);
    let ecart = 0;
    for (let i = 0; i < retour.length; i++) ecart = Math.max(ecart, Math.abs(retour[i] - premier[i]));
    expect(ecart).toBeLessThan(1e-9);
  });

  it('`buildWorldGeometry` reste la composition des deux (mêmes couleurs, même compte)', () => {
    const compose = couleurs(buildWorldGeometry(scene, mpt, tintA));
    const enDeuxTemps = couleurs(applyVisibilityTint(cuire(scene, mpt), tintA).geometry);
    expect(compose).toEqual(enDeuxTemps);
  });
});

/** Teinte RE-DÉRIVÉE de la loi pour le sommet `v` : couleur nue du span × sa variance × le champ
 *  échantillonné À LA POSITION MONDE du sommet (ramenée en cases) × la porte du modelé. Aucun terme
 *  n'est relu de l'implémentation jugée. */
function attenduAuSommet(baked: BakedWorld, spanIdx: number, v: number, tintAt: TintAt, fade = 1): THREE.Color {
  const span = baked.spans[spanIdx];
  const pos = baked.geometry.getAttribute('position').array as Float32Array;
  const champ = tintAt(pos[v * 3] / baked.mpt, pos[v * 3 + 2] / baked.mpt, span.cell.z);
  const k = shadeSousSoleil(baked.shades[v], fade) * champ;
  return new THREE.Color().set(span.color).multiplyScalar(span.varFactor * k);
}

describe('CHAMP CONTINU — la teinte s’échantillonne AU SOMMET, pas à la case d’ancrage', () => {
  it('chaque sommet porte la valeur du champ À SA POSITION (loi re-dérivée, arène entière)', () => {
    const baked = cuire(scene, mpt);
    const arr = couleurs(applyVisibilityTint(baked, tintA).geometry);
    let vus = 0;
    // Tous les spans, un sommet sur sept : la couverture est la SCÈNE, pas un échantillon choisi.
    baked.spans.forEach((span, s) => {
      for (let v = span.start; v < span.start + span.count; v += 7) {
        const c = attenduAuSommet(baked, s, v, tintA);
        expect(arr[v * 3]).toBeCloseTo(c.r, 6);
        expect(arr[v * 3 + 1]).toBeCloseTo(c.g, 6);
        expect(arr[v * 3 + 2]).toBeCloseTo(c.b, 6);
        vus++;
      }
    });
    expect(vus).toBeGreaterThan(1000);
  });

  it('champ UNIFORME ⇒ teinte UNIFORME : aucune variation fantôme dans un span', () => {
    const baked = cuire(scene, mpt);
    const arr = couleurs(applyVisibilityTint(baked, uniforme(0.5)).geometry);
    for (const span of baked.spans) {
      const r0 = arr[span.start * 3];
      const g0 = arr[span.start * 3 + 1];
      const b0 = arr[span.start * 3 + 2];
      for (let v = span.start; v < span.start + span.count; v++) {
        expect(arr[v * 3]).toBe(r0);
        expect(arr[v * 3 + 1]).toBe(g0);
        expect(arr[v * 3 + 2]).toBe(b0);
      }
    }
  });

  it('champ uniforme : la teinte reste un SCALAIRE exact sur la couleur pleine', () => {
    const baked = cuire(scene, mpt);
    const plein = couleurs(applyVisibilityTint(baked, uniforme(1)).geometry);
    const demi = couleurs(applyVisibilityTint(baked, uniforme(0.5)).geometry);
    for (let i = 0; i < plein.length; i += 331) expect(demi[i]).toBeCloseTo(plein[i] * 0.5, 6);
  });
});

/**
 * LA SONDE DE L'AUDIT, PROMUE EN CONTRAT. Sur une scène à masses multi-cases (vitrine des bâtiments),
 * une frontière de visibilité qui traverse une masse doit se lire DANS la masse. Sous la loi d'avant
 * (`tintAt(span.cellKey)`), tout l'élément prenait la teinte de sa seule case d'ancrage — jusqu'à 17
 * cases teintées d'un bloc.
 */
describe('FRONTIÈRE — une masse à cheval sur le brouillard n’est plus teintée d’un bloc', () => {
  const vitrine: Scene = buildVitrineScene();
  const mv = sceneMetresPerTile(vitrine);
  const { w, h } = vitrine.dimensions;
  /** Demi-carte VUE : la frontière tombe entre les colonnes `mi-1` et `mi`, en plein dans les masses. */
  const mi = Math.floor(w / 2);
  const vues = new Set<string>();
  for (const l of vitrine.layers) for (let y = 0; y < h; y++) for (let x = 0; x < mi; x++) vues.add(`${x},${y},${l.z}`);
  const champ = visibilityField(vues, new Set<string>(), vitrine.dimensions);

  it('des spans portent des teintes DIFFÉRENTES d’un sommet à l’autre (fin du bloc uniforme)', () => {
    const baked = cuire(vitrine, mv);
    const arr = couleurs(applyVisibilityTint(baked, champ).geometry);
    let panachés = 0;
    let ecartMax = 0;
    for (const span of baked.spans) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = span.start; v < span.start + span.count; v++) {
        lo = Math.min(lo, arr[v * 3]);
        hi = Math.max(hi, arr[v * 3]);
      }
      if (hi - lo > 1e-6) panachés++;
      ecartMax = Math.max(ecartMax, hi - lo);
    }
    expect(panachés).toBeGreaterThan(20);
    expect(ecartMax).toBeGreaterThan(0.05);
  });

  /**
   * LE FONDU LUI-MÊME, lu SUR LE RENDU. Le contrat ci-dessus (« des teintes différentes dans un span »)
   * ne suffit pas : un échantillonnage au PLUS PROCHE VOISIN le satisferait aussi — deux sommets d'une
   * même face tombant dans deux cases voisines y prendraient déjà deux valeurs, franches. Ce qui
   * distingue le champ CONTINU, c'est qu'il produit des valeurs INTERMÉDIAIRES, que la politique par
   * case ne contient pas. La teinte rendue se récupère sans rien savoir de l'implémentation : le même
   * bake peint une fois à champ PLEIN, une fois au champ — le rapport des deux EST le facteur appliqué.
   */
  it('des sommets portent des teintes INTERMÉDIAIRES, absentes de la politique par case (le FONDU)', () => {
    const baked = cuire(vitrine, mv);
    const plein = couleurs(applyVisibilityTint(baked, uniforme(1)).geometry);
    const rendu = couleurs(applyVisibilityTint(baked, champ).geometry);
    const paliers = [tintOf('visible'), tintOf('unknown')]; // les deux seules valeurs de la politique
    const MARGE = 0.02;
    let intermédiaires = 0;
    for (let i = 0; i < plein.length; i += 3) {
      if (plein[i] < 1e-3) continue; // canal éteint : le rapport n'y est pas mesurable
      const t = rendu[i] / plein[i];
      if (paliers.every((p) => Math.abs(t - p) > MARGE) && t > Math.min(...paliers) && t < Math.max(...paliers))
        intermédiaires++;
    }
    // Mesuré à l'arbre C6 sur `vitrine-batiments` : des milliers de sommets tombent entre les paliers.
    // Au plus proche voisin il y en aurait EXACTEMENT zéro — c'est ce zéro que cette clause interdit.
    expect(intermédiaires).toBeGreaterThan(200);
  });

  it('un ÉLÉMENT multi-cases reçoit plusieurs teintes, et pas celle de sa seule case d’ancrage', () => {
    const baked = cuire(vitrine, mv);
    const pos = baked.geometry.getAttribute('position').array as Float32Array;
    // Un span dont les sommets traversent la frontière : c'est là que la loi d'ancrage mentait.
    const traversant = baked.spans.find((span) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = span.start; v < span.start + span.count; v++) {
        const t = champ(pos[v * 3] / mv, pos[v * 3 + 2] / mv, span.cell.z);
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      }
      return hi - lo > 0.1;
    });
    expect(traversant, 'la vitrine doit porter une masse à cheval sur la frontière').toBeDefined();
    // Ce que la loi d'ANCRAGE aurait peint sur TOUT l'élément : une seule couleur, celle de sa case.
    const arr = couleurs(applyVisibilityTint(baked, champ).geometry);
    const s = baked.spans.indexOf(traversant!);
    const ancrage = champ(traversant!.cell.x, traversant!.cell.y, traversant!.cell.z);
    let écarts = 0;
    const rendus = new Set<number>();
    for (let v = traversant!.start; v < traversant!.start + traversant!.count; v++) {
      rendus.add(arr[v * 3]);
      const bloc = new THREE.Color()
        .set(traversant!.color)
        .multiplyScalar(traversant!.varFactor * shadeSousSoleil(baked.shades[v], 1) * ancrage);
      if (Math.abs(arr[v * 3] - bloc.r) > 1e-3) écarts++;
      // …et le sommet porte bien, LUI, la valeur du champ à sa position.
      const c = attenduAuSommet(baked, s, v, champ);
      expect(arr[v * 3]).toBeCloseTo(c.r, 6);
    }
    expect(rendus.size).toBeGreaterThan(1); // plusieurs teintes RENDUES dans le même élément
    expect(écarts).toBeGreaterThan(0); // …dont certaines s'écartent franchement du bloc d'ancrage
  });

  it('les CORPS, eux, restent posés sur leur case : le champ y rend la valeur discrète', () => {
    // Un billboard n'a qu'une couleur pour tout son quad ; le champ, aux coordonnées entières de sa
    // case, rend exactement la teinte de cette case — l'échantillonnage continu ne les bouge pas.
    expect(champ(0, 0, 0)).toBe(tintOf('visible'));
    expect(champ(w - 1, 0, 0)).toBe(tintOf('unknown'));
  });
});
