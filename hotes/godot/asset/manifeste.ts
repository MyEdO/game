/**
 * LE MANIFESTE COMMITÉ D'UN PERSONNAGE 3D MODULAIRE (#2948, commentaire « Design jugé et découpage — 2026-10-23 ») : les
 * seules clés que l'hôte consomme, réduites du manifeste de production, et leur validation contre le GLB (`glb.ts`).
 * Les exclusions de pièces ont une source, `incompatibilities` : chaque groupe porte des composants dont un seul se
 * montre à la fois.
 */
import type { ContenuGlb } from './glb.ts';
import { lireMontage, ecartsDeMontage, type ManifesteMontable } from './montage';
import { findApparenceById, ROLES_D_ANIMATION, type RoleDAnimation } from '../../../src/noyau/index.ts';

export const VERSION_DU_SCHEMA = 2;

export interface PieceDuManifeste {
  readonly node: string;
  readonly component: string;
  readonly headVariant: string | null;
  readonly hiddenBy: readonly string[];
}

export interface ManifesteDePersonnage {
  readonly schema_version: typeof VERSION_DU_SCHEMA;
  readonly model: string;
  /** `null` si et seulement si `head_options` est vide : un personnage sans tête interchangeable. */
  readonly default_head: string | null;
  readonly head_options: readonly { readonly id: string }[];
  readonly pieces: Readonly<Record<string, PieceDuManifeste>>;
  /** `apparence` : id du catalogue d’objets, ou `null` pour un composant corporel sans apparence d’objet. */
  readonly components: Readonly<Record<string, { readonly label_fr: string; readonly apparence: string | null }>>;
  readonly incompatibilities: readonly (readonly string[])[];
  readonly defaults: readonly string[];
  readonly presets: Readonly<Record<string, { readonly components: readonly string[] }>>;
  readonly clips: Readonly<Partial<Record<RoleDAnimation, string>>>;
}

/** Les refus du validateur, chacun nommé. */
export type CodeDErreur =
  | 'forme'
  | 'version-inconnue'
  | 'tete-inconnue'
  | 'composant-inconnu'
  | 'apparence-inconnue'
  | 'variante-inconnue'
  | 'masque-inconnu'
  | 'incompatibilite-inconnue'
  | 'defaut-inconnu'
  | 'preset-inconnu'
  | 'role-inconnu'
  | 'noeud-absent'
  | 'clip-absent'
  | 'os-absent'
  | 'piece-non-rigide'
  | 'attache-incompatible'
  | 'matiere-absente'
  | 'matiere-ambigue'
  | 'chemin-absolu';

export interface ErreurDeManifeste {
  readonly code: CodeDErreur;
  readonly ou: string;
  readonly detail: string;
}

export type Verdict = { readonly ok: true; readonly manifeste: ManifesteMontable } | { readonly ok: false; readonly erreurs: readonly ErreurDeManifeste[] };

/** Un lecteur Windows, un partage UNC ou `~` après un séparateur ; une racine POSIX en tête de chaîne, ou après un
 *  séparateur suivie d'au moins un segment et d'une barre : « Épée / bouclier » n'en est pas une. */
const CHEMIN_ABSOLU = /(?:^|[\s"'(=,;])(?:[A-Za-z]:[\\/]|\\\\|~[\\/])|^\/(?!\/)\S|[\s"'(=,;]\/[^\s/]+\//;

/** Les chaînes (clés comprises) de `valeur` qui ressemblent à un chemin absolu Windows ou POSIX. */
export function cheminsAbsolus(valeur: unknown, ou = ''): ErreurDeManifeste[] {
  if (typeof valeur === 'string') return CHEMIN_ABSOLU.test(valeur) ? [{ code: 'chemin-absolu', ou, detail: valeur }] : [];
  if (!valeur || typeof valeur !== 'object') return [];
  return Object.entries(valeur).flatMap(([cle, v]) => {
    const ici = ou ? `${ou}.${cle}` : cle;
    return [...(Array.isArray(valeur) ? [] : cheminsAbsolus(cle, ici)), ...cheminsAbsolus(v, ici)];
  });
}

/** Un objet JSON brut, avant réduction. */
export type Brut = Record<string, unknown>;
export const estObjet = (v: unknown): v is Brut => !!v && typeof v === 'object' && !Array.isArray(v);
const estListeDeChaines = (v: unknown): v is string[] => Array.isArray(v) && v.every((e) => typeof e === 'string');

/** La réduction de `brut` aux clés du schéma, ou les écarts de forme qui l'empêchent. */
function reduire(brut: unknown): { manifeste?: ManifesteDePersonnage; erreurs: ErreurDeManifeste[] } {
  const erreurs: ErreurDeManifeste[] = [];
  const forme = (ou: string, detail: string) => erreurs.push({ code: 'forme', ou, detail });
  if (!estObjet(brut)) return { erreurs: [{ code: 'forme', ou: '', detail: 'le manifeste n’est pas un objet' }] };
  const chaine = (cle: string): string => {
    const v = brut[cle];
    if (typeof v !== 'string') forme(cle, 'chaîne attendue');
    return typeof v === 'string' ? v : '';
  };
  const objet = (cle: string): Brut => {
    const v = brut[cle];
    if (!estObjet(v)) forme(cle, 'objet attendu');
    return estObjet(v) ? v : {};
  };
  const liste = (v: unknown, ou: string): string[] => {
    if (!estListeDeChaines(v)) forme(ou, 'liste de chaînes attendue');
    return estListeDeChaines(v) ? v : [];
  };

  if (brut.schema_version !== VERSION_DU_SCHEMA) erreurs.push({ code: 'version-inconnue', ou: 'schema_version', detail: `${String(brut.schema_version)}, ${VERSION_DU_SCHEMA} attendue` });
  const model = chaine('model');
  const default_head = brut.default_head === null || typeof brut.default_head === 'string' ? brut.default_head : null;
  if (default_head !== brut.default_head) forme('default_head', 'chaîne ou null attendu');
  const tetes = Array.isArray(brut.head_options) ? brut.head_options : [];
  if (!Array.isArray(brut.head_options)) forme('head_options', 'liste attendue');
  const head_options = tetes.flatMap((t, i) => {
    if (estObjet(t) && typeof t.id === 'string') return [{ id: t.id }];
    forme(`head_options.${i}`, 'objet à `id` chaîne attendu');
    return [];
  });
  const pieces = Object.fromEntries(Object.entries(objet('pieces')).flatMap(([cle, p]) => {
    const ou = `pieces.${cle}`;
    if (!estObjet(p) || typeof p.node !== 'string' || typeof p.component !== 'string' || !(p.headVariant === null || typeof p.headVariant === 'string')) {
      forme(ou, '`node` et `component` chaînes, `headVariant` chaîne ou null attendus');
      return [];
    }
    return [[cle, { node: p.node, component: p.component, headVariant: p.headVariant, hiddenBy: liste(p.hiddenBy, `${ou}.hiddenBy`) }]];
  }));
  const components = Object.fromEntries(Object.entries(objet('components')).flatMap(([cle, c]) => {
    if (estObjet(c) && typeof c.label_fr === 'string' && (c.apparence === null || typeof c.apparence === 'string')) return [[cle, { label_fr: c.label_fr, apparence: c.apparence }]];
    forme(`components.${cle}`, '`label_fr` chaîne et `apparence` chaîne ou null attendus');
    return [];
  }));
  const groupes = Array.isArray(brut.incompatibilities) ? brut.incompatibilities : [];
  if (!Array.isArray(brut.incompatibilities)) forme('incompatibilities', 'liste attendue');
  const incompatibilities = groupes.map((g, i) => liste(g, `incompatibilities.${i}`));
  const defaults = liste(brut.defaults, 'defaults');
  const presets = Object.fromEntries(Object.entries(objet('presets')).map(([cle, p]) => [cle, { components: liste(estObjet(p) ? p.components : undefined, `presets.${cle}.components`) }]));
  const clips = Object.fromEntries(Object.entries(objet('clips')).flatMap(([role, nom]) => {
    if (typeof nom === 'string') return [[role, nom]];
    forme(`clips.${role}`, 'nom d’animation chaîne attendu');
    return [];
  }));
  if (erreurs.length) return { erreurs };
  return {
    erreurs,
    manifeste: { schema_version: VERSION_DU_SCHEMA, model, default_head, head_options, pieces, components, incompatibilities, defaults, presets, clips },
  };
}

/** Les apparences d’objet que le catalogue du noyau ne désigne pas. */
function ecartsDApparence(m: ManifesteDePersonnage): ErreurDeManifeste[] {
  return Object.entries(m.components).flatMap<ErreurDeManifeste>(([cle, c]) =>
    c.apparence === null || findApparenceById(c.apparence) ? [] : [{ code: 'apparence-inconnue', ou: `components.${cle}.apparence`, detail: c.apparence }]);
}

/** Les écarts référentiels de `m`, et ses écarts au GLB `glb`. */
function ecarts(m: ManifesteDePersonnage, glb: ContenuGlb): ErreurDeManifeste[] {
  const erreurs = ecartsDApparence(m);
  const refus = (code: CodeDErreur, ou: string, detail: string) => erreurs.push({ code, ou, detail });
  const composants = new Set(Object.keys(m.components));
  const tetes = new Set(m.head_options.map((t) => t.id));
  if (m.default_head === null ? tetes.size > 0 : !tetes.has(m.default_head)) refus('tete-inconnue', 'default_head', `${String(m.default_head)}, têtes déclarées : ${[...tetes].join(', ') || 'aucune'}`);
  for (const [cle, p] of Object.entries(m.pieces)) {
    const ou = `pieces.${cle}`;
    if (!composants.has(p.component) && !tetes.has(p.component)) refus('composant-inconnu', `${ou}.component`, p.component);
    if (p.headVariant !== null && !tetes.has(p.headVariant)) refus('variante-inconnue', `${ou}.headVariant`, p.headVariant);
    p.hiddenBy.filter((c) => !composants.has(c)).forEach((c) => refus('masque-inconnu', `${ou}.hiddenBy`, c));
    if (!glb.noeuds.has(p.node)) refus('noeud-absent', `${ou}.node`, p.node);
  }
  m.incompatibilities.forEach((g, i) => g.filter((c) => !composants.has(c)).forEach((c) => refus('incompatibilite-inconnue', `incompatibilities.${i}`, c)));
  m.defaults.filter((c) => !composants.has(c)).forEach((c) => refus('defaut-inconnu', 'defaults', c));
  for (const [cle, p] of Object.entries(m.presets)) p.components.filter((c) => !composants.has(c)).forEach((c) => refus('preset-inconnu', `presets.${cle}.components`, c));
  const roles = new Set<string>(ROLES_D_ANIMATION);
  for (const [role, nom] of Object.entries(m.clips)) {
    if (!roles.has(role)) refus('role-inconnu', `clips.${role}`, role);
    if (!glb.animations.has(nom)) refus('clip-absent', `clips.${role}`, nom);
  }
  return [...erreurs, ...cheminsAbsolus(m)];
}

/** Le manifeste `brut` réduit aux clés du schéma et validé contre le GLB `glb`. */
export function validerManifeste(brut: unknown, glb: ContenuGlb): Verdict {
  const { manifeste, erreurs } = reduire(brut);
  if (!manifeste) return { ok: false, erreurs };
  const montage = lireMontage(estObjet(brut) ? brut.montage : undefined);
  if (!montage.montage) return { ok: false, erreurs: montage.erreurs };
  const montable: ManifesteMontable = { ...manifeste, montage: montage.montage };
  const refus = [...ecarts(montable, glb), ...ecartsDeMontage(montable, glb)];
  return refus.length ? { ok: false, erreurs: refus } : { ok: true, manifeste: montable };
}

/** Une erreur de manifeste en une ligne. */
export const ligneDErreur = (e: ErreurDeManifeste): string => `[${e.code}] ${e.ou || '(racine)'} : ${e.detail}`;
