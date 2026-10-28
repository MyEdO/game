/**
 * LE MANIFESTE D'UNE BASE HUMANOÏDE (#2972, schéma 3) : son squelette, ses chaînes d'appendice, ses zones, ses
 * emplacements, ses prises, ses shape keys, la table du gabarit, son porteur de référence, ses appuis et ses os à
 * position animée, validés contre le GLB livré (`lireGlb`, `glb.ts`). Les ids de `porteur` ne se lisent pas ici :
 * l'évaluateur est hors du graphe de l'hôte (`charger.mjs`, `chargerEvaluateur`).
 */
import { sha256 } from '../empreinte.ts';
import { lireGlb } from '../glb.ts';

export const VERSION_DU_SCHEMA_DE_BASE = 3;

/** Un point d'attache sur un os : position et rotation (radians, XYZ) dans le repère de l'os. */
export interface Attache {
  readonly os: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}

export interface TableDeGabarit {
  readonly legs: readonly string[];
  readonly arms: readonly string[];
  readonly head: readonly string[];
  readonly racine: string;
  /** Les bornes de `st` : `carrure_moins` atteint 1 à `min`, `carrure_plus` atteint 1 à `max`. */
  readonly st: { readonly min: number; readonly max: number };
}

/** Le porteur de la planche du corps : race, gabarit et Taille par id, à l'échelle d'art `echelleDArt`. */
export interface PorteurDeReference {
  readonly race: string;
  readonly gabarit: string;
  readonly taille: string;
  readonly echelleDArt: number;
}

/** Les os des pieds, sur lesquels l'évaluateur mesure les appuis, et la vitesse au sol du clip `walk` en m/s, à la
 *  taille de construction. */
export interface Appuis {
  readonly pieds: readonly string[];
  readonly vitesseAuSol: number;
}

export interface ManifesteDeBase {
  readonly schema: typeof VERSION_DU_SCHEMA_DE_BASE;
  readonly base: string;
  readonly os: readonly string[];
  readonly chaines: Readonly<Record<string, readonly string[]>>;
  readonly zones: readonly string[];
  readonly emplacements: Readonly<Record<string, Attache>>;
  readonly prises: { readonly main: Attache; readonly off: Attache };
  readonly silhouettes: readonly string[];
  readonly gabarit: TableDeGabarit;
  readonly porteur: PorteurDeReference;
  readonly appuis: Appuis;
  /** Les os, hors racine, dont un clip anime la position (`gardePistesDEchelle`). */
  readonly osAPositionAnimee: readonly string[];
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
  | 'glb-different';

export interface EcartDeBase {
  readonly code: CodeDEcartDeBase;
  readonly ou: string;
  readonly detail: string;
}

export type VerdictDeBase = { readonly ok: true; readonly manifeste: ManifesteDeBase } | { readonly ok: false; readonly ecarts: readonly EcartDeBase[] };

type Brut = Record<string, unknown>;
const estObjet = (v: unknown): v is Brut => !!v && typeof v === 'object' && !Array.isArray(v);
const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((e) => typeof e === 'string');
const estTriplet = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((e) => typeof e === 'number' && Number.isFinite(e));

/** La réduction de `brut` au schéma 3, ou ses écarts de forme. */
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
  const prisesBrutes = objet(brut.prises, 'prises');
  const prises: Partial<Record<'main' | 'off', Attache>> = {};
  for (const cle of ['main', 'off'] as const) {
    if (prisesBrutes[cle] === undefined) ecarts.push({ code: 'prise-absente', ou: `prises.${cle}`, detail: `la prise \`${cle}\` n’est pas déclarée` });
    else prises[cle] = attache(prisesBrutes[cle], `prises.${cle}`) ?? undefined;
  }
  const silhouettes = liste(brut.silhouettes, 'silhouettes');
  const g = objet(brut.gabarit, 'gabarit');
  const st = objet(g.st, 'gabarit.st');
  const gabarit: TableDeGabarit = {
    legs: liste(g.legs, 'gabarit.legs'), arms: liste(g.arms, 'gabarit.arms'), head: liste(g.head, 'gabarit.head'),
    racine: chaine(g.racine, 'gabarit.racine'),
    st: { min: nombre(st.min, 'gabarit.st.min'), max: nombre(st.max, 'gabarit.st.max') },
  };
  if (estObjet(brut.gabarit) && estObjet(g.st) && !(gabarit.st.min < 1 && gabarit.st.max > 1)) forme('gabarit.st', `bornes ${gabarit.st.min} et ${gabarit.st.max} : min < 1 < max attendu`);
  const p = objet(brut.porteur, 'porteur');
  const porteur: PorteurDeReference = { race: id(p.race, 'porteur.race'), gabarit: id(p.gabarit, 'porteur.gabarit'), taille: id(p.taille, 'porteur.taille'), echelleDArt: positif(p.echelleDArt, 'porteur.echelleDArt') };
  const a = objet(brut.appuis, 'appuis');
  const appuis: Appuis = { pieds: liste(a.pieds, 'appuis.pieds'), vitesseAuSol: positif(a.vitesseAuSol, 'appuis.vitesseAuSol') };
  if (estObjet(brut.appuis) && estListeDeChaines(a.pieds) && !appuis.pieds.length) forme('appuis.pieds', 'au moins un pied attendu');
  const osAPositionAnimee = liste(brut.osAPositionAnimee, 'osAPositionAnimee');
  const glb = objet(brut.glb, 'glb');
  const empreinte = { sha256: chaine(glb.sha256, 'glb.sha256'), octets: nombre(glb.octets, 'glb.octets') };
  if (ecarts.length || !prises.main || !prises.off) return { ecarts };
  return { ecarts, manifeste: { schema: VERSION_DU_SCHEMA_DE_BASE, base, os, chaines, zones, emplacements, prises: { main: prises.main, off: prises.off }, silhouettes, gabarit, porteur, appuis, osAPositionAnimee, glb: empreinte } };
}

/** Le manifeste `brut` réduit au schéma 3 et validé contre le GLB de la base `octets`. */
export function validerManifesteDeBase(brut: unknown, octets: Uint8Array): VerdictDeBase {
  const { manifeste: m, ecarts } = reduire(brut);
  if (!m) return { ok: false, ecarts };
  const contenu = lireGlb(octets);
  const refus = (code: CodeDEcartDeBase, ou: string, detail: string) => ecarts.push({ code, ou, detail });
  const declares = new Set(m.os);
  m.os.forEach((o, i) => { if (!contenu.os.has(o)) refus('os-inconnu', `os.${i}`, `${o} n’est pas un os du GLB`); });
  const osNommes: [string, string][] = [
    ['gabarit.racine', m.gabarit.racine],
    ...(['legs', 'arms', 'head'] as const).flatMap((cle) => m.gabarit[cle].map((o, i): [string, string] => [`gabarit.${cle}.${i}`, o])),
    ...m.appuis.pieds.map((o, i): [string, string] => [`appuis.pieds.${i}`, o]),
    ...m.osAPositionAnimee.map((o, i): [string, string] => [`osAPositionAnimee.${i}`, o]),
  ];
  for (const [ou, o] of osNommes) if (!declares.has(o)) refus('os-inconnu', ou, `${o} n’est pas un os déclaré`);
  for (const [id, c] of Object.entries(m.chaines)) c.forEach((o, i) => { if (!declares.has(o) || !contenu.os.has(o)) refus('chaine-sur-os-absent', `chaines.${id}.${i}`, o); });
  for (const z of m.zones) if (!contenu.zones.has(z)) refus('zone-sans-mesh', `zones`, `aucun mesh du GLB ne porte \`extras.zone = ${z}\``);
  for (const [id, e] of Object.entries(m.emplacements)) if (!declares.has(e.os) || !contenu.os.has(e.os)) refus('emplacement-sur-os-absent', `emplacements.${id}.os`, e.os);
  for (const cle of ['main', 'off'] as const) if (!declares.has(m.prises[cle].os) || !contenu.os.has(m.prises[cle].os)) refus('prise-absente', `prises.${cle}.os`, `${m.prises[cle].os} n’est pas un os de la base`);
  for (const s of m.silhouettes) if (!contenu.formes.has(s)) refus('silhouette-absente', 'silhouettes', `${s} n’est pas une shape key du GLB`);
  const somme = sha256(octets);
  if (m.glb.sha256 !== somme || m.glb.octets !== octets.byteLength) refus('glb-different', 'glb', `GLB de ${octets.byteLength} octets, SHA-256 ${somme} ; déclaré ${m.glb.octets} octets, ${m.glb.sha256}`);
  return ecarts.length ? { ok: false, ecarts } : { ok: true, manifeste: m };
}
