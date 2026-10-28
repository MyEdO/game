/**
 * L'ÉVALUATEUR D'UNE BASE ET DE SES ÉLÉMENTS (#2972) : charge les GLB (`chargerScene`), monte les éléments sur le
 * squelette de la base, valide le manifeste de base, pose gabarit et silhouettes, échantillonne les clips, puis appelle
 * chaque garde de `gardes/`. Le corps est l'ensemble des meshes de zone de la base (`extras.zone`) ; une base sans zone
 * est un corps d'un seul tenant : ses meshes skinnés.
 */
import { Skeleton, type Bone, type Object3D, type SkinnedMesh } from 'three';
import { lireGlb } from '../glb.ts';
import { chargerScene, type SceneChargee } from './chargement.ts';
import type { Ecart } from './ecart.ts';
import { echantillonner, PAS_PAR_DEFAUT, poseDeRepos } from './echantillonnage.ts';
import { appliquerGabarit, FACTEURS_NEUTRES, poserSilhouettes, type Facteurs } from './gabarit.ts';
import { validerManifesteDeBase, type ManifesteDeBase } from './manifesteDeBase.ts';
import { gardeBudget, PLAFOND_ASSEMBLE, trianglesDe } from './gardes/budget.ts';
import { gardeEchelleDuRigide, rigidesTenus } from './gardes/echelleDuRigide.ts';
import { gardeEnroulement } from './gardes/enroulement.ts';
import { aretesDe, gardeEtirement, mesurerEtirement, piresAretes, type MesureDEtirement, type RapportDArete } from './gardes/etirement.ts';
import { gardePiedsAuSol, plusBas, type NiveauDuCorps } from './gardes/piedsAuSol.ts';
import { gardePistesDEchelle } from './gardes/pistesDEchelle.ts';
import { gardePoids } from './gardes/poids.ts';

export interface EntreeDEvaluation {
  readonly base: Uint8Array;
  readonly elements?: readonly Uint8Array[];
  /** Le manifeste de base brut, validé ici (`validerManifesteDeBase`) ; sans lui, ni gabarit ni prise, et seule la
   *  racine a une position animée. */
  readonly manifeste?: unknown;
  /** Les facteurs de gabarit donnés, les autres à 1 (`FACTEURS_NEUTRES`). */
  readonly facteurs?: Partial<Facteurs>;
  readonly silhouettes?: Readonly<Record<string, number>>;
  /** Les clips échantillonnés, par nom ; tous sans liste. */
  readonly clips?: readonly string[];
  readonly pas?: number;
  readonly plafond?: number;
  /** Les clips au sol (`gardePiedsAuSol`). */
  readonly clipsAuSol?: readonly string[];
}

export interface MesuresDuClip {
  readonly nom: string;
  readonly duree: number;
  readonly echantillons: number;
  readonly plusBas: { readonly min: number; readonly max: number };
}

export interface FicheDeMesures {
  readonly ecarts: readonly Ecart[];
  readonly mesures: {
    readonly triangles: { readonly total: number; readonly parMesh: Readonly<Record<string, number>> };
    readonly sommets: number;
    readonly os: number;
    readonly images: number;
    readonly corps: readonly string[];
    readonly clips: readonly MesuresDuClip[];
    readonly etirement: Readonly<Record<string, readonly RapportDArete[]>>;
  };
}

const estNeutre = (f: Facteurs): boolean => Object.values(f).every((v) => v === 1);

/** Monte `element` sur la base : un mesh skinné se lie aux os de la base de même nom, un rigide sous un os passe sous
 *  l'os de la base de même nom, à la même position locale. */
function monter(base: SceneChargee, element: SceneChargee): void {
  const osDeLaBase = new Map<string, Bone>();
  base.scene.traverse((n) => { if ((n as Bone).isBone) osDeLaBase.set(n.name, n as Bone); });
  element.scene.updateMatrixWorld(true);
  for (const m of element.meshes) {
    const s = m as SkinnedMesh;
    if (s.isSkinnedMesh) {
      const squelette = new Skeleton(s.skeleton.bones.map((b) => osDeLaBase.get(b.name) ?? b), s.skeleton.boneInverses);
      base.scene.attach(s);
      s.bind(squelette, s.bindMatrix);
      continue;
    }
    const parent = m.parent && (m.parent as Bone).isBone ? osDeLaBase.get(m.parent.name) : undefined;
    if (parent) parent.add(m);
    else base.scene.attach(m);
  }
}

const zoneDe = (m: Object3D): unknown => m.userData.zone ?? (m.parent && !(m.parent as Bone).isBone ? m.parent.userData.zone : undefined);

const racineDu = (base: SceneChargee): string => base.squelette?.bones.find((b) => !(b.parent as Bone | null)?.isBone)?.name ?? '';

export async function evaluer(entree: EntreeDEvaluation): Promise<FicheDeMesures> {
  const facteurs: Facteurs = { ...FACTEURS_NEUTRES, ...entree.facteurs };
  const pas = entree.pas ?? PAS_PAR_DEFAUT;
  const ecarts: Ecart[] = [];
  let manifeste: ManifesteDeBase | null = null;
  if (entree.manifeste !== undefined) {
    const verdict = validerManifesteDeBase(entree.manifeste, entree.base);
    if (verdict.ok) manifeste = verdict.manifeste;
    else ecarts.push(...verdict.ecarts.map((e): Ecart => ({ garde: 'manifeste', code: e.code, valeur: e.ou || '(racine)', seuil: null, detail: e.detail })));
  }
  if (!manifeste && !estNeutre(facteurs)) throw new Error('évaluation : des facteurs de gabarit sans manifeste de base valide');

  const contenus = [entree.base, ...(entree.elements ?? [])].map(lireGlb);
  const base = await chargerScene(entree.base);
  const elements = await Promise.all((entree.elements ?? []).map(chargerScene));
  const corps = base.meshes.filter((m) => typeof zoneDe(m) === 'string');
  const nomsDuCorps = (corps.length ? corps : base.skinnes).map((m) => m.name);
  for (const e of elements) monter(base, e);
  const meshes = [base, ...elements].flatMap((s) => s.meshes);
  const skinnes = meshes.filter((m): m is SkinnedMesh => (m as SkinnedMesh).isSkinnedMesh === true);

  if (manifeste) appliquerGabarit(base.scene, facteurs, manifeste.gabarit);
  if (entree.silhouettes) poserSilhouettes(base.scene, entree.silhouettes);
  base.scene.updateMatrixWorld(true);

  const inconnus = (entree.clips ?? []).filter((nom) => !base.clips.some((c) => c.name === nom));
  if (inconnus.length) throw new Error(`évaluation : clip(s) absent(s) de la base : ${inconnus.join(', ')} ; clips : ${base.clips.map((c) => c.name).join(', ')}`);
  const clips = entree.clips ? base.clips.filter((c) => entree.clips?.includes(c.name)) : base.clips;

  ecarts.push(
    ...gardePoids({
      meshes: skinnes,
      osDeLaBase: manifeste ? new Set(manifeste.os) : contenus[0].os,
      influencesEtendues: new Map(contenus.flatMap((c) => [...c.influencesEtendues])),
    }),
    ...gardeEnroulement(meshes),
    ...gardeBudget(meshes, entree.plafond ?? PLAFOND_ASSEMBLE),
    ...gardePistesDEchelle(clips, manifeste?.gabarit.racine ?? racineDu(base), manifeste?.osAPositionAnimee ?? []),
    ...gardeEchelleDuRigide(rigidesTenus(base.scene, new Set(manifeste ? [manifeste.prises.main.os, manifeste.prises.off.os] : []))),
  );

  const repos = poseDeRepos(base.scene, meshes);
  const aretes = new Map(meshes.map((m) => [m.name, aretesDe(m)]));
  const niveaux: NiveauDuCorps[] = [];
  const etirements: MesureDEtirement[] = [];
  for (const e of echantillonner(base.scene, meshes, clips, pas)) {
    niveaux.push({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, nomsDuCorps) });
    etirements.push(mesurerEtirement(aretes, repos, e));
  }
  ecarts.push(...gardePiedsAuSol(niveaux, new Set(entree.clipsAuSol ?? [])), ...gardeEtirement(etirements));

  const parMesh = Object.fromEntries(meshes.map((m) => [m.name, trianglesDe(m)]));
  return {
    ecarts,
    mesures: {
      triangles: { total: Object.values(parMesh).reduce((a, b) => a + b, 0), parMesh },
      sommets: meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0),
      os: base.squelette?.bones.length ?? 0,
      images: contenus.reduce((s, c) => s + c.images, 0),
      corps: nomsDuCorps,
      clips: clips.map((c) => {
        const h = niveaux.filter((n) => n.clip === c.name).map((n) => n.plusBas);
        return { nom: c.name, duree: c.duration, echantillons: h.length, plusBas: { min: Math.min(...h), max: Math.max(...h) } };
      }),
      etirement: piresAretes(etirements),
    },
  };
}
