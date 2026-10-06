/**
 * SCISSION cuisson ⇄ DÉGAGEMENT (#1176, lot P2-2b) : le monde cuit ne se rejoue PAS quand le groupe se
 * déplace sous une masse. Le dégagement d'architecture est un MASQUE D'INDEX posé en place sur le bake,
 * jumeau de `applyVisibilityTint` — ce fichier tient ses quatre clauses : INVARIANCE du bake (aucun
 * attribut de la cuisson n'est ré-écrit, l'index seul l'est), PARITÉ de rendu avec le bake filtré
 * qu'il remplace, idempotence, et accents de sol emportés par la nappe qui les porte.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import {
  applyCutawayMask,
  applyVisibilityTint,
  bakeWorldGeometry,
  surfaceGrouping,
  worldBakeDeps,
  worldFaces,
  type BakedWorld,
  type KeepEl,
} from './sceneMeshes';
import { memoByRefDeps } from '../../../state/sceneMemo';
import { facesGeometry } from './worldTris';
import { faceDepthOf } from './faceRelief';
import { mountGroundAccentLots, reposeGroundAccents, sceneGroundAccents } from './groundAccents';
import type { SceneEl } from '../../builders/types';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
const areneConstruit = arene.construire();

const scene = areneConstruit.scene;
const mpt = sceneMetresPerTile(scene);

/** Le bake d'une scène-témoin, RETENU par son read-set réel (`worldBakeDeps`) — exactement le patron
 *  de l'écran (`stage/GameStage3D.tsx`, `memoByRefDeps`) et du banc de teinte (`sceneTint.test.ts`).
 *  Le dégagement est un MASQUE D'INDEX posé EN PLACE qui se relit du bake (clause d'IDEMPOTENCE plus
 *  bas) : les cas de ce fichier rejouent les mêmes deux scènes, la cuisson se paie donc une fois par
 *  scène et par run. Le contrat de TRAVAIL, dont le SUJET est la géométrie cuite elle-même, cuit la
 *  sienne et ne passe pas par ici. Un `it` qui MUTE une scène obtient une identité neuve, donc un bake frais. */
const bakeRetenu = memoByRefDeps<Scene, BakedWorld>();
const cuire = (scn: Scene): BakedWorld => {
  const m = sceneMetresPerTile(scn);
  return bakeRetenu(scn, worldBakeDeps(scn, m), () => bakeWorldGeometry(scn, m, 'jeu'));
};

/** Trois lois de dégagement DÉTERMINISTES — elles ne singent pas `cutawayForSection`, elles la
 *  remplacent par des verdicts reproductibles portant sur les trois natures d'élément à faces. */
const LOIS: Record<string, KeepEl> = {
  'sans-toits': (el) => el.kind !== 'roof',
  'damier-murs': (el) => !(el.kind === 'wall' && (el.cell.x + el.cell.y) % 2 === 0),
  z0: (el) => el.cell.z === 0,
};

const tint = (x: number, y: number): number => {
  const k = (Math.round(x) + Math.round(y)) % 3;
  return k === 0 ? 1 : k === 1 ? 0.42 : 0.15;
};

const copie = (g: THREE.BufferGeometry, nom: string): Float32Array =>
  (g.getAttribute(nom).array as Float32Array).slice();

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Les faces RÉELLEMENT DESSINÉES, relues dans l'INDEX (jamais dans les `spans` : ce serait relire
 *  l'intention au lieu du rendu) — par groupe de surface, dans l'ordre de dessin. Vérifie au passage
 *  que chaque face gardée y est CONTIGUË et complète : un index compacté à moitié lèverait ici.
 *  Le balayage NOMME ses fautes et n'appelle `expect` qu'UNE fois : l'index de l'arène porte des
 *  dizaines de milliers de sommets, et une assertion par sommet coûte plus que la cuisson qu'elle
 *  juge. */
function facesRendues(baked: BakedWorld): Map<string, string[]> {
  const parDébut = new Map(baked.spans.map((s) => [s.start, s] as const));
  const idx = baked.geometry.getIndex()!.array as Uint32Array;
  const groupes = baked.geometry.userData.surfaceGroups;
  const out = new Map<string, string[]>();
  const fautes: string[] = [];
  for (const g of baked.geometry.groups) {
    const liste: string[] = [];
    let p = g.start;
    while (p < g.start + g.count) {
      const s = parDébut.get(idx[p]);
      if (!s) { fautes.push(`index ${p} : aucun début de face`); break; }
      for (let k = 0; k < s.count; k++) {
        if (idx[p + k] === s.start + k) continue;
        fautes.push(`index ${p + k} : la face ${s.cell.x},${s.cell.y},${s.cell.z} n’est pas contiguë (${idx[p + k]} au lieu de ${s.start + k})`);
        break;
      }
      liste.push(`${s.cell.x},${s.cell.y},${s.cell.z}#${s.count}`);
      p += s.count;
    }
    if (liste.length) out.set(groupes[g.materialIndex!].key, liste);
  }
  expect(fautes, 'une face gardée n’est ni contiguë ni complète dans l’index dessiné').toEqual([]);
  return out;
}

/** Empreinte d'un rendu : nombre de groupes non vides, nombre de faces, et hachage de la liste ordonnée
 *  des faces par groupe. Elle ignore les POSITIONS — le rang coplanaire se calcule désormais sur la
 *  scène ENTIÈRE (contrat de `coplanarRanks`, cf. `builtFacesBox`), donc une face gardée peut sortir à
 *  un biais de 1,5 mm différent de celui qu'elle avait dans un bake amputé. C'est l'ENSEMBLE des
 *  triangles rendus que la parité juge. */
function empreinteDe(parGroupe: Map<string, string[]>): { groupes: number; faces: number; digest: string } {
  const clefs = [...parGroupe.keys()].sort();
  let faces = 0;
  for (const k of clefs) faces += parGroupe.get(k)!.length;
  const s = clefs.map((k) => `${k}=${parGroupe.get(k)!.length}:${fnv(parGroupe.get(k)!.join(','))}`).join(';');
  return { groupes: clefs.length, faces, digest: fnv(s) };
}

const empreinte = (baked: BakedWorld) => empreinteDe(facesRendues(baked));

/** RECONSTRUCTION INDÉPENDANTE de l'implémentation d'AVANT (lot P2-2 : le filtre s'appliquait à la
 *  CUISSON, `bakeWorldGeometry(scene, mpt, keepEl)`) — les faces sont écartées AVANT triangulation et
 *  groupement, et l'empreinte se lit sur ce bake amputé. Le témoin de parité n'est donc PAS une
 *  constante capturée à croire : il se recalcule à chaque run depuis les mêmes briques publiques
 *  (`worldFaces` → `facesGeometry` → `surfaceGrouping`), sans passer par le masque qu'il juge. */
function empreinteBakeFiltré(scn: Scene, keepEl: KeepEl): { groupes: number; faces: number; digest: string } {
  const m = sceneMetresPerTile(scn);
  const listées = worldFaces(scn, 'jeu').filter((wf) => keepEl(wf.el));
  const geoms = facesGeometry(listées.map((f) => f.face), m, faceDepthOf());
  const { groups, faceIndices } = surfaceGrouping(listées, m);
  const parGroupe = new Map<string, string[]>();
  faceIndices.forEach((idx, k) => {
    if (!idx.length) return;
    // Sommets d'une face = 3 par triangle (aucun sommet partagé : index IDENTITÉ au bake).
    parGroupe.set(groups[k].key, idx.map((i) => `${listées[i].cellKey}#${geoms[i].tris.length * 3}`));
  });
  return empreinteDe(parGroupe);
}

function masqué(scn: Scene, keepEl: KeepEl): BakedWorld {
  const baked = cuire(scn);
  applyCutawayMask(baked, keepEl);
  return baked;
}

describe('INVARIANCE — deux dégagements, UN seul bake', () => {
  it('le masque n’écrit QUE l’index : aucun attribut de la cuisson ne bouge, tampon ni version', () => {
    // CONTRAT DE TRAVAIL, jamais un chronomètre : ce que le masque doit refuser est la passe LOURDE
    // (triangulation, uv, normales), et c'est la GÉOMÉTRIE qui le porte — pas une durée. Mesures
    // fondatrices (#1176) : bake plein 437 ms sur l'arène, 1 601 ms sur l'opéra, quand `cleared`
    // change à CHAQUE pas (identités `visualAllies`/`exploredSet`) ET à chaque cran de caméra
    // (`dims` → `frontFacadeCutaway`) ; le re-bake par pas coûtait +700 ms mesurés au navigateur. Le
    // rapport de deux durées qui tenait cette clause reste deux mesures d'horloge, et la CI est une
    // machine partagée au débit variable (#1788).
    const baked = cuire(scene);
    applyVisibilityTint(baked, tint);
    const gA = applyCutawayMask(baked, LOIS['sans-toits']).geometry;
    /** Relevé par LECTURE de la géométrie, jamais d'une liste écrite ici : un attribut ajouté au bake
     *  entre de lui-même sous le contrat. */
    const noms = Object.keys(gA.attributes).sort();
    const attr = (n: string) => gA.getAttribute(n) as THREE.BufferAttribute;
    const empreinteAttrs = () =>
      noms.map((n) => ({ n, array: attr(n).array, version: attr(n).version, count: attr(n).count }));
    // La cuisson pose position/color/uv/uv1/perçabilité et calcule `normal` : sans ces attributs le
    // balayage ci-dessous serait vert par vacuité.
    expect(noms).toEqual(expect.arrayContaining(['color', 'normal', 'position', 'uv', 'uv1']));
    const avant = empreinteAttrs();
    const attrPos = gA.getAttribute('position');
    const posA = copie(gA, 'position');
    const colA = copie(gA, 'color');
    const comptesA = gA.groups.map((g) => g.count);
    const index = gA.getIndex() as THREE.BufferAttribute;
    const indexArray = index.array;
    const versionA = index.version;

    const gB = applyCutawayMask(baked, LOIS['damier-murs']).geometry;

    // La géométrie rendue EST le bake — contrat de propriété de `BakedWorld`.
    expect(gB).toBe(gA);
    const après = empreinteAttrs();
    expect(après.map((a) => a.n)).toEqual(noms); // aucun attribut ajouté ni retiré par le masque
    for (let k = 0; k < noms.length; k++) {
      expect(après[k].array, `attribut \`${noms[k]}\` : tampon RÉALLOUÉ par le masque`).toBe(avant[k].array);
      expect(après[k].count, `attribut \`${noms[k]}\` : nombre de sommets changé`).toBe(avant[k].count);
      // Positions, couleurs, uv et normales sont INTOUCHÉES : une masse retirée cesse d'être RÉFÉRENCÉE
      // par l'index, elle n'est pas re-cuite — aucune `version` ne monte donc de ce côté.
      expect(après[k].version, `attribut \`${noms[k]}\` : version ${avant[k].version} → ${après[k].version}`)
        .toBe(avant[k].version);
    }
    expect(copie(gB, 'position')).toEqual(posA);
    expect(copie(gB, 'color')).toEqual(colA);
    // Seuls l'index et les plages de dessin bougent — et ils bougent VRAIMENT (la sonde mord).
    expect(gB.groups.map((g) => g.count)).not.toEqual(comptesA);
    // L'index est ré-écrit EN PLACE : le même attribut, le même tampon, une `version` de plus.
    expect(gB.getIndex()).toBe(index);
    expect(gB.getIndex()!.array).toBe(indexArray);
    expect(gB.getIndex()!.version).toBe(versionA + 1);
    // Le tampon d'index n'est jamais retaillé : il porte tous les sommets, les gardés en tête.
    expect(gB.getIndex()!.count).toBe(attrPos.count);
  });

  it('AUCUNE face masquée n’est dessinée, et toutes les gardées le sont', () => {
    const baked = masqué(scene, LOIS['sans-toits']);
    const rendues = [...facesRendues(baked).values()].reduce((n, l) => n + l.length, 0);
    expect(rendues).toBe(baked.spans.filter((s) => LOIS['sans-toits'](s.el)).length);
    expect(rendues).toBeLessThan(baked.spans.length); // la loi retire vraiment quelque chose
  });
});

describe('PARITÉ — le masque rend EXACTEMENT les triangles du bake filtré qu’il remplace', () => {
  // La vitrine est BÂTIE une fois : c'est son IDENTITÉ qui donne au bake retenu sa clé — une scène
  // rebâtie à chaque cas rendrait une réf neuve, donc une cuisson par cas.
  let vitrine: Scene | undefined;
  const SCENES: [string, () => Scene][] = [['arene', () => scene], ['vitrine', () => (vitrine ??= buildVitrineScene())]];

  for (const [sid, faire] of SCENES)
    it(`${sid} : les lois retirent vraiment des faces (sinon la parité ne pèserait rien)`, () => {
      const scn = faire();
      const plein = empreinteBakeFiltré(scn, () => true).faces;
      const restants = Object.keys(LOIS).map((lid) => empreinteBakeFiltré(scn, LOIS[lid]).faces);
      expect(plein).toBeGreaterThan(0);
      // `z0` est NEUTRE sur ces deux scènes (un seul étage) — elle reste un cas de parité valable ;
      // les deux autres amputent.
      expect(restants.filter((n) => n < plein).length).toBeGreaterThanOrEqual(2);
    });

  for (const [sid, faire] of SCENES)
    for (const lid of Object.keys(LOIS))
      it(`${sid} × ${lid} : mêmes groupes, mêmes faces, même ordre que le bake filtré`, () => {
        const scn = faire();
        const attendu = empreinteBakeFiltré(scn, LOIS[lid]);
        expect(attendu.faces).toBeGreaterThan(0);
        expect(empreinte(masqué(scn, LOIS[lid]))).toEqual(attendu);
      });

  for (const [sid, faire] of SCENES)
    for (const lid of Object.keys(LOIS))
      it(`${sid} × ${lid} : les plages de dessin ne se chevauchent pas et ne s’inversent pas`, () => {
        const baked = masqué(faire(), LOIS[lid]);
        const idx = baked.geometry.getIndex()!.array as Uint32Array;
        // Un balayage, deux fautes NOMMÉES, une assertion : une par sommet coûterait plus que le bake.
        const fautes: string[] = [];
        let fin = 0;
        for (const [r, g] of baked.geometry.groups.entries()) {
          // CONTIGUÏTÉ : chaque groupe reprend là où le précédent s'est arrêté — zéro chevauchement,
          // zéro trou (le masque compacte en UNE passe linéaire).
          if (g.start !== fin) fautes.push(`groupe ${r} : commence à ${g.start}, le précédent s’arrêtait à ${fin}`);
          fin = g.start + g.count;
          // ORDRE DE CUISSON conservé À L'INTÉRIEUR du groupe : les sommets référencés montent.
          for (let p = g.start + 1; p < fin; p++) {
            if (idx[p] > idx[p - 1]) continue;
            fautes.push(`groupe ${r} : l’index ${p} redescend (${idx[p]} après ${idx[p - 1]})`);
            break;
          }
        }
        expect(fautes, 'les plages de dessin se chevauchent, trouent ou inversent l’ordre de cuisson').toEqual([]);
      });
});

describe('IDEMPOTENCE — le masque se relit du bake, jamais de l’état précédent', () => {
  it('A → B → A rend les mêmes triangles que le premier A', () => {
    const baked = cuire(scene);
    applyCutawayMask(baked, LOIS['sans-toits']);
    const premier = empreinte(baked);
    const plages = baked.geometry.groups.map((g) => [g.start, g.count]);
    applyCutawayMask(baked, LOIS['damier-murs']);
    applyCutawayMask(baked, LOIS['sans-toits']);
    expect(empreinte(baked)).toEqual(premier);
    expect(baked.geometry.groups.map((g) => [g.start, g.count])).toEqual(plages);
  });
});

describe('ACCENTS DE SOL — une nappe dégagée n’emporte pas que ses faces', () => {
  it('les touffes de la nappe retirée disparaissent, celles des autres restent', () => {
    const accents = sceneGroundAccents(scene, mpt, 'jeu');
    expect(accents.length).toBeGreaterThan(100);
    // La nappe la plus SEMÉE de l'arène : la retirer doit se voir.
    const parEl = new Map<SceneEl, number>();
    for (const a of accents) parEl.set(a.el, (parEl.get(a.el) ?? 0) + 1);
    const [cible, semés] = [...parEl.entries()].sort((a, b) => b[1] - a[1])[0];
    expect(semés).toBeGreaterThan(0);
    // La loi s'applique par REPOSE du semis instancié : les retenus sont compactés en tête, `count`
    // les borne (les instances de la nappe retirée ne sont plus dessinées).
    const lots = mountGroundAccentLots(accents, { lit: false });
    reposeGroundAccents(lots, (el) => el !== cible, () => 1);
    expect(lots.map((l) => l.mesh.count).reduce((a, b) => a + b, 0)).toBe(accents.length - semés);
    for (const lot of lots)
      expect(lot.retenus.some((r) => lot.accents[r].el === cible)).toBe(false);
    // Le semis lui-même n'a pas bougé : c'est l'APPLICATION qui filtre (le bake reste invariant).
    expect(accents.length).toBe(sceneGroundAccents(scene, mpt, 'jeu').length);
  });
});
