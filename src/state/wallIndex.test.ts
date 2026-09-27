/**
 * L'INDEX D'ARÊTES — contrat, identité, et le TRAVAIL ÉVITÉ qui justifie son existence.
 *
 * Le compte joue sur La Diligence (la carte la plus murée des campagnes livrées) : c'est là que le
 * profil CPU d'un tour d'IA montrait 61 % du temps propre dans le balayage `scene.walls` d'une
 * arête. Le contrat est DÉRIVÉ (chaque arête portant un mur est confrontée au balayage naïf, jamais
 * une poignée de cas cueillis) et il porte sur TOUTES les scènes livrées — scénarios du registre
 * généré et scènes des campagnes intégrées —, parce qu'aucune garde d'unicité d'arête n'existe :
 * le schéma (`defs-scenes/scene.ts`, `walls` = tableau) l'autorise, et l'authoring littéral,
 * `asciiMap` et les migrations ne passent pas par le dédoublonnage de `setEdgeWall`. Deux faits
 * MESURÉS y répondent : aucune arête ne porte plus d'un segment, et `aretesA` rend exactement le
 * balayage naïf — c'est ce qui rend `aretesA(...)[0]` (PREMIER) équivalent au DERNIER segment que
 * l'ancien `byEdge` de `roofs.closureAppearance` retenait.
 *
 * Ce que l'index promet n'est pas une DURÉE — une durée mesure l'ordonnanceur de la machine qui
 * joue le test — mais un TRAVAIL : après construction, plus une seule lecture de `scene.walls`. Le
 * contrat se compte donc sur l'artefact, par un `Proxy` qui relève les accès au tableau : ZERO côté
 * index, une touche par question et par mur côté balayage. Débrancher l'index de `scene.ts` fait
 * passer le premier compteur à l'ordre du second, donc rougir.
 */
import { describe, it, expect } from 'vitest';
import { aretesA, wallIndexOf } from './wallIndex';
import {
  areteOcculteEntre, areteOcculte, edgeOf, structureAt, doorAt, climbAt,
  type Scene, type WallSeg, type WallSide,
} from './scene';
import { allBuiltinCampaigns, diligenceCampaign } from '../scenes/campaign';
import { testScenarios } from '../scenes/test-scenarios';

const carte: Scene = diligenceCampaign.scenes[0];
const murs = (): readonly WallSeg[] => carte.walls ?? [];

/** Le balayage NAÏF que l'index remplace — l'étalon du contrat, écrit ici une fois. */
const naif = (scene: Scene, x: number, y: number, side: WallSide, z: number): WallSeg[] =>
  (scene.walls ?? []).filter((w) => w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);

/** TOUTES les scènes LIVRÉES : un scénario du registre généré porte sa scène, une campagne les siennes. */
const scenesLivrees = (): { nom: string; scene: Scene }[] => {
  const out: { nom: string; scene: Scene }[] = [];
  for (const s of testScenarios) out.push({ nom: `scenario:${s.id}`, scene: s.scene });
  for (const c of allBuiltinCampaigns) for (const sc of c.scenes ?? []) out.push({ nom: `campagne:${c.id}/${sc.id}`, scene: sc });
  return out;
};
/** Plancher DÉRIVÉ du nombre de scènes attendues — un scan vide (registre non chargé, campagne sans
 *  scène) ne peut pas rester vert. */
const plancherScenes = (): number =>
  testScenarios.length + allBuiltinCampaigns.reduce((n, c) => n + (c.scenes?.length ?? 0), 0);

describe('wallIndex — contrat', () => {
  it('La Diligence porte bien des murs (sans quoi le banc ne mesure rien)', () => {
    expect(murs().length).toBeGreaterThan(100);
  });

  it('`aretesA` rend EXACTEMENT le balayage naïf, sur TOUTES les arêtes portées', () => {
    let verifiees = 0;
    for (const w of murs()) {
      const z = w.z ?? 0;
      expect(aretesA(carte, w.x, w.y, w.side, z), `arête ${w.x},${w.y},${w.side},${z}`)
        .toEqual(naif(carte, w.x, w.y, w.side, z));
      verifiees++;
    }
    expect(verifiees).toBe(murs().length);
  });

  it('une arête NUE rend une liste vide (et le naïf aussi)', () => {
    const portees = new Set(murs().map((w) => `${w.x},${w.y},${w.side},${w.z ?? 0}`));
    let nues = 0;
    for (let y = 0; y < carte.dimensions.h; y++)
      for (let x = 0; x < carte.dimensions.w; x++)
        for (const side of ['N', 'E'] as const) {
          if (portees.has(`${x},${y},${side},0`)) continue;
          expect(aretesA(carte, x, y, side, 0)).toEqual([]);
          nues++;
        }
    expect(nues).toBeGreaterThan(100);
  });

  it('les trois accesseurs de `scene.ts` rendent le même segment que le balayage naïf filtré', () => {
    for (const w of murs()) {
      const z = w.z ?? 0;
      const att = naif(carte, w.x, w.y, w.side, z);
      expect(structureAt(carte, w.x, w.y, w.side, z)).toBe(att.find((s) => !!s.structure));
      expect(doorAt(carte, w.x, w.y, w.side, z)).toBe(att.find((s) => !!s.door));
      expect(climbAt(carte, w.x, w.y, w.side, z)).toBe(att.find((s) => !!s.climb));
    }
  });
});

describe('wallIndex — TOUTES les scènes livrées', () => {
  it('aucune arête ne porte plus d’un segment (PREMIER = DERNIER, ce dont `roofs` dépend)', () => {
    const fautes: string[] = [];
    let scannees = 0, mursScannes = 0;
    for (const { nom, scene } of scenesLivrees()) {
      scannees++;
      const parArete = new Map<string, WallSeg[]>();
      for (const w of scene.walls ?? []) {
        mursScannes++;
        const k = `${w.x},${w.y},${w.side},${w.z ?? 0}`;
        const l = parArete.get(k);
        if (l) l.push(w); else parArete.set(k, [w]);
      }
      for (const [k, l] of parArete) if (l.length > 1) fautes.push(`${nom} arête ${k} × ${l.length}`);
    }
    expect(fautes).toEqual([]);
    expect(scannees).toBe(plancherScenes());
    expect(scannees).toBeGreaterThan(testScenarios.length); // les campagnes ont bien été balayées
    expect(mursScannes).toBeGreaterThan(murs().length); // au moins La Diligence, et d'autres cartes
  });

  it('`aretesA` ≡ balayage naïf sur CHAQUE arête portée de CHAQUE scène livrée', () => {
    const ecarts: string[] = [];
    let portees = 0, scannees = 0;
    for (const { nom, scene } of scenesLivrees()) {
      scannees++;
      for (const w of scene.walls ?? []) {
        const z = w.z ?? 0;
        portees++;
        const a = aretesA(scene, w.x, w.y, w.side, z);
        const n = naif(scene, w.x, w.y, w.side, z);
        if (JSON.stringify(a) !== JSON.stringify(n)) ecarts.push(`${nom} ${w.x},${w.y},${w.side},${z}`);
        if (structureAt(scene, w.x, w.y, w.side, z) !== n.find((s) => !!s.structure)) ecarts.push(`${nom} structureAt ${w.x},${w.y},${w.side},${z}`);
        if (doorAt(scene, w.x, w.y, w.side, z) !== n.find((s) => !!s.door)) ecarts.push(`${nom} doorAt ${w.x},${w.y},${w.side},${z}`);
        if (climbAt(scene, w.x, w.y, w.side, z) !== n.find((s) => !!s.climb)) ecarts.push(`${nom} climbAt ${w.x},${w.y},${w.side},${z}`);
      }
    }
    expect(ecarts).toEqual([]);
    expect(scannees).toBe(plancherScenes());
    expect(portees).toBeGreaterThan(murs().length);
  });
});

describe('wallIndex — identité', () => {
  it('deux appels sur la MÊME scène rendent le MÊME Map', () => {
    expect(wallIndexOf(carte)).toBe(wallIndexOf(carte));
  });

  it('un changement de `flags` (porte ouverte, structure abattue) CONSERVE l\'index', () => {
    const bougee: Scene = { ...carte, flags: { ...carte.flags, __door_1_1_N_0: true } };
    expect(wallIndexOf(bougee)).toBe(wallIndexOf(carte));
  });

  it('un tableau `walls` NEUF rend un Map NEUF', () => {
    const remuree: Scene = { ...carte, walls: [...murs()] };
    expect(wallIndexOf(remuree)).not.toBe(wallIndexOf(carte));
    expect(wallIndexOf(remuree).size).toBe(wallIndexOf(carte).size);
  });

  it('une scène SANS mur a un index vide et stable', () => {
    const nue: Scene = { ...carte, walls: undefined };
    expect(wallIndexOf(nue).size).toBe(0);
    expect(wallIndexOf(nue)).toBe(wallIndexOf({ ...carte, walls: undefined }));
  });
});

describe('wallIndex — le TRAVAIL évité, compté', () => {
  /** 10 000 questions d'arête DÉTERMINISTES, balayant la carte (chaque pas de rayon d'une Ligne de
   *  Vue en pose une). */
  const paires = (): [number, number, number, number][] => {
    const out: [number, number, number, number][] = [];
    for (let i = 0; out.length < 10000; i++) {
      const x = i % carte.dimensions.w, y = Math.floor(i / carte.dimensions.w) % carte.dimensions.h;
      out.push([x, y, x + 1, y]);
      if (out.length < 10000) out.push([x, y, x, y + 1]);
    }
    return out;
  };

  /** Le MÊME verdict que `areteOcculteEntre`, résolu par BALAYAGE de `scene.walls` — l'étalon du
   *  travail que l'index doit éviter. */
  const areteOcculteEntreNaif = (scene: Scene, ax: number, ay: number, bx: number, by: number, z: number): boolean => {
    if (!scene.walls?.length) return false;
    const e = edgeOf(ax, ay, bx, by);
    if (!e) return false;
    return scene.walls.some((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z && areteOcculte(scene, w));
  };

  /** Une scène dont `walls` COMPTE ses accès. `length` est exclu : c'est la garde de vacuité des deux
   *  chemins (`if (!scene.walls?.length)`), pas une lecture de segment. Le compteur est l'ARTEFACT du
   *  travail — déterministe, identique sur toute machine, là où une durée mesure l'ordonnanceur. */
  const sceneEspionne = (): { scene: Scene; touches: () => number; remettre: () => void } => {
    const vrais = murs();
    let n = 0;
    const espion = new Proxy(vrais as WallSeg[], {
      get(cible, prop, recepteur) {
        if (prop !== 'length') n++;
        return Reflect.get(cible, prop, recepteur);
      },
    });
    return { scene: { ...carte, walls: espion }, touches: () => n, remettre: () => { n = 0; } };
  };

  it('l’index lit `scene.walls` UNE fois, puis plus jamais : 10 000 questions, ZÉRO touche', () => {
    const q = paires();
    const { scene, touches, remettre } = sceneEspionne();

    // Construction : l'index parcourt le tableau une seule fois (le mémo de `wallIndexOf` est keyé
    // par l'identité de `scene.walls`, et ce proxy est neuf). En test, `memoByRef` gèle d'abord sa clé
    // (`sceneMemo.ts`) : la passe du gel lit chaque segment une fois, avant celle de l'index.
    areteOcculteEntre(scene, q[0][0], q[0][1], q[0][2], q[0][3], 0);
    const construction = touches();
    const passeDuGel = murs().length;
    expect(construction, 'la construction de l’index parcourt le tableau').toBeGreaterThan(0);
    expect(construction, 'la passe du gel, puis UNE passe de l’index, pas davantage')
      .toBeLessThan(passeDuGel + murs().length * 2);

    remettre();
    let parIndex = 0;
    for (const [ax, ay, bx, by] of q) if (areteOcculteEntre(scene, ax, ay, bx, by, 0)) parIndex++;
    expect(
      touches(),
      `${q.length} areteOcculteEntre sur ${murs().length} murs : l’index ne doit RETOUCHER aucun segment`,
    ).toBe(0);
    expect(parIndex, 'les questions portent bien sur des arêtes occultées').toBeGreaterThan(0);

    // Le MÊME verdict par balayage, et le travail qu'il coûte — mesuré, pas supposé : c'est ce que
    // l'index supprime. Débrancher l'index de `scene.ts` ramène le compteur ci-dessus à cet ordre.
    const balayage = sceneEspionne();
    let parNaif = 0;
    for (const [ax, ay, bx, by] of q) if (areteOcculteEntreNaif(balayage.scene, ax, ay, bx, by, 0)) parNaif++;
    expect(parNaif, 'même verdict des deux côtés — on compare bien le même travail').toBe(parIndex);
    expect(balayage.touches(), 'le balayage, lui, retouche le tableau à chaque question').toBeGreaterThan(q.length);
  });
});
