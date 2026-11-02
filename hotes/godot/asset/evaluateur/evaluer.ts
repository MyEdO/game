/**
 * L'ÉVALUATEUR D'UNE BASE ET DE SES ÉLÉMENTS (#2972) : charge les GLB (`chargerScene`), monte les éléments sur le
 * squelette de la base, valide le manifeste de base, pose gabarit et silhouettes, mesure au repos les shape keys de la
 * base (`gardes/silhouettes.ts`), échantillonne les clips, puis appelle chaque garde de `gardes/` : `poids`,
 * `enroulement`, `budget`, `pistesDEchelle`, `echelleDuRigide`, `silhouettes`, `appuis`, `piedsAuSol`, `etirement`, `suiviDuCorps`.
 * Le corps est l'ensemble des meshes de zone de la base (`extras.zone`) ; une base sans zone est un corps d'un seul
 * tenant : ses meshes skinnés.
 */
import { Skeleton, type Bone, type Object3D, type SkinnedMesh } from 'three';
import { tableTotale } from '../../../../src/lib/tableTotale.ts';
import { lireGlb } from '../glb.ts';
import { chargerScene, type SceneChargee } from './chargement.ts';
import type { Ecart } from './ecart.ts';
import { echantillonner, PAS_PAR_DEFAUT, poseDeRepos } from './echantillonnage.ts';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import { appliquerGabarit, poserFormes } from './gabarit.ts';
import { CARRURE_MOINS, CARRURE_PLUS, FACTEURS_NEUTRES, poidsDeCarrure, poidsDuGabarit } from '../gabarit.ts';
import { PREFIXE_DES_CLES_DU_GABARIT, validerManifesteDeBase, type ManifesteDeBase } from '../manifesteDeBase.ts';
import { gardeBudget, PLAFOND_ASSEMBLE, trianglesDe } from './gardes/budget.ts';
import { mesurerAppuis, poserPieds, surfacesDesPieds, type AppuisDuClip, type PoseDuPied } from './gardes/appuis.ts';
import { gardeEchelleDuRigide, rigidesTenus } from './gardes/echelleDuRigide.ts';
import { gardeEnroulement } from './gardes/enroulement.ts';
import { aretesDe, gardeEtirement, gardeEtirementAuRepos, mesurerEtirement, piresAretes, type MesureDEtirement, type RapportDArete } from './gardes/etirement.ts';
import { gardePiedsAuSol, plusBas, type NiveauDuCorps } from './gardes/piedsAuSol.ts';
import { gardePistesDEchelle } from './gardes/pistesDEchelle.ts';
import { gardePoids } from './gardes/poids.ts';
import { mesurerSilhouettes, sousLesFormes, type MesuresDesSilhouettes } from './gardes/silhouettes.ts';
import { gardeSuiviDuCorps } from './gardes/suiviDuCorps.ts';
import { meshesDuCorps } from './corps.ts';

export interface EntreeDEvaluation {
  readonly base: Uint8Array;
  readonly elements?: readonly Uint8Array[];
  /** Le manifeste de base brut, validé ici (`validerManifesteDeBase`) ; sans lui, ni gabarit ni prise, et seule la
   *  racine a une position animée. */
  readonly manifeste?: unknown;
  /** Les facteurs de gabarit donnés, les autres à 1 (`FACTEURS_NEUTRES`). */
  readonly facteurs?: Partial<GabaritResolu>;
  /** Les poids explicites des silhouettes déclarées au manifeste valide, sinon des formes du GLB de base hors clés `gabarit_*` ; ils priment sur la carrure calculée et un nom hors de cette liste est refusé par `silhouette-absente`. */
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
  readonly appuis?: AppuisDuClip;
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
    /** Les silhouettes résolues de la base mesurées au repos. */
    readonly silhouettes: MesuresDesSilhouettes;
  };
}

const estNeutre = (f: GabaritResolu): boolean => Object.values(f).every((v) => v === 1);

/** Monte `element` sur la base : un mesh skinné se lie aux os de la base de même nom, un rigide sous un os passe sous
 *  l'os de la base de même nom, à la même position locale. Le rigide est le nœud glTF de la primitive (`SceneChargee.noeuds`). */
export function monter(base: SceneChargee, element: SceneChargee): void {
  const osDeLaBase = new Map<string, Bone>();
  base.scene.traverse((n) => { if ((n as Bone).isBone) osDeLaBase.set(n.name, n as Bone); });
  element.scene.updateMatrixWorld(true);
  const noeudDe = (o: Object3D): Object3D => (element.noeuds.has(o) || !o.parent ? o : noeudDe(o.parent));
  const rigides = new Set<Object3D>();
  for (const m of element.meshes) {
    const s = m as SkinnedMesh;
    if (s.isSkinnedMesh) {
      const squelette = new Skeleton(s.skeleton.bones.map((b) => osDeLaBase.get(b.name) ?? b), s.skeleton.boneInverses);
      base.scene.attach(s);
      s.bind(squelette, s.bindMatrix);
      continue;
    }
    rigides.add(noeudDe(m));
  }
  for (const n of rigides) {
    const parent = n.parent && (n.parent as Bone).isBone ? osDeLaBase.get(n.parent.name) : undefined;
    if (parent) parent.add(n);
    else base.scene.attach(n);
  }
}

const racineDu = (base: SceneChargee): string => base.squelette?.bones.find((b) => !(b.parent as Bone | null)?.isBone)?.name ?? '';

export const poidsDesFormesDe = (manifeste: ManifesteDeBase | null, facteurs: GabaritResolu) => (silhouettes: Readonly<Record<string, number>>): Readonly<Record<string, number>> => ({
  ...silhouettes,
  ...(manifeste ? poidsDuGabarit(facteurs, manifeste.gabarit.bornes, silhouettes) : {}),
});

export async function evaluer(entree: EntreeDEvaluation): Promise<FicheDeMesures> {
  const facteurs: GabaritResolu = { ...FACTEURS_NEUTRES, ...entree.facteurs };
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
  const formes = contenus[0].formes;
  const formesDeSilhouette = [...formes].filter((nom) => !nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT));
  const nomsDesSilhouettes = manifeste?.silhouettes ?? formesDeSilhouette;
  const absentes = Object.keys(entree.silhouettes ?? {}).filter((nom) => !nomsDesSilhouettes.includes(nom));
  if (absentes.length) throw new Error(`évaluation : [silhouette-absente] ${absentes.join(', ')} : nom(s) absent(s) des silhouettes déclarées ; silhouettes : ${nomsDesSilhouettes.join(', ') || 'aucune'}`);
  const carrure = facteurs.st < 1 ? CARRURE_MOINS : facteurs.st > 1 ? CARRURE_PLUS : null;
  if (carrure && !nomsDesSilhouettes.includes(carrure)) throw new Error(`évaluation : [carrure-absente] st=${facteurs.st} : ${carrure} est absente des silhouettes déclarées de la base`);
  const aZero = tableTotale(nomsDesSilhouettes, () => 0);
  const poidsDesFormes = poidsDesFormesDe(manifeste, facteurs);
  const carrures = manifeste ? Object.fromEntries(Object.entries(poidsDeCarrure(facteurs.st, manifeste.gabarit.st)).filter(([nom]) => nomsDesSilhouettes.includes(nom))) : {};
  const poids = poidsDesFormes({ ...aZero, ...carrures, ...entree.silhouettes });
  if (manifeste && !estNeutre(facteurs)) {
    const manquantes = Object.keys(poids).filter((nom) => nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT) && !formes.has(nom));
    if (manquantes.length) throw new Error(`évaluation : [gabarit-absent] shape key(s) absente(s) de la base : ${manquantes.join(', ')}`);
  }
  const base = await chargerScene(entree.base);
  const elements = await Promise.all((entree.elements ?? []).map(chargerScene));
  const nomsDuCorps = meshesDuCorps(base).map((m) => m.name);
  for (const e of elements) monter(base, e);
  const meshes = [base, ...elements].flatMap((s) => s.meshes);
  const skinnes = meshes.filter((m): m is SkinnedMesh => (m as SkinnedMesh).isSkinnedMesh === true);

  ecarts.push(...gardeSuiviDuCorps(base.scene, meshesDuCorps(base), elements.flatMap((e) => e.skinnes)));

  poserFormes(base.scene, poids);
  const gabarit = manifeste ? appliquerGabarit(base.scene, facteurs, manifeste, base.squelette ?? undefined) : null;
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

  const silhouettes = mesurerSilhouettes({ scene: base.scene, corps: base.skinnes.filter((m) => nomsDuCorps.includes(m.name)), silhouettes: nomsDesSilhouettes, st: manifeste?.gabarit.st, poidsDesFormes });
  ecarts.push(...silhouettes.ecarts);

  const sansCles = sousLesFormes(base.scene, nomsDesSilhouettes, (poserSeules) => poserSeules({}, meshes), poidsDesFormes);
  const repos = poseDeRepos(base.scene, meshes);
  const aretes = new Map(meshes.map((m) => [m.name, aretesDe(m)]));
  ecarts.push(...gardeEtirementAuRepos(aretes, sansCles, repos));
  const niveaux: NiveauDuCorps[] = [];
  const etirements: MesureDEtirement[] = [];
  const surfaces = manifeste ? surfacesDesPieds(base.skinnes.filter((m) => nomsDuCorps.includes(m.name)), manifeste.appuis.pieds) : [];
  const posesDesPieds: PoseDuPied[] = [];
  for (const e of echantillonner(base.scene, meshes, clips, pas, gabarit)) {
    niveaux.push({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, nomsDuCorps) });
    etirements.push(mesurerEtirement(aretes, sansCles, e));
    if (manifeste && Object.prototype.hasOwnProperty.call(manifeste.appuis.vitessesAuSol, e.clip)) posesDesPieds.push(...poserPieds(e, surfaces, manifeste.gabarit.racine));
  }
  const appuis = mesurerAppuis(posesDesPieds, manifeste?.appuis.vitessesAuSol ?? {});
  ecarts.push(...appuis.ecarts);
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
        const mesure = appuis.mesures.find((a) => a.clip === c.name);
        return { nom: c.name, duree: c.duration, echantillons: h.length, plusBas: { min: Math.min(...h), max: Math.max(...h) }, ...(mesure ? { appuis: mesure } : {}) };
      }),
      etirement: piresAretes(etirements),
      silhouettes: silhouettes.mesures,
    },
  };
}
