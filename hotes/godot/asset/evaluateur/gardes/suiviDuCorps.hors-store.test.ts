// La garde du suivi du corps (#3205) : un élément skinné ne suit le corps que par ses clés `gabarit_*`.
import { describe, expect, it } from 'vitest';
import { Vector3, type Mesh } from 'three';
import { ecrireGlb } from '../../glb.ts';
import { FACTEURS_NEUTRES, nomDeCleDuGabarit, poidsDuGabarit } from '../../gabarit.ts';
import type { TableDeGabarit } from '../../manifesteDeBase.ts';
import { meshesDuCorps } from '../corps.ts';
import { chargerScene } from '../chargement.ts';
import { poseDeRepos } from '../echantillonnage.ts';
import { evaluer, monter } from '../evaluer.ts';
import { appliquerGabarit, poserFormes } from '../gabarit.ts';
import { ECART_DE_SUIVI_M, gardeSuiviDuCorps, lierAuCorps, pointSurLeCorps } from './suiviDuCorps.ts';

type Point = readonly [number, number, number];
type Forme = (p: Point) => Point;

interface Piece {
  readonly nom: string;
  readonly sommets: readonly Point[];
  readonly triangles: readonly number[];
  readonly formes?: Readonly<Record<string, Forme>>;
  /** Sans lui, la pièce a un skin ; avec lui, un nœud rigide. */
  readonly rigide?: true;
  readonly zone?: string;
}

/** Le squelette commun, translations locales : `pied` sous `jambe`, de sorte qu'un facteur `legs` le déplace. */
const OS = [
  { name: 'racine', translation: [0, 0, 0], children: [1] },
  { name: 'jambe', translation: [0, 1, 0], children: [2] },
  { name: 'pied', translation: [0, -0.5, 0] },
] as const;
const HAUTEUR_DES_OS = [0, 1, 0.5];
const osDuSommet = ([, y]: Point): number => (y < 0.5 ? 2 : 1);

function glb(pieces: readonly Piece[]): Uint8Array {
  const morceaux: Uint8Array[] = [];
  const vues: object[] = [];
  const accesseurs: object[] = [];
  let decalage = 0;
  const accesseur = (donnees: Float32Array | Uint16Array, type: string, count: number, bornes: object = {}): number => {
    const octets = new Uint8Array(donnees.buffer);
    vues.push({ buffer: 0, byteOffset: decalage, byteLength: octets.byteLength });
    const bourrage = (4 - (octets.byteLength % 4)) % 4;
    morceaux.push(octets, new Uint8Array(bourrage));
    decalage += octets.byteLength + bourrage;
    accesseurs.push({ bufferView: vues.length - 1, componentType: donnees instanceof Float32Array ? 5126 : 5123, count, type, ...bornes });
    return accesseurs.length - 1;
  };
  const vec3 = (points: readonly Point[]): number => {
    const borne = (f: (...v: number[]) => number) => [0, 1, 2].map((c) => f(...points.map((p) => p[c])));
    return accesseur(Float32Array.from(points.flat()), 'VEC3', points.length, { min: borne(Math.min), max: borne(Math.max) });
  };
  const meshes = pieces.map((p) => ({
    primitives: [{
      attributes: {
        POSITION: vec3(p.sommets),
        ...(p.rigide ? {} : {
          JOINTS_0: accesseur(Uint16Array.from(p.sommets.flatMap((s) => [osDuSommet(s), 0, 0, 0])), 'VEC4', p.sommets.length),
          WEIGHTS_0: accesseur(Float32Array.from(p.sommets.flatMap(() => [1, 0, 0, 0])), 'VEC4', p.sommets.length),
        }),
      },
      indices: accesseur(Uint16Array.from(p.triangles), 'SCALAR', p.triangles.length),
      material: 0,
      ...(p.formes && Object.keys(p.formes).length ? { targets: Object.values(p.formes).map((f) => ({ POSITION: vec3(p.sommets.map(f)) })) } : {}),
    }],
    ...(p.formes && Object.keys(p.formes).length ? { extras: { targetNames: Object.keys(p.formes) } } : {}),
  }));
  const inverses = accesseur(Float32Array.from(HAUTEUR_DES_OS.flatMap((h) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -h, 0, 1])), 'MAT4', OS.length);
  const n = pieces.length;
  const bin = new Uint8Array(decalage);
  morceaux.reduce((o, m) => (bin.set(m, o), o + m.byteLength), 0);
  return ecrireGlb({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [...pieces.keys(), n] }],
    nodes: [
      ...pieces.map((p, i) => ({ name: p.nom, mesh: i, ...(p.rigide ? {} : { skin: 0 }), ...(p.zone ? { extras: { zone: p.zone } } : {}) })),
      ...OS.map((o) => ({ ...o, ...('children' in o ? { children: o.children.map((c) => c + n) } : {}) })),
    ],
    meshes,
    materials: [{ name: 'peau' }],
    skins: [{ joints: OS.map((_, i) => i + n), inverseBindMatrices: inverses }],
    accessors: accesseurs,
    bufferViews: vues,
    buffers: [{ byteLength: decalage }],
  }, bin);
}

const LEGS_MOINS = nomDeCleDuGabarit('legs', 'moins');
const LEGS_PLUS = nomDeCleDuGabarit('legs', 'plus');
const ARMS_PLUS = nomDeCleDuGabarit('arms', 'plus');
const CROISEE = nomDeCleDuGabarit('legs', 'moins', 'feminin');

/** Les déplacements, non uniformes : un élément juste n'est juste qu'à l'interpolation au point lié. */
const legsMoins: Forme = ([x, y]) => [0.02 * y, -0.1 - 0.2 * x, 0.01];
const legsPlus: Forme = ([x, y]) => [0, 0.05 + 0.1 * y + 0.03 * x, 0];
const armsPlus: Forme = () => [0.3, 0, 0];
const oppose = (f: Forme): Forme => (p) => { const [x, y, z] = f(p); return [-x, -y, -z]; };
const nul: Forme = () => [0, 0, 0];
const vers = (k: number): Forme => () => [0, k, 0];
const fois = (k: number, f: Forme): Forme => (p) => { const [x, y, z] = f(p); return [k * x, k * y, k * z]; };
const ecarteDe = (e: number, f: Forme): Forme => (p) => { const [x, y, z] = f(p); return [x, y, z + e]; };

const carre = (x: number): Point[] => [[x, 0, 0], [x + 1, 0, 0], [x + 1, 1, 0], [x, 1, 0]];
const QUAD = [0, 1, 2, 0, 2, 3];

/** Le corps : deux membres disjoints, chacun son mesh de zone, chacun ses clés. */
const corps = (cleDeG: Readonly<Record<string, Forme>> = {}): Piece[] => [
  { nom: 'G', zone: 'pied_g', sommets: carre(0), triangles: QUAD, formes: { [LEGS_MOINS]: legsMoins, [LEGS_PLUS]: legsPlus, ...cleDeG } },
  { nom: 'D', zone: 'pied_d', sommets: carre(2), triangles: QUAD, formes: { [ARMS_PLUS]: armsPlus } },
];
/** Trois sommets au-dessus de G, aucun sur l'un de ses sommets, de part et d'autre de sa diagonale. */
const BOTTE: Point[] = [[0.2, 0.3, 0.02], [0.7, 0.2, 0.02], [0.4, 0.8, 0.02]];
const botte = (formes: Readonly<Record<string, Forme>> = {}, nom = 'Botte'): Piece => ({ nom, sommets: BOTTE, triangles: [0, 1, 2], formes });
const JUSTE = { [LEGS_MOINS]: legsMoins, [LEGS_PLUS]: legsPlus };
/** La même botte à la distance `jeu` de la surface de G, chaque sommet lié à l'aplomb. */
const botteAuJeu = (jeu: number, formes: Readonly<Record<string, Forme>> = {}): Piece => ({ ...botte(formes), sommets: BOTTE.map(([x, y]) => [x, y, jeu]) });
/** Le plus grand déplacement du corps sous la botte, sous `legsMoins` : la forme est affine, l'interpolation est exacte. */
const CHEMIN_DU_CORPS = Math.max(...BOTTE.map((p) => Math.hypot(...legsMoins(p))));
const GRAND_JEU = 0.5;

const suivis = async (base: readonly Piece[], element: Piece) => {
  const f = await evaluer({ base: glb(base), elements: [glb([element])] });
  return f.ecarts.filter((e) => e.garde === 'suiviDuCorps');
};
const cleNommee = (detail: string): string | undefined => /gabarit_\S+/.exec(detail)?.[0];

describe('gardeSuiviDuCorps, par evaluer à facteurs neutres', () => {
  it('refuse un élément skinné sans clés, une fiche par clé propre à sa zone', async () => {
    const e = await suivis(corps(), botte());
    expect(e.map((x) => [x.code, x.mesh, cleNommee(x.detail)])).toEqual([
      ['cle-inerte', 'Botte', LEGS_MOINS],
      ['cle-inerte', 'Botte', LEGS_PLUS],
    ]);
    expect(e[0].valeur).toBe(0);
    expect(e[0].seuil as number).toBeCloseTo(CHEMIN_DU_CORPS / 2, 5);
    expect(e[0].detail).toContain('absente de l’élément');
  });

  it('refuse un élément privé d’une seule clé propre, et ne nomme que celle-là', async () => {
    const e = await suivis(corps(), botte({ [LEGS_MOINS]: legsMoins }));
    expect(e.map((x) => [x.code, cleNommee(x.detail)])).toEqual([['cle-inerte', LEGS_PLUS]]);
    expect(e[0].detail).toContain('absente');
  });

  it('refuse une clé présente à delta nul', async () => {
    const e = await suivis(corps(), botte({ ...JUSTE, [LEGS_MOINS]: nul }));
    expect(e.map((x) => [x.code, cleNommee(x.detail)])).toEqual([['cle-inerte', LEGS_MOINS]]);
    expect(e[0].detail).toContain('portée par');
  });

  it.each([
    ['absente', { [LEGS_PLUS]: legsPlus }],
    ['à delta nul', { ...JUSTE, [LEGS_MOINS]: nul }],
    ['à moins de la moitié du chemin', { ...JUSTE, [LEGS_MOINS]: fois(0.4, legsMoins) }],
  ])('refuse par cle-inerte une clé %s, au contact comme à grand jeu', async (_cas, formes) => {
    for (const jeu of [0, GRAND_JEU]) {
      const e = await suivis(corps(), botteAuJeu(jeu, formes));
      expect(e.map((x) => [x.code, cleNommee(x.detail)])).toEqual([['cle-inerte', LEGS_MOINS]]);
    }
  });

  it('accepte à grand jeu une pièce qui fait plus de la moitié du chemin', async () => {
    expect(await suivis(corps(), botteAuJeu(GRAND_JEU, { ...JUSTE, [LEGS_MOINS]: fois(0.6, legsMoins) }))).toEqual([]);
  });

  it('refuse par cle-non-suivie un delta opposé au contact, à deux fois le chemin du corps', async () => {
    const e = await suivis(corps(), botteAuJeu(0, { ...JUSTE, [LEGS_MOINS]: oppose(legsMoins) }));
    expect(e.map((x) => [x.code, cleNommee(x.detail)])).toEqual([['cle-non-suivie', LEGS_MOINS]]);
    expect(e[0].valeur as number).toBeCloseTo(2 * CHEMIN_DU_CORPS, 5);
    expect(e[0].seuil).toBe(ECART_DE_SUIVI_M);
    expect(e[0].detail).toMatch(/sommet \d, de jeu 0\.0000 m/);
  });

  it.each([
    ['entre 5 mm et le jeu : acceptée', 0.05, 0.02, []],
    ['au-delà du jeu : refusée', 0.05, 0.06, [['cle-non-suivie', LEGS_MOINS]]],
    ['au contact, 4 mm : acceptée', 0, 0.004, []],
    ['au contact, 6 mm : refusée', 0, 0.006, [['cle-non-suivie', LEGS_MOINS]]],
  ])('un écart de pièce %s', async (_cas, jeu, ecart, attendu) => {
    const e = await suivis(corps(), botteAuJeu(jeu, { ...JUSTE, [LEGS_MOINS]: ecarteDe(ecart, legsMoins) }));
    expect(e.map((x) => [x.code, cleNommee(x.detail)])).toEqual(attendu);
    for (const x of e) {
      expect(x.valeur as number).toBeCloseTo(ecart, 5);
      expect(x.seuil as number).toBeCloseTo(Math.max(ECART_DE_SUIVI_M, jeu), 5);
      expect(x.detail).toContain(`de jeu ${jeu.toFixed(4)} m`);
    }
  });

  it('accepte l’élément juste, dont les deltas sont ceux du point lié, sans en être un sommet', async () => {
    expect(await suivis(corps(), botte(JUSTE))).toEqual([]);
  });

  it('accepte la clé absente sous un corps que cette clé ne déplace pas : celle de l’autre membre', async () => {
    const f = await evaluer({ base: glb(corps()), elements: [glb([botte(JUSTE)])] });
    expect(f.ecarts.filter((e) => e.garde === 'suiviDuCorps' && cleNommee(e.detail) === ARMS_PLUS)).toEqual([]);
    expect(await suivis(corps(), { ...botte({ [ARMS_PLUS]: armsPlus }), sommets: carre(2).map(([x, y]) => [x * 0.5 + 1.2, y * 0.5 + 0.2, 0.02]), triangles: [0, 1, 2] })).toEqual([]);
  });

  it('ne concerne pas un rigide, même au-dessus d’un membre qui bouge', async () => {
    expect(await suivis(corps(), { ...botte(), rigide: true })).toEqual([]);
  });

  it('mesure un élément de même nom qu’un mesh du corps sans les confondre', async () => {
    const e = await suivis(corps(), botte({ [LEGS_MOINS]: legsMoins }, 'G'));
    expect(e.map((x) => [x.mesh, cleNommee(x.detail)])).toEqual([['G', LEGS_PLUS]]);
  });

  it('exclut un triangle dégénéré, même sur un sommet de l’élément', async () => {
    const [g, d] = corps();
    const degenere = { ...g, sommets: [...g.sommets, BOTTE[0], BOTTE[0], BOTTE[0]], triangles: [...g.triangles, 4, 5, 6] };
    const e = await evaluer({ base: glb([{ ...degenere, formes: { [LEGS_MOINS]: ([x, y, z]) => (z ? [9, 9, 9] : legsMoins([x, y, z])), [LEGS_PLUS]: legsPlus } }, d]), elements: [glb([botte(JUSTE)])] });
    expect(e.ecarts.filter((x) => x.garde === 'suiviDuCorps')).toEqual([]);
  });

  it('rend une erreur sur un corps sans triangle non dégénéré', async () => {
    const plat: Piece = { nom: 'G', zone: 'pied_g', sommets: [[0, 0, 0], [1, 0, 0], [2, 0, 0]], triangles: [0, 1, 2], formes: { [LEGS_MOINS]: legsMoins } };
    await expect(evaluer({ base: glb([plat]), elements: [glb([botte()])] })).rejects.toThrow('suiviDuCorps : aucun triangle non dégénéré dans le corps');
  });
});

describe('gardeSuiviDuCorps : clés croisées', () => {
  it.each([
    ['sous le seuil, absente : acceptée', ECART_DE_SUIVI_M / 2, []],
    ['au-dessus, absente : refusée', ECART_DE_SUIVI_M * 2, [['cle-inerte', CROISEE]]],
  ])('delta %s', async (_cas, k, attendu) => {
    const e = await suivis(corps({ [CROISEE]: vers(k) }), botte(JUSTE));
    expect(e.map((x) => [x.code, cleNommee(x.detail)])).toEqual(attendu);
  });
});

async function monte(base: readonly Piece[], element: Piece) {
  const b = await chargerScene(glb(base));
  const e = await chargerScene(glb([element]));
  monter(b, e);
  return { b, e };
}

describe('gardeSuiviDuCorps : état de la scène', () => {
  it('restaure à la sortie l’état des formes trouvé à l’entrée', async () => {
    const { b, e } = await monte(corps({ feminin: vers(0.2) }), botte({ ...JUSTE, feminin: vers(0.2) }));
    const avec = [...b.meshes, ...e.meshes] as Mesh[];
    avec.forEach((m, i) => { m.morphTargetInfluences?.forEach((_, k, t) => { t[k] = 0.1 * (i + k + 1); }); });
    const avant = avec.map((m) => [...(m.morphTargetInfluences ?? [])]);
    expect(avant.flat().some((p) => p > 0)).toBe(true);
    gardeSuiviDuCorps(b.scene, meshesDuCorps(b), e.skinnes);
    expect(avec.map((m) => [...(m.morphTargetInfluences ?? [])])).toEqual(avant);
  });
});

const TABLE: TableDeGabarit = { legs: ['jambe'], arms: [], head: [], racine: 'racine', st: { min: 0.8, max: 1.2 }, bornes: { legs: { min: 0.7, max: 1.3 }, arms: { min: 1, max: 1.5 }, head: { min: 1, max: 2 } } };

describe('gardeSuiviDuCorps : le chemin réel de la peau', () => {
  /** Le plus grand |(v′ − b′) − (v − b)| de l'élément sur `monter`, `poserFormes`, `appliquerGabarit` sans replacer. */
  async function ecartReel(element: Piece, legs: number): Promise<number> {
    const { b, e } = await monte(corps(), element);
    const os = meshesDuCorps(b);
    const [peau] = e.skinnes;
    const repos = poseDeRepos(b.scene, os);
    const v = poseDeRepos(b.scene, [peau]).positions.get(peau.name) as Float32Array;
    const lies = lierAuCorps(v, os, repos);
    const facteurs = { ...FACTEURS_NEUTRES, legs };
    poserFormes(b.scene, poidsDuGabarit(facteurs, TABLE.bornes, {}));
    appliquerGabarit(b.scene, facteurs, { gabarit: TABLE }, b.squelette ?? undefined, false);
    const apres = poseDeRepos(b.scene, os);
    const vApres = poseDeRepos(b.scene, [peau]).positions.get(peau.name) as Float32Array;
    return Math.max(...lies.map((lie, i) => {
      const avant = new Vector3(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]).sub(pointSurLeCorps(lie, repos.positions));
      return new Vector3(vApres[i * 3], vApres[i * 3 + 1], vApres[i * 3 + 2]).sub(pointSurLeCorps(lie, apres.positions)).distanceTo(avant);
    }));
  }

  it('vaut, à poids 1, l’écart de la garde pour la clé de delta opposé', async () => {
    const faux = botte({ [LEGS_PLUS]: legsPlus, [LEGS_MOINS]: oppose(legsMoins) });
    const [garde] = await suivis(corps(), faux);
    expect(garde.code).toBe('cle-non-suivie');
    expect(await ecartReel(faux, TABLE.bornes.legs.min)).toBeCloseTo(garde.valeur as number, 5);
  });

  it('vaut, à poids 1, le chemin du corps sous la garde pour la clé absente', async () => {
    const prive = botte({ [LEGS_PLUS]: legsPlus });
    const [garde] = await suivis(corps(), prive);
    expect(garde.code).toBe('cle-inerte');
    expect(await ecartReel(prive, TABLE.bornes.legs.min)).toBeCloseTo(2 * (garde.seuil as number), 5);
  });

  it('reste sous le seuil pour l’élément juste', async () => {
    expect(await ecartReel(botte(JUSTE), TABLE.bornes.legs.min)).toBeLessThanOrEqual(ECART_DE_SUIVI_M);
    expect(await ecartReel(botte(JUSTE), TABLE.bornes.legs.max)).toBeLessThanOrEqual(ECART_DE_SUIVI_M);
  });
});
