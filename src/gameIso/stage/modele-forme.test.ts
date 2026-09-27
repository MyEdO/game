/**
 * MODELÉ DE FORME de la voie volumique (#1300) — ce qui donne à un intérieur ses angles quand aucune
 * lampe ne les sépare : un facteur d'irradiance ambiante par FAMILLE D'ORIENTATION, multiplié dans la
 * couleur de sommet, et une PORTE qui l'efface à mesure que le vrai soleil prend le relais.
 *
 * Quatre étages, tous nécessaires :
 *  1. le CONTRAT des six familles (donnée `AMBIANCE.faceShade`) : aucune paire cycliquement adjacente
 *     jumelle, un rapport max/min borné, et les deux horizontales séparées ;
 *  2. la LECTURE de la famille sur la normale telle que la loi d'orientation la PRÉSENTE — mesuré :
 *     100 % des triangles de sol sortent du pivot normale vers le bas ;
 *  3. le CÂBLAGE : le facteur arrive réellement dans l'attribut `color` du monde cuit ;
 *  4. la CONTINUITÉ de la porte à l'aube — la même exigence que le fondu du soleil (aucun saut d'un
 *     centième d'albédo par minute), tenue cette fois sur ce que MONTRE une face verticale.
 *
 * Cinquième clause, sur l'autre canal de modelé : les flaques de lampe (#1245) sont ÉTEINTES dans un
 * intérieur par défaut — le FAIT que ce lot ne change pas, et qui décide de ce qu'il restait à faire.
 */
import { describe, expect, it } from 'vitest';
import { AMBIANCE } from '../catalog/ambiance';
import { applyVisibilityTint, bakeWorldGeometry, shadeSousSoleil, worldBakeDeps, type BakedWorld } from '../backends/webgl/sceneMeshes';
import { memoByRefDeps } from '../../state/sceneMemo';
import { SHADE_CYCLE, shadeFamily, type ShadeFamily } from '../backends/webgl/worldTris';
import { shadeFactorOf } from '../backends/webgl/faceColors';
import { extinctionDe, pointLightWrites } from './stagePointLights';
import { stageLightScalars } from './stageLights';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { scenario as arene } from '../../scenes/test-scenarios/arene';
import { scenario as opera } from '../../scenes/test-scenarios/opera';
const operaConstruit = opera.construire();
const areneConstruit = arene.construire();

/** Le bake d'une scène, RETENU par son read-set réel (`worldBakeDeps`) — le patron de l'écran
 *  (`GameStage3D.tsx`, `memoByRefDeps`). L'arène et l'opéra sont recuits par plusieurs `it` de ce
 *  banc ; la passe LOURDE se paie une fois par scène, la teinte (`applyVisibilityTint`, en place) se
 *  recalcule à chaque appel. Une scène fabriquée sur place a une identité neuve, donc un bake frais. */
const bakeRetenu = memoByRefDeps<Scene, BakedWorld>();
const cuire = (s: Scene, m: number): BakedWorld => bakeRetenu(s, worldBakeDeps(s, m), () => bakeWorldGeometry(s, m));

const N = {
  haut: { x: 0, y: 1, z: 0 },
  bas: { x: 0, y: -1, z: 0 },
  '-z': { x: 0, y: 0, z: -1 },
  '+x': { x: 1, y: 0, z: 0 },
  '+z': { x: 0, y: 0, z: 1 },
  '-x': { x: -1, y: 0, z: 0 },
} as const;

describe('#1300 — le CONTRAT des six familles d’orientation', () => {
  it('chaque famille se lit sur sa normale, et les six facteurs viennent de la DONNÉE', () => {
    const table = (Object.keys(N) as ShadeFamily[]).map((f) => [f, shadeFamily(N[f]), +shadeFactorOf(shadeFamily(N[f])).toFixed(4)]);
    expect(table).toEqual([
      ['haut', 'haut', AMBIANCE.faceShade.haut],
      ['bas', 'bas', AMBIANCE.faceShade.bas],
      ['-z', '-z', AMBIANCE.faceShade.verticales[0]],
      ['+x', '+x', AMBIANCE.faceShade.verticales[1]],
      ['+z', '+z', AMBIANCE.faceShade.verticales[2]],
      ['-x', '-x', AMBIANCE.faceShade.verticales[3]],
    ]);
  });

  it('AUCUNE paire cycliquement adjacente n’est jumelle — bouclage compris', () => {
    // C'est LE défaut que le lot corrige : deux faces qui forment un angle et rendent la même couleur
    // ne se lisent plus comme deux plans. Les quatre verticales tournent dans l'ordre de la grille, et
    // la paire qui boucle (la quatrième et la première) compte comme les autres.
    const paires = SHADE_CYCLE.map((f, i) => [f, SHADE_CYCLE[(i + 1) % SHADE_CYCLE.length]] as const);
    expect(paires).toEqual([['-z', '+x'], ['+x', '+z'], ['+z', '-x'], ['-x', '-z']]);
    for (const [a, b] of paires) {
      const écart = Math.abs(shadeFactorOf(a) - shadeFactorOf(b));
      expect([a, b, écart > 0.05]).toEqual([a, b, true]);
    }
  });

  it('l’angle SOL↔MUR est modelé lui aussi : aucune verticale ne rend la valeur de l’horizontale', () => {
    // La paire covisible la plus fréquente de toute la scène est la PLINTHE — un sol et le mur qu'il
    // rejoint. À valeur égale leur arête disparaît, exactement comme deux murs jumeaux. Les quatre
    // verticales passent donc SOUS l'horizontale haute, la première comprise.
    for (const f of SHADE_CYCLE) {
      const écart = shadeFactorOf('haut') - shadeFactorOf(f);
      expect([f, écart > 0.02]).toEqual([f, true]);
    }
    expect(AMBIANCE.faceShade.verticales[0]).toBeLessThan(AMBIANCE.faceShade.haut);
  });

  it('le rapport max/min des verticales est celui de la donnée, et il est BORNÉ', () => {
    const v = [...AMBIANCE.faceShade.verticales];
    expect(+(Math.max(...v) / Math.min(...v)).toFixed(4)).toBe(1.6379);
    expect(Math.max(...v) / Math.min(...v)).toBeLessThanOrEqual(2);
    // Le plancher de la scène (`tenebres`) porté par la famille la plus sombre reste au-dessus du noir,
    // souvenir de case compris (`fogTint.explored`) — la borne du schéma est là pour ça.
    const ténèbres = 0.18 * Math.min(...v);
    expect(+ténèbres.toFixed(4)).toBe(0.1044);
    expect(+(ténèbres * AMBIANCE.fogTint.explored).toFixed(4)).toBe(0.0438);
  });

  it('un PLAFOND n’est pas un SOL : les deux horizontales sont séparées', () => {
    expect(shadeFactorOf('bas')).toBeLessThan(shadeFactorOf('haut'));
    expect(shadeFamily(N.bas)).not.toBe(shadeFamily(N.haut));
    // Une pente à 45° se marche : elle compte pour horizontale, jamais pour un mur.
    expect(shadeFamily({ x: 0.7071, y: 0.7071, z: 0 })).toBe('haut');
    // Une normale indéterminée (triangle dégénéré) ne modèle rien plutôt que d'assombrir au hasard.
    expect(shadeFactorOf(shadeFamily(null))).toBe(1);
  });
});

describe('#1300 — la famille se lit sur la normale que la loi d’orientation PRÉSENTE', () => {
  it('les SOLS des scènes réelles sortent en famille « haut », jamais en soffite', () => {
    // Mesuré au banc : 100 % des triangles de sol sortent du pivot avec une normale géométrique vers le
    // BAS (arène 5 112, opéra 1 178, siège 3 328) — le pivot n'a aucune convention de sens de parcours
    // (`worldTris.faceQuadsOriented`), et c'est `bakeWorldGeometry` qui les retourne vers le haut. Lire
    // la famille AVANT ce retournement peindrait tous les sols de toutes les scènes en famille de
    // soffite : c'est cette inversion-là que ce test tient.
    for (const [nom, scene] of [['arène', areneConstruit.scene], ['opéra', operaConstruit.scene]] as const) {
      const baked = cuire(scene, sceneMetresPerTile(scene));
      // `shades` est un `Float32Array` : la valeur AUTHORÉE (double) ne s'y retrouve qu'arrondie — une
      // clé non `fround`ée ne joint AUCUN sommet et ferait passer n'importe quel compte pour zéro.
      const facteur = (v: number) => Math.fround(v);
      const compte = new Map<number, number>();
      for (const s of baked.shades) compte.set(s, (compte.get(s) ?? 0) + 1);
      const part = (compte.get(facteur(AMBIANCE.faceShade.haut)) ?? 0) / baked.shades.length;
      // Les SOLS, eux, ne sortent JAMAIS en soffite : c'est l'inversion décrite plus haut. Le compte se
      // restreint donc à leurs sommets (`spans` porte l'élément de provenance) — la famille `bas`, elle,
      // a désormais un producteur ailleurs : le DESSOUS d'un décor volumique, qui porte son propre dehors.
      let solsEnSoffite = 0;
      for (const span of baked.spans) {
        if (span.el.kind !== 'floor') continue;
        for (let v = span.start; v < span.start + span.count; v++)
          if (baked.shades[v] === facteur(AMBIANCE.faceShade.bas)) solsEnSoffite++;
      }
      const soffites = compte.get(facteur(AMBIANCE.faceShade.bas)) ?? 0;
      expect([nom, part > 0.3, solsEnSoffite, soffites > 0]).toEqual([nom, true, 0, true]);
    }
  });

  it('aucune face verticale ne change de FAMILLE en son milieu', () => {
    // La loi d'orientation décide le sens d'une verticale non orientée par la POSITION (centroïde du
    // triangle vs centre de la carte). Un plan qui enjamberait ce centre verrait donc ses triangles
    // partir dans deux familles opposées — une couture au milieu d'un mur. Mesuré : 0 plan panaché sur
    // 589 (arène), 163 (opéra) et 78 (siège) faces verticales non orientées. Reste le FAIT, hors de
    // portée d'un facteur d'orientation : deux montants SYMÉTRIQUES par rapport au centre reçoivent
    // des familles opposées — ils regardent bien deux directions opposées du point de vue de la carte.
    for (const [nom, scene] of [['arène', areneConstruit.scene], ['opéra', operaConstruit.scene]] as const) {
      const baked = cuire(scene, sceneMetresPerTile(scene));
      const pos = baked.geometry.getAttribute('position').array as Float32Array;
      let panachés = 0;
      for (const span of baked.spans) {
        // Une face porte plusieurs familles quand elle est une BOÎTE ou une CROIX de montant — ses quads
        // regardent des directions différentes, c'est le but. Ce qui ne doit pas arriver, c'est qu'un
        // même PLAN se scinde : on groupe donc les triangles par NORMALE géométrique (jamais par index —
        // un polygone se triangule en éventail, le nombre de triangles par quad n'est pas constant).
        const parPlan = new Map<string, Set<number>>();
        for (let v = span.start; v + 2 < span.start + span.count; v += 3) {
          const p = (k: number, c: number) => pos[(v + k) * 3 + c];
          const ux = p(1, 0) - p(0, 0), uy = p(1, 1) - p(0, 1), uz = p(1, 2) - p(0, 2);
          const wx = p(2, 0) - p(0, 0), wy = p(2, 1) - p(0, 1), wz = p(2, 2) - p(0, 2);
          const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          const l = Math.hypot(nx, ny, nz);
          if (l < 1e-9) continue;
          const clé = `${(nx / l).toFixed(3)},${(ny / l).toFixed(3)},${(nz / l).toFixed(3)}`;
          if (!parPlan.has(clé)) parPlan.set(clé, new Set());
          parPlan.get(clé)!.add(baked.shades[v]);
        }
        for (const familles of parPlan.values()) if (familles.size > 1) panachés++;
      }
      expect([nom, panachés]).toEqual([nom, 0]);
    }
  });

  it('la scène VIDE — que des dalles de sol — est modelée en HORIZONTALE d’un bout à l’autre', () => {
    const scene = { ...emptyScene(4, 4), ambiance: 'interieur' } as Scene;
    const baked = cuire(scene, sceneMetresPerTile(scene));
    expect(baked.shades.length).toBeGreaterThan(0);
    expect([...new Set(baked.shades)]).toEqual([AMBIANCE.faceShade.haut]);
  });
});

describe('#1300 — le CÂBLAGE : le facteur arrive dans la couleur de sommet', () => {
  const scene = areneConstruit.scene;
  const mpt = sceneMetresPerTile(scene);
  const plein = () => 1;
  const couleurs = (g: { getAttribute(n: string): { array: ArrayLike<number> } }) =>
    (g.getAttribute('color').array as Float32Array).slice();

  it('à porte OUVERTE (intérieur, fade 0) chaque sommet porte EXACTEMENT le facteur de sa famille', () => {
    const baked = cuire(scene, mpt);
    const nu = couleurs(applyVisibilityTint(baked, plein, 1).geometry);
    const modelé = couleurs(applyVisibilityTint(baked, plein, 0).geometry);
    const rapports = new Set<number>();
    let sommetsModelés = 0;
    for (let v = 0; v < baked.shades.length; v++) {
      const r = nu[v * 3] > 0 ? modelé[v * 3] / nu[v * 3] : baked.shades[v];
      expect(r).toBeCloseTo(baked.shades[v], 5);
      rapports.add(+r.toFixed(4));
      if (baked.shades[v] < 1) sommetsModelés++;
    }
    // Les SIX facteurs atteints sur cette carte : l'horizontale haute, les quatre verticales, et le
    // soffite — le dessous des décors volumiques, qui présente sa normale vers le bas.
    expect([...rapports].sort((a, b) => b - a)).toEqual([1, 0.95, 0.86, 0.7, 0.58, 0.55]);
    expect(sommetsModelés / baked.shades.length).toBeGreaterThan(0.3);
  });

  it('sous le PLEIN SOLEIL le modelé s’efface : les couleurs sont celles d’avant le lot', () => {
    const baked = cuire(scene, mpt);
    const avecPorteFermée = couleurs(applyVisibilityTint(baked, plein, 1).geometry);
    const parDéfaut = couleurs(applyVisibilityTint(baked, plein).geometry);
    expect(parDéfaut).toEqual(avecPorteFermée);
    for (let v = 0; v < baked.shades.length; v += 997) expect(shadeSousSoleil(baked.shades[v], 1)).toBe(1);
  });
});

describe('#1300 — la PORTE du soleil est CONTINUE (aucune marche au lever)', () => {
  const dehors = (): Scene => ({ ...emptyScene(6, 6), ambiance: 'exterieur' });

  it('sur 24 h SANS exclusion, le RAPPORT mur/sol ne saute jamais', () => {
    // La grandeur mesurée est le RAPPORT de ce que rend un mur à ce que rend le sol à côté : le facteur
    // de la famille la plus sombre passé par la porte. Le palier d'ambiance, la météo et l'exposition de
    // la frame s'y SIMPLIFIENT — ils multiplient les deux surfaces à l'identique. Ce qui reste est
    // imputable à CE lot seul : plus besoin d'exclure 05:00 ni 22:00 (les bornes de la nuit d'horloge,
    // où le palier saute pour les deux voies ensemble), la mesure court sur les 1 440 minutes.
    const sombre = Math.min(...AMBIANCE.faceShade.verticales);
    const scalaires = (t: number) => stageLightScalars({ scene: dehors(), gameTime: t, lightLevel: null });
    const rapport = (t: number) => shadeSousSoleil(sombre, scalaires(t).fade);
    const suite = Array.from({ length: 1440 }, (_, t) => rapport(t));
    const saut = Math.max(...suite.slice(1).map((v, i) => Math.abs(v - suite[i])));
    // Le seuil est celui du RAPPORT, pas celui de l'albédo : l'amplitude entière du modelé vaut
    // `1 − sombre`, et le pas le plus raide du fondu en consomme moins de 4 % par minute. Mesuré :
    // 0,0144 au plus, soit 3,4 % de l'amplitude — 29 fois moins qu'une porte binaire, qui poserait
    // l'amplitude ENTIÈRE en une minute (c'est cette mutation-là que ce chiffre attrape).
    const amplitude = 1 - sombre;
    expect(+saut.toFixed(4)).toBe(0.0144);
    expect(saut / amplitude).toBeLessThan(0.04);
    // Et la porte va bien d'un bout à l'autre de la journée : mur PLEINEMENT modelé tant que le soleil
    // rase, modelé EFFACÉ une fois le soleil haut.
    expect(Math.min(...suite)).toBe(sombre);
    expect(Math.max(...suite)).toBe(1);
    expect(rapport(3 * 60)).toBe(sombre);
    expect(rapport(12 * 60)).toBe(1);
  });

  it('un INTÉRIEUR n’a jamais de soleil : son modelé est PLEIN à toute heure', () => {
    const dedans = (): Scene => ({ ...emptyScene(6, 6), ambiance: 'interieur' });
    for (const t of [0, 6 * 60, 12 * 60, 18 * 60, 23 * 60]) {
      const s = stageLightScalars({ scene: dedans(), gameTime: t, lightLevel: null });
      expect([t, s.fade, shadeSousSoleil(0.58, s.fade)]).toEqual([t, 0, 0.58]);
    }
  });
});

describe('#1300 — l’AUTRE canal de modelé : les flaques d’un intérieur par défaut sont éteintes', () => {
  const sources = [
    { srcId: 'a', pos: { x: 4, y: 4 }, radiusM: 6, carried: false },
    { srcId: 'b', pos: { x: 9, y: 6 }, radiusM: 4, carried: false },
  ];

  it('sans palier authoré, un intérieur rend une extinction NULLE et n’allume aucune lampe', () => {
    const scene = operaConstruit.scene;
    const s = stageLightScalars({ scene, gameTime: 12 * 60, lightLevel: null });
    expect(s.ambianceLum).toBe(1);
    expect(extinctionDe(s.ambianceLum)).toBe(0);
    const écrites = pointLightWrites(sources as never, { scene, mpt: sceneMetresPerTile(scene), ambianceLum: s.ambianceLum });
    const vivantes = écrites.filter((w) => w !== null);
    expect(vivantes.length).toBe(2);
    expect(vivantes.map((w) => w!.intensity)).toEqual([0, 0]);
  });

  it('avec un palier authoré SOUS le plein jour, les mêmes flaques vivent', () => {
    // Ce que le lot NE fait pas : le modelé par les sources posées se joue à l'authoring du palier
    // d'ambiance de la scène (`Scene.ambientLight`, un ID de palier — `lightLevels.json` — jamais un
    // scalaire). C'est la mesure qui fonde le ticket d'authoring séparé.
    const scene = { ...operaConstruit.scene, ambientLight: 'crepuscule' } as Scene;
    const s = stageLightScalars({ scene, gameTime: 12 * 60, lightLevel: null });
    expect(+s.ambianceLum.toFixed(3)).toBe(0.549);
    expect(+extinctionDe(s.ambianceLum).toFixed(3)).toBe(0.451);
    const écrites = pointLightWrites(sources as never, { scene, mpt: sceneMetresPerTile(scene), ambianceLum: s.ambianceLum });
    expect(écrites.filter((w) => w !== null).map((w) => +w!.intensity.toFixed(3))).toEqual([1.101, 1.101]);
  });
});
