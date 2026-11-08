/**
 * LE MANIFESTE D'UNE BASE, c'est-à-dire d'un CORPS (#2972, #2991, schéma 5) : son squelette, ses chaînes d'appendice, ses
 * zones, ses emplacements, ses prises s'il en a, ses shape keys, la table du gabarit du seul corps qui en porte (la base
 * humanoïde), son porteur de référence, sa table rôle → clip, ses appuis et ses os à position animée, et ses surfaces
 * (`surfaces.ts`), validés contre le GLB livré (`lireGlb`, `glb.ts`). Les rôles et les clips de la table se jugent dans le
 * graphe de l'hôte (`ecartsDeClips`, `clips.ts`).
 */
import { estObjet } from '../../../src/hote/formes.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { sha256 } from './empreinte.ts';
import { lireGlb } from './glb.ts';
import { estListeDeChaines, estTriplet, type Attache } from './attache.ts';
import { estSilhouette } from './silhouettes.ts';
import { FACTEURS_NEUTRES } from './facteursDuGabarit.ts';
import { ecartsAuGlb, lireSurfaces, type CodeDEcartDeSurface, type Surface } from './surfaces.ts';
import type { TableDeClips, TablesDeuxMains } from './clips.ts';

export const VERSION_DU_SCHEMA_DE_BASE = 5;

export const CLES_DU_GABARIT = ['legs', 'arms', 'head'] as const;
export const PREFIXE_DES_CLES_DU_GABARIT = 'gabarit_';

export type BornesDuGabarit = Readonly<Record<typeof CLES_DU_GABARIT[number], { readonly min: number; readonly max: number }>>;

export function fauteDeBornesDuGabarit({ min, max }: BornesDuGabarit[typeof CLES_DU_GABARIT[number]], neutre: number): string | undefined {
  return Number.isFinite(min) && Number.isFinite(max) && min > 0 && min <= neutre && max >= neutre
    ? undefined
    : `bornes ${min} et ${max} : 0 < min <= ${neutre} <= max attendu`;
}

export interface TableDeGabarit {
  readonly bornes: BornesDuGabarit;
  readonly legs: readonly string[];
  readonly arms: readonly string[];
  readonly head: readonly string[];
  readonly racine: string;
  /** Les bornes de `st` : `carrure_moins` atteint 1 à `min`, `carrure_plus` atteint 1 à `max`. */
  readonly st: { readonly min: number; readonly max: number };
}

/** Le porteur de la planche du corps : son espèce au plan de bestiaire, son gabarit si le corps porte la table du
 *  gabarit, et sa Taille, par id, à l'échelle d'art `echelleDArt`. */
export interface PorteurDeReference {
  readonly espece: string;
  readonly gabarit?: string;
  readonly taille: string;
  readonly echelleDArt: number;
}

/** Les os des pieds, et la vitesse au sol en m/s du clip du rôle `walk` à la taille de construction. */
export interface Appuis {
  readonly pieds: readonly string[];
  readonly plusBas: readonly CandidatDAppui[];
  readonly vitesseAuSol: number;
}

export interface CandidatDAppui {
  readonly position: readonly [number, number, number];
  readonly os: readonly { readonly nom: string; readonly poids: number }[];
  readonly deltas: Readonly<Record<string, readonly [number, number, number]>>;
}

export interface ManifesteDeBase {
  readonly schema: typeof VERSION_DU_SCHEMA_DE_BASE;
  readonly base: string;
  readonly os: readonly string[];
  readonly chaines: Readonly<Record<string, readonly string[]>>;
  readonly zones: readonly string[];
  readonly emplacements: Readonly<Record<string, Attache>>;
  /** Absentes, le corps ne tient aucune arme. */
  readonly prises?: { readonly main: Attache; readonly off: Attache };
  readonly silhouettes: readonly string[];
  /** Propre à la base humanoïde. */
  readonly gabarit?: TableDeGabarit;
  readonly porteur: PorteurDeReference;
  /** Le clip de chaque rôle que la base joue ; `walk` exigé. */
  readonly clips: TableDeClips & { readonly walk: string };
  /** Par maniement, le clip de chaque rôle que la base joue en tenant des deux mains un objet de ce maniement (#3319) ;
   *  un maniement ou un rôle absent joue celui de `clips`. */
  readonly clipsDeuxMains?: TablesDeuxMains;
  readonly appuis: Appuis;
  /** Les os, hors racine, dont un clip anime la position (`gardePistesDEchelle`). */
  readonly osAPositionAnimee: readonly string[];
  /** Absentes, la base garde les couleurs de son GLB. */
  readonly surfaces?: readonly Surface[];
  readonly glb: { readonly sha256: string; readonly octets: number };
}

export type CodeDEcartDeBase =
  | 'forme'
  | 'version-inconnue'
  | 'os-inconnu'
  | 'chaine-sur-os-absent'
  | 'zone-sans-mesh'
  | 'emplacement-sur-os-absent'
  | 'prise-absente'
  | 'silhouette-absente'
  | 'silhouette-inconnue'
  | 'role-inconnu'
  | 'clip-absent'
  | 'maniement-inconnu'
  | CodeDEcartDeSurface
  | 'glb-different';

export interface EcartDeBase {
  readonly code: CodeDEcartDeBase;
  readonly ou: string;
  readonly detail: string;
}

export type VerdictDeBase = { readonly ok: true; readonly manifeste: ManifesteDeBase } | { readonly ok: false; readonly ecarts: readonly EcartDeBase[] };

type Brut = Record<string, unknown>;

/** La réduction de `brut` au schéma 5, ou ses écarts de forme. */
function reduire(brut: unknown): { manifeste?: ManifesteDeBase; ecarts: EcartDeBase[] } {
  const ecarts: EcartDeBase[] = [];
  const forme = (ou: string, detail: string) => ecarts.push({ code: 'forme', ou, detail });
  if (!estObjet(brut)) return { ecarts: [{ code: 'forme', ou: '', detail: 'le manifeste n’est pas un objet' }] };
  if (brut.schema !== VERSION_DU_SCHEMA_DE_BASE) ecarts.push({ code: 'version-inconnue', ou: 'schema', detail: `${String(brut.schema)}, ${VERSION_DU_SCHEMA_DE_BASE} attendue` });
  const chaine = (v: unknown, ou: string): string => {
    if (typeof v !== 'string') forme(ou, 'chaîne attendue');
    return typeof v === 'string' ? v : '';
  };
  const liste = (v: unknown, ou: string): string[] => {
    if (!estListeDeChaines(v)) forme(ou, 'liste de chaînes attendue');
    return estListeDeChaines(v) ? v : [];
  };
  const objet = (v: unknown, ou: string): Brut => {
    if (!estObjet(v)) forme(ou, 'objet attendu');
    return estObjet(v) ? v : {};
  };
  const nombre = (v: unknown, ou: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) forme(ou, 'nombre attendu');
    return typeof v === 'number' ? v : 0;
  };
  const id = (v: unknown, ou: string): string => {
    if (typeof v !== 'string' || !v) forme(ou, 'chaîne non vide attendue');
    return typeof v === 'string' ? v : '';
  };
  const positif = (v: unknown, ou: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) forme(ou, 'nombre fini > 0 attendu');
    return typeof v === 'number' ? v : 0;
  };
  const attache = (v: unknown, ou: string): Attache | null => {
    if (estObjet(v) && typeof v.os === 'string' && estTriplet(v.position) && estTriplet(v.rotation)) return { os: v.os, position: v.position, rotation: v.rotation };
    forme(ou, '`os` chaîne, `position` et `rotation` triplets de nombres attendus');
    return null;
  };
  const base = chaine(brut.base, 'base');
  const os = liste(brut.os, 'os');
  const chaines = Object.fromEntries(Object.entries(objet(brut.chaines, 'chaines')).map(([id, c]) => [id, liste(c, `chaines.${id}`)]));
  const zones = liste(brut.zones, 'zones');
  const emplacements = Object.fromEntries(Object.entries(objet(brut.emplacements, 'emplacements')).flatMap(([id, e]) => {
    const a = attache(e, `emplacements.${id}`);
    return a ? [[id, a]] : [];
  }));
  const prisesBrutes = brut.prises === undefined ? undefined : objet(brut.prises, 'prises');
  const prises: Partial<Record<'main' | 'off', Attache>> = {};
  for (const cle of ['main', 'off'] as const) {
    if (!prisesBrutes) break;
    if (prisesBrutes[cle] === undefined) ecarts.push({ code: 'prise-absente', ou: `prises.${cle}`, detail: `la prise \`${cle}\` n’est pas déclarée` });
    else prises[cle] = attache(prisesBrutes[cle], `prises.${cle}`) ?? undefined;
  }
  const silhouettes = liste(brut.silhouettes, 'silhouettes');
  for (const nom of silhouettes) if (nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT)) forme('silhouettes', `${nom} est une clé de gabarit, pas une silhouette`);
  const lireGabarit = (): TableDeGabarit => {
    const g = objet(brut.gabarit, 'gabarit');
    const st = objet(g.st, 'gabarit.st');
    const b = objet(g.bornes, 'gabarit.bornes');
    for (const cle of Object.keys(b)) if (!(CLES_DU_GABARIT as readonly string[]).includes(cle)) forme(`gabarit.bornes.${cle}`, 'champ inconnu');
    const bornes = tableTotale(CLES_DU_GABARIT, (cle) => {
      const ou = `gabarit.bornes.${cle}`;
      const plage = b[cle];
      if (!estObjet(plage)) {
        forme(ou, 'objet attendu');
        return { min: FACTEURS_NEUTRES[cle], max: FACTEURS_NEUTRES[cle] };
      }
      const min = typeof plage.min === 'number' ? plage.min : 0;
      const max = typeof plage.max === 'number' ? plage.max : 0;
      if (typeof plage.min !== 'number' || !Number.isFinite(min) || typeof plage.max !== 'number' || !Number.isFinite(max)) {
        forme(ou, 'min et max : nombres finis attendus');
      } else {
        const faute = fauteDeBornesDuGabarit({ min, max }, FACTEURS_NEUTRES[cle]);
        if (faute) forme(ou, faute);
      }
      return { min, max };
    });
    const gabarit: TableDeGabarit = {
      bornes,
      legs: liste(g.legs, 'gabarit.legs'), arms: liste(g.arms, 'gabarit.arms'), head: liste(g.head, 'gabarit.head'),
      racine: chaine(g.racine, 'gabarit.racine'),
      st: { min: nombre(st.min, 'gabarit.st.min'), max: nombre(st.max, 'gabarit.st.max') },
    };
    if (estObjet(brut.gabarit) && estObjet(g.st) && !(gabarit.st.min < FACTEURS_NEUTRES.st && gabarit.st.max > FACTEURS_NEUTRES.st)) forme('gabarit.st', `bornes ${gabarit.st.min} et ${gabarit.st.max} : min < ${FACTEURS_NEUTRES.st} < max attendu`);
    const clesParOs = new Map<string, string>();
    for (const cle of CLES_DU_GABARIT) {
      for (const nom of gabarit[cle]) {
        const precedente = clesParOs.get(nom);
        if (precedente !== undefined && precedente !== cle) forme(`gabarit.${cle}`, `${nom} figure sous ${precedente} et ${cle}`);
        clesParOs.set(nom, cle);
      }
    }
    return gabarit;
  };
  const gabarit = brut.gabarit === undefined ? undefined : lireGabarit();
  const p = objet(brut.porteur, 'porteur');
  if (estObjet(brut.porteur) && (p.gabarit === undefined) !== (gabarit === undefined)) forme('porteur.gabarit', gabarit ? 'le porteur d’un corps à gabarit nomme son gabarit' : 'un corps sans table de gabarit n’a pas de gabarit de porteur');
  const porteur: PorteurDeReference = {
    espece: id(p.espece, 'porteur.espece'),
    ...(p.gabarit === undefined ? {} : { gabarit: id(p.gabarit, 'porteur.gabarit') }),
    taille: id(p.taille, 'porteur.taille'), echelleDArt: positif(p.echelleDArt, 'porteur.echelleDArt'),
  };
  const clips = Object.fromEntries(Object.entries(objet(brut.clips, 'clips')).map(([role, nom]) => [role, chaine(nom, `clips.${role}`)]));
  if (estObjet(brut.clips) && clips.walk === undefined) forme('clips.walk', 'le clip du rôle `walk` est exigé');
  const clipsDeuxMains = brut.clipsDeuxMains === undefined ? undefined
    : Object.fromEntries(Object.entries(objet(brut.clipsDeuxMains, 'clipsDeuxMains')).map(([maniement, table]) => {
      const ou = `clipsDeuxMains.${maniement}`;
      return [maniement, Object.fromEntries(Object.entries(objet(table, ou)).map(([role, nom]) => [role, chaine(nom, `${ou}.${role}`)]))];
    }));
  const a = objet(brut.appuis, 'appuis');
  for (const cle of Object.keys(a)) if (!['pieds', 'plusBas', 'vitesseAuSol'].includes(cle)) forme(`appuis.${cle}`, 'champ inconnu');
  const triplet = (v: unknown, ou: string): readonly [number, number, number] => {
    if (!estTriplet(v) || !v.every(Number.isFinite)) { forme(ou, 'triplet de nombres finis attendu'); return [0, 0, 0]; }
    return v;
  };
  if (!Array.isArray(a.plusBas) || !a.plusBas.length) forme('appuis.plusBas', 'liste non vide de candidats attendue');
  const plusBas: CandidatDAppui[] = (Array.isArray(a.plusBas) ? a.plusBas : []).map((v: unknown, i: number) => {
    const ou = `appuis.plusBas.${i}`, c = objet(v, ou);
    for (const cle of Object.keys(c)) if (!['position', 'os', 'deltas'].includes(cle)) forme(`${ou}.${cle}`, 'champ inconnu');
    if (!Array.isArray(c.os) || !c.os.length || c.os.length > 4) forme(`${ou}.os`, 'une à quatre influences attendues');
    const influences = (Array.isArray(c.os) ? c.os : []).map((v: unknown, j: number) => {
      const chemin = `${ou}.os.${j}`, influence = objet(v, chemin);
      for (const cle of Object.keys(influence)) if (!['nom', 'poids'].includes(cle)) forme(`${chemin}.${cle}`, 'champ inconnu');
      return { nom: id(influence.nom, `${chemin}.nom`), poids: positif(influence.poids, `${chemin}.poids`) };
    });
    if (Math.abs(influences.reduce((s, p) => s + p.poids, 0) - 1) > 1e-6) forme(`${ou}.os`, 'somme des poids égale à 1 attendue');
    if (new Set(influences.map((p) => p.nom)).size !== influences.length) forme(`${ou}.os`, 'os distincts attendus');
    const deltas = Object.fromEntries(Object.entries(objet(c.deltas, `${ou}.deltas`)).map(([nom, delta]) => [nom, triplet(delta, `${ou}.deltas.${nom}`)]));
    return { position: triplet(c.position, `${ou}.position`), os: influences, deltas };
  });
  const appuis: Appuis = {
    pieds: liste(a.pieds, 'appuis.pieds'),
    plusBas,
    vitesseAuSol: positif(a.vitesseAuSol, 'appuis.vitesseAuSol'),
  };
  if (estObjet(brut.appuis) && estListeDeChaines(a.pieds) && !appuis.pieds.length) forme('appuis.pieds', 'au moins un pied attendu');
  const osAPositionAnimee = liste(brut.osAPositionAnimee, 'osAPositionAnimee');
  const lues = brut.surfaces === undefined ? undefined : lireSurfaces(brut.surfaces, false);
  ecarts.push(...(lues?.ecarts ?? []));
  const glb = objet(brut.glb, 'glb');
  const empreinte = { sha256: chaine(glb.sha256, 'glb.sha256'), octets: nombre(glb.octets, 'glb.octets') };
  if (ecarts.length || (prisesBrutes && (!prises.main || !prises.off))) return { ecarts };
  return { ecarts, manifeste: { schema: VERSION_DU_SCHEMA_DE_BASE, base, os, chaines, zones, emplacements, ...(prises.main && prises.off ? { prises: { main: prises.main, off: prises.off } } : {}), silhouettes, ...(gabarit ? { gabarit } : {}), porteur, clips: { ...clips, walk: clips.walk }, ...(clipsDeuxMains ? { clipsDeuxMains } : {}), appuis, osAPositionAnimee, ...(lues ? { surfaces: lues.surfaces } : {}), glb: empreinte } };
}

/** Le manifeste `brut` réduit au schéma 5 et validé contre le GLB de la base `octets`. */
export function validerManifesteDeBase(brut: unknown, octets: Uint8Array): VerdictDeBase {
  const { manifeste: m, ecarts } = reduire(brut);
  if (!m) return { ok: false, ecarts };
  const contenu = lireGlb(octets);
  const refus = (code: CodeDEcartDeBase, ou: string, detail: string) => ecarts.push({ code, ou, detail });
  const declares = new Set(m.os);
  m.os.forEach((o, i) => { if (!contenu.os.has(o)) refus('os-inconnu', `os.${i}`, `${o} n’est pas un os du GLB`); });
  const { gabarit, prises } = m;
  const osNommes: [string, string][] = [
    ...(gabarit ? [['gabarit.racine', gabarit.racine] as [string, string], ...CLES_DU_GABARIT.flatMap((cle) => gabarit[cle].map((o, i): [string, string] => [`gabarit.${cle}.${i}`, o]))] : []),
    ...m.appuis.pieds.map((o, i): [string, string] => [`appuis.pieds.${i}`, o]),
    ...m.appuis.plusBas.flatMap((c, i) => c.os.map((o, j): [string, string] => [`appuis.plusBas.${i}.os.${j}.nom`, o.nom])),
    ...m.osAPositionAnimee.map((o, i): [string, string] => [`osAPositionAnimee.${i}`, o]),
  ];
  for (const [ou, o] of osNommes) if (!declares.has(o)) refus('os-inconnu', ou, `${o} n’est pas un os déclaré`);
  for (const [id, c] of Object.entries(m.chaines)) c.forEach((o, i) => { if (!declares.has(o) || !contenu.os.has(o)) refus('chaine-sur-os-absent', `chaines.${id}.${i}`, o); });
  for (const z of m.zones) if (!contenu.zones.has(z)) refus('zone-sans-mesh', `zones`, `aucun mesh du GLB ne porte \`extras.zone = ${z}\``);
  for (const [id, e] of Object.entries(m.emplacements)) if (!declares.has(e.os) || !contenu.os.has(e.os)) refus('emplacement-sur-os-absent', `emplacements.${id}.os`, e.os);
  if (prises) for (const cle of ['main', 'off'] as const) if (!declares.has(prises[cle].os) || !contenu.os.has(prises[cle].os)) refus('prise-absente', `prises.${cle}.os`, `${prises[cle].os} n’est pas un os de la base`);
  for (const s of m.silhouettes) {
    if (!estSilhouette(s)) refus('silhouette-inconnue', 'silhouettes', `${s} n’est pas une silhouette du gabarit`);
    if (!contenu.formes.has(s)) refus('silhouette-absente', 'silhouettes', `${s} n’est pas une shape key du GLB`);
  }
  for (const [i, c] of m.appuis.plusBas.entries()) for (const nom of Object.keys(c.deltas)) {
    if (!contenu.formes.has(nom) || (!m.silhouettes.includes(nom) && !(gabarit && nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT)))) refus('forme', `appuis.plusBas.${i}.deltas.${nom}`, 'clé absente ou hors silhouettes et gabarit');
  }
  for (const e of ecartsAuGlb(m.surfaces ?? [], contenu)) refus(e.code, e.ou, e.detail);
  const somme = sha256(octets);
  if (m.glb.sha256 !== somme || m.glb.octets !== octets.byteLength) refus('glb-different', 'glb', `GLB de ${octets.byteLength} octets, SHA-256 ${somme} ; déclaré ${m.glb.octets} octets, ${m.glb.sha256}`);
  return ecarts.length ? { ok: false, ecarts } : { ok: true, manifeste: m };
}
