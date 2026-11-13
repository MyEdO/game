/**
 * L'ÉVALUATEUR D'UNE BASE ET DE SES ÉLÉMENTS (#2972) : charge les GLB (`chargerScene`), monte les éléments sur le
 * squelette de la base, valide le manifeste de base, pose gabarit et silhouettes, mesure au repos les shape keys de la
 * base (`gardes/silhouettes.ts`), échantillonne les clips, puis appelle chaque garde de `gardes/` : `poids`,
 * `enroulement`, `budget`, `pistesDEchelle`, `chaines`, `echelleDuRigide`, `tranchantDuRigide`, `silhouettes`, `segments`, `appuis`,
 * `piedsAuSol`, `etirement`, `suiviDuCorps`, `traversee`, `membreDansUnVetement`, `membres`, `amplitude`.
 * Le corps est l'ensemble des meshes de zone de la base (`extras.zone`) ; une base sans zone est un corps d'un seul
 * tenant : ses meshes skinnés.
 */
import { Skeleton, type Bone, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import { tableTotale } from '../../../../src/lib/tableTotale.ts';
import { lireGlb } from '../glb.ts';
import { chargerScene, type SceneChargee } from './chargement.ts';
import { libellesDesMeshes, type Ecart } from './ecart.ts';
import { echantillonner, PAS_PAR_DEFAUT, poseDeRepos } from './echantillonnage.ts';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import { appliquerGabarit, poserFormes } from './gabarit.ts';
import { poidsDeCarrure, poidsDuGabarit, poseDuGabarit } from '../gabarit.ts';
import { FACTEURS_NEUTRES, sontNeutres } from '../facteursDuGabarit.ts';
import { PREFIXE_DES_CLES_DU_GABARIT, validerManifesteDeBase, type ManifesteDeBase } from '../manifesteDeBase.ts';
import { gardePistesDeChaine, suivreLesChaines, type MesureDeChaine } from './gardes/chaines.ts';
import { gardeBudget, PLAFOND_ASSEMBLE, trianglesDe } from './gardes/budget.ts';
import { mesurerAppuis, poserPieds, surfacesDesPieds, type AppuisDuClip, type PoseDuPied } from './gardes/appuis.ts';
import { gardeEchelleDuRigide, rigidesTenus } from './gardes/echelleDuRigide.ts';
import { gardeEnroulement } from './gardes/enroulement.ts';
import { gardeTranchantDuRigide } from './gardes/tranchantDuRigide.ts';
import {
  aretesDe,
  gardeEtirement,
  gardeEtirementAuRepos,
  mesurerEtirement,
  piresAretes,
  type MesureDEtirement,
  type RapportDArete,
} from './gardes/etirement.ts';
import { gardePiedsAuSol, plusBas, type NiveauDuCorps } from './gardes/piedsAuSol.ts';
import { gardePistesDEchelle } from './gardes/pistesDEchelle.ts';
import { gardePoids } from './gardes/poids.ts';
import { mesurerSilhouettes, sousLesFormes, type MesuresDesSilhouettes } from './gardes/silhouettes.ts';
import { etenduesDesSegments, gardeSegments, type MesuresDesSegments } from './gardes/segments.ts';
import { gardeSuiviDuCorps } from './gardes/suiviDuCorps.ts';
import { suivreLesAmplitudes } from './gardes/amplitude.ts';
import {
  gardePercementAuRepos,
  gardeTraversee,
  indicesDe,
  lierLesCouches,
  mesurerTraversee,
  positionsDe,
  sansLesZonesMasquees,
  type TraverseeDUnEchantillon,
} from './gardes/traversee.ts';
import {
  gardeMembreDansUnVetement,
  mesurerMembresDansUnVetement,
  pairesHorsDeZone,
  zonesVoisines,
  type MembreDUnEchantillon,
} from './gardes/membreDansUnVetement.ts';
import { gardeMembres, mesurerMembres, ZONES_DES_MEMBRES, ZONES_DU_TRONC, type MembreDansLeTronc } from './gardes/membres.ts';
import { COUCHES, RANG_DU_CORPS, type CategorieDElement, type Couche } from '../element.ts';
import { meshesDuCorps, peauDeLaTenue, zoneDe } from './corps.ts';
import { poserLaPile } from './pile.ts';
import { endroitDe, ordreDesCouches, type BilanDePile } from '../pile.ts';

/** Ce qu'un élément déclare de sa place sur le corps : sa couche, et les zones du corps qu'il masque. */
export interface CoucheDeLElement {
  readonly couche: Couche;
  readonly couvre: readonly string[];
  readonly categorie?: CategorieDElement;
}

export interface EntreeDEvaluation {
  readonly base: Uint8Array;
  readonly elements?: readonly Uint8Array[];
  /** La couche et les zones couvertes de chaque élément de `elements`, dans son ordre (`ManifesteDElement`), `null` pour
   *  un élément sans couche ; sans elles, la traversée des couches n'est pas mesurée (`gardes/traversee.ts`). */
  readonly couches?: readonly (CoucheDeLElement | null)[];
  /** Par élément de `elements`, dans son ordre, vrai si sa forme est celle d'une arme : seuls ses rigides portent un
   *  tranchant (`gardes/tranchantDuRigide.ts`) ; sans elle, tout rigide pendu à la prise `main` en porte un. */
  readonly armes?: readonly boolean[];
  /** Le manifeste de base brut, validé ici (`validerManifesteDeBase`) ; sans lui, ni gabarit ni prise, et seule la
   *  racine a une position animée. */
  readonly manifeste?: unknown;
  /** Les facteurs de gabarit donnés, les autres aux `FACTEURS_NEUTRES`. */
  readonly facteurs?: Partial<GabaritResolu>;
  /** Les poids explicites des silhouettes déclarées au manifeste valide, sinon des formes du GLB de base hors clés `gabarit_*` ; ils priment sur la carrure calculée et un nom hors de cette liste est refusé par `silhouette-absente`. */
  readonly silhouettes?: Readonly<Record<string, number>>;
  /** Les clips échantillonnés, par nom ; tous sans liste. */
  readonly clips?: readonly string[];
  readonly pas?: number;
  readonly plafond?: number;
  /** Les clips au sol (`gardePiedsAuSol`). */
  readonly clipsAuSol?: readonly string[];
  /** Par clip de la base, le nombre d'écarts `membre-dans-un-vetement` que la tenue admet (`gardeMembreDansUnVetement`). */
  readonly plafondsDesMembres?: Readonly<Record<string, number>>;
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
    /** Les triangles assemblés, et ceux de chaque mesh de la base puis des éléments, dans leur ordre, sous son libellé (`libellesDesMeshes`). */
    readonly triangles: { readonly total: number; readonly parMesh: readonly { readonly mesh: string; readonly triangles: number }[] };
    readonly sommets: number;
    readonly os: number;
    readonly images: number;
    /** Les libellés des meshes du corps (`libellesDesMeshes`). */
    readonly corps: readonly string[];
    readonly clips: readonly MesuresDuClip[];
    readonly etirement: Readonly<Record<string, readonly RapportDArete<string>[]>>;
    /** Les silhouettes résolues de la base mesurées au repos. */
    readonly silhouettes: MesuresDesSilhouettes;
    /** Les segments du gabarit mesurés au repos ; `null` sans manifeste valide. */
    readonly segments: MesuresDesSegments | null;
    /** Les chaînes du manifeste valide, leurs pistes et leurs rotations jouées ; aucune sans manifeste. */
    readonly chaines: readonly MesureDeChaine[];
    /** Ce que la pile des couches a résolu au montage (`resoudreLaPile`). */
    readonly pile: BilanDePile;
  };
}

/** Monte `element` sur la base : un mesh skinné se lie aux os de la base de même nom, un rigide sous un os passe sous
 *  l'os de la base de même nom, à la même position locale. Le rigide est le nœud glTF de la primitive (`SceneChargee.origines`). */
export function monter(base: SceneChargee, element: SceneChargee): void {
  const osDeLaBase = new Map<string, Bone>();
  base.scene.traverse((n) => { if ((n as Bone).isBone) osDeLaBase.set(n.name, n as Bone); });
  element.scene.updateMatrixWorld(true);
  const rigides = new Set<Object3D>();
  for (const m of element.meshes) {
    const s = m as SkinnedMesh;
    if (s.isSkinnedMesh) {
      const squelette = new Skeleton(s.skeleton.bones.map((b) => osDeLaBase.get(b.name) ?? b), s.skeleton.boneInverses);
      base.scene.attach(s);
      s.bind(squelette, s.bindMatrix);
      continue;
    }
    const origine = element.origines.get(m);
    if (!origine) throw new Error(`montage : mesh ${m.name} sans nœud glTF`);
    rigides.add(origine.objet);
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
  ...(manifeste?.gabarit ? poidsDuGabarit(facteurs, manifeste.gabarit.bornes, silhouettes) : {}),
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
  const table = manifeste?.gabarit;
  if (!table && !sontNeutres(facteurs)) throw new Error('évaluation : des facteurs de gabarit sans table de gabarit au manifeste de base valide');

  const contenus = [entree.base, ...(entree.elements ?? [])].map(lireGlb);
  const formes = contenus[0].formes;
  const formesDeSilhouette = [...formes].filter((nom) => !nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT));
  const nomsDesSilhouettes = manifeste?.silhouettes ?? formesDeSilhouette;
  const absentes = Object.keys(entree.silhouettes ?? {}).filter((nom) => !nomsDesSilhouettes.includes(nom));
  if (absentes.length) throw new Error(`évaluation : [silhouette-absente] ${absentes.join(', ')} : nom(s) absent(s) des silhouettes déclarées ; silhouettes : ${nomsDesSilhouettes.join(', ') || 'aucune'}`);
  const parCarrure: Readonly<Record<string, number>> = table ? poidsDeCarrure(facteurs.st, table.st) : {};
  const carrure = Object.entries(parCarrure).find(([, poids]) => poids > 0)?.[0];
  if (carrure && !nomsDesSilhouettes.includes(carrure)) throw new Error(`évaluation : [carrure-absente] st=${facteurs.st} : ${carrure} est absente des silhouettes déclarées de la base`);
  const aZero = tableTotale(nomsDesSilhouettes, () => 0);
  const poidsDesFormes = poidsDesFormesDe(manifeste, facteurs);
  const carrures = Object.fromEntries(Object.entries(parCarrure).filter(([nom]) => nomsDesSilhouettes.includes(nom)));
  const poidsDesSilhouettes = { ...aZero, ...carrures, ...entree.silhouettes };
  const poids = poidsDesFormes(poidsDesSilhouettes);
  if (manifeste && !sontNeutres(facteurs)) {
    const manquantes = Object.keys(poids).filter((nom) => nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT) && !formes.has(nom));
    if (manquantes.length) throw new Error(`évaluation : [gabarit-absent] shape key(s) absente(s) de la base : ${manquantes.join(', ')}`);
  }
  const base = await chargerScene(entree.base);
  const elements = await Promise.all((entree.elements ?? []).map(chargerScene));
  const corps = meshesDuCorps(base);
  const zones = new Map([base, ...elements].flatMap((s) => s.meshes.flatMap((m) => { const z = zoneDe(m); return typeof z === 'string' ? [[m, z] as const] : []; })));
  const zone = (m: Mesh): string | undefined => zones.get(m);
  const racine = table?.racine ?? racineDu(base);
  for (const e of elements) monter(base, e);
  const meshes = [base, ...elements].flatMap((s) => s.meshes);
  const skinnes = meshes.filter((m): m is SkinnedMesh => (m as SkinnedMesh).isSkinnedMesh === true);
  const corpsSkinne = base.skinnes.filter((m) => corps.includes(m));
  const libelle = libellesDesMeshes([base, ...elements]);

  ecarts.push(...gardeSuiviDuCorps(base.scene, corps, elements.flatMap((e) => e.skinnes), libelle));

  const pose = manifeste && table ? poseDuGabarit({ ...manifeste, gabarit: table }, facteurs) : null;
  const etendues = () => etenduesDesSegments(poseDeRepos(base.scene, corpsSkinne), corpsSkinne, Object.keys(pose?.echellesDesOs ?? {}));
  const neutre = sousLesFormes(base.scene, nomsDesSilhouettes, (poserSeules) => poserSeules({}, meshes), poidsDesFormesDe(manifeste, FACTEURS_NEUTRES)).positions;
  if (manifeste) poserFormes(base.scene, poidsDesFormesDe(manifeste, FACTEURS_NEUTRES)(poidsDesSilhouettes));
  const sansGabarit = pose ? etendues() : null;
  poserFormes(base.scene, poids);
  const fondue = poseDeRepos(base.scene, meshes).positions;
  const gabarit = manifeste && table ? appliquerGabarit(base.scene, facteurs, { ...manifeste, gabarit: table }, base.squelette ?? undefined) : null;
  base.scene.updateMatrixWorld(true);
  const segments = pose && sansGabarit ? gardeSegments(sansGabarit, etendues(), pose) : null;

  const inconnus = [...(entree.clips ?? []), ...Object.keys(entree.plafondsDesMembres ?? {})].filter((nom) => !base.clips.some((c) => c.name === nom));
  if (inconnus.length) throw new Error(`évaluation : clip(s) absent(s) de la base : ${inconnus.join(', ')} ; clips : ${base.clips.map((c) => c.name).join(', ')}`);
  const clips = entree.clips ? base.clips.filter((c) => entree.clips?.includes(c.name)) : base.clips;

  const declarees = elements.flatMap((e, k) => {
    const c = entree.couches?.[k];
    return c ? [{ rang: COUCHES.indexOf(c.couche), meshes: e.skinnes, couvre: c.couvre, accessoire: c.categorie === 'accessoire' }] : [];
  });
  const montre = sansLesZonesMasquees(declarees, zone);
  const peau = peauDeLaTenue(corps, declarees, zone);
  const corpsMontre = montre(corps, RANG_DU_CORPS);
  const pieceDe = (rang: number, montres: readonly SkinnedMesh[], accessoire: boolean) => ({
    rang, accessoire, meshes: montres,
    neutres: montres.map((m) => { const positions = neutre.get(m) as Float32Array; return { positions, indices: Uint32Array.from(indicesDe(m, positions.length / 3)) }; }),
  });
  const declareesMontrees = declarees.map((d) => pieceDe(d.rang, montre(d.meshes, d.rang), d.accessoire));
  const visibles = new Set([...corpsMontre, ...declareesMontrees.flatMap((d) => d.meshes)]);
  const masques = new Set([...corps, ...declarees.flatMap((d) => d.meshes)].filter((m) => !visibles.has(m)));

  const chaines = manifeste?.chaines ?? {};
  const silhouettes = mesurerSilhouettes({ scene: base.scene, corps: corpsSkinne, silhouettes: nomsDesSilhouettes, st: table?.st, poidsDesFormes });
  const sansCles = sousLesFormes(base.scene, nomsDesSilhouettes, (poserSeules) => poserSeules({}, meshes), poidsDesFormes);
  const couvre = ordreDesCouches<(typeof declareesMontrees)[number]>(peau.map((c) => neutre.get(c) as Float32Array));
  const pile = poserLaPile([pieceDe(RANG_DU_CORPS, montre(corpsSkinne, RANG_DU_CORPS), false), ...declareesMontrees], couvre, fondue, new Set(Object.values(chaines).flat()), peau);
  base.scene.updateMatrixWorld(true);
  const pistesDeChaine = gardePistesDeChaine(base.scene, clips, chaines);
  ecarts.push(
    ...gardePoids({
      meshes: skinnes,
      osDeLaBase: manifeste ? new Set(manifeste.os) : contenus[0].os,
      libelle,
    }),
    ...gardeEnroulement(meshes, libelle),
    ...gardeBudget(meshes.filter((m) => !masques.has(m)), libelle, entree.plafond ?? PLAFOND_ASSEMBLE),
    ...gardePistesDEchelle(base.scene, clips, racine, manifeste?.osAPositionAnimee ?? []),
    ...pistesDeChaine.ecarts,
    ...gardeEchelleDuRigide(rigidesTenus(base.scene, new Set(manifeste?.prises ? [manifeste.prises.main.os, manifeste.prises.secondaire.os] : [])), libelle),
    ...(manifeste?.prises ? gardeTranchantDuRigide(base.scene, manifeste.prises.main, libelle, entree.armes && new Set(elements.flatMap((e, k) => (entree.armes?.[k] ? e.meshes : [])))) : []),
  );

  ecarts.push(...silhouettes.ecarts, ...(segments?.ecarts ?? []));

  const repos = poseDeRepos(base.scene, meshes);
  const suiviDesChaines = suivreLesChaines(base.scene, chaines, repos);
  const amplitudes = suivreLesAmplitudes(base.scene, manifeste?.bornesArticulaires ?? {}, repos);
  const aretes = new Map(meshes.map((m) => [m, aretesDe(m)]));
  ecarts.push(...gardeEtirementAuRepos(aretes, libelle, sansCles, repos));
  const niveaux: NiveauDuCorps[] = [];
  const etirements: MesureDEtirement[] = [];
  const surfaces = manifeste ? surfacesDesPieds(corpsSkinne, manifeste.appuis.pieds) : [];
  const posesDesPieds: PoseDuPied[] = [];
  const peaux = peau.map((c) => positionsDe(repos, c));
  const endroits = new Map<Mesh, Uint32Array>(declareesMontrees.flatMap((d) => d.meshes).map((m) => {
    const positions = positionsDe(repos, m);
    return [m, endroitDe({ positions, indices: indicesDe(m, positions.length / 3) }, peaux)];
  }));
  const endroit = (m: Mesh): Uint32Array => endroits.get(m) as Uint32Array;
  const couches = lierLesCouches(corpsMontre, declareesMontrees, repos, couvre, endroit);
  const traversees: TraverseeDUnEchantillon[] = [];
  const voisines = zonesVoisines(corps, zone, repos);
  const horsDeZone = pairesHorsDeZone(corpsMontre, declareesMontrees.flatMap((d) => d.meshes), zone, voisines, endroit);
  const peauxHorsDeZone = pairesHorsDeZone(corpsMontre, corps, zone, voisines, (m) => indicesDe(m, positionsDe(repos, m).length / 3));
  const membresSousVetement: MembreDUnEchantillon[] = [];
  const dansLesZones = (noms: readonly string[]) => corps.filter((m) => noms.includes(zone(m) as string));
  const [membres, tronc] = [dansLesZones(ZONES_DES_MEMBRES), dansLesZones(ZONES_DU_TRONC)];
  const membresDansLeTronc: MembreDansLeTronc[] = [];
  for (const e of echantillonner(base.scene, meshes, clips, pas, gabarit)) {
    traversees.push(...mesurerTraversee(couches.liaisons, e));
    membresSousVetement.push(...mesurerMembresDansUnVetement(horsDeZone, peauxHorsDeZone, e));
    membresDansLeTronc.push(...mesurerMembres(membres, tronc, e));
    niveaux.push({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, corps) });
    etirements.push(mesurerEtirement(aretes, sansCles, e));
    suiviDesChaines.echantillon(e);
    amplitudes.echantillon(e);
    if (manifeste && e.clip === manifeste.clips.marche) posesDesPieds.push(...poserPieds(e, surfaces, racine));
  }
  const appuis = mesurerAppuis(posesDesPieds, manifeste ? { [manifeste.clips.marche]: manifeste.appuis.vitesseAuSol * (pose?.echelleDeVitesse ?? 1) } : {});
  ecarts.push(...appuis.ecarts);
  ecarts.push(...gardePiedsAuSol(niveaux, new Set(entree.clipsAuSol ?? [])), ...gardeEtirement(etirements, libelle), ...gardeTraversee(traversees, libelle), ...gardeMembreDansUnVetement(membresSousVetement, libelle, Object.fromEntries(clips.flatMap((c) => (entree.plafondsDesMembres?.[c.name] ? [[c.name, entree.plafondsDesMembres[c.name]]] : [])))), ...gardeMembres(membresDansLeTronc, libelle), ...amplitudes.ecarts());
  if (sontNeutres(facteurs) && Object.values(poids).every((p) => p === 0)) ecarts.push(...gardePercementAuRepos(couches.percements, libelle));

  const parMesh = meshes.map((m) => ({ mesh: libelle(m), triangles: trianglesDe(m) }));
  return {
    ecarts,
    mesures: {
      triangles: { total: parMesh.reduce((s, m) => s + m.triangles, 0), parMesh },
      sommets: meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0),
      os: base.squelette?.bones.length ?? 0,
      images: contenus.reduce((s, c) => s + c.images, 0),
      corps: corps.map(libelle),
      clips: clips.map((c) => {
        const h = niveaux.filter((n) => n.clip === c.name).map((n) => n.plusBas);
        const mesure = appuis.mesures.find((a) => a.clip === c.name);
        return { nom: c.name, duree: c.duration, echantillons: h.length, plusBas: { min: Math.min(...h), max: Math.max(...h) }, ...(mesure ? { appuis: mesure } : {}) };
      }),
      etirement: piresAretes(etirements, libelle),
      silhouettes: silhouettes.mesures,
      segments: segments?.mesures ?? null,
      chaines: suiviDesChaines.mesures(pistesDeChaine.clipsPistes),
      pile,
    },
  };
}
