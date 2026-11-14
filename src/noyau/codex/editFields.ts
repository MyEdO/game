/**
 * Inférence de formulaire DEPUIS la donnée (pas de schéma par dataset → un nouveau dataset s'édite
 * tout seul). Métadonnées de RENDU uniquement : décrit comment afficher un champ, sans introduire de
 * structure intermédiaire — on édite les vrais objets de `src/data`. Consommé par `CodexEdit` et par le
 * formulaire de l'éditeur de carte (`formulaireDe`, `noyau/sceneEditLecture.ts`), qui y lit aussi les variantes d'une
 * union (`unionDuNoeud`) et l'élément d'une liste (`elementDuNoeud`).
 */
import { LIBELLES_ENVELOPPE, type CleEnveloppe } from '../../data/schemas/grammaire/document';
import { derouleEnum, libelleDeValeur, metaDesChamps, nomDeNoeud, valeursDe, type MetaChamp } from '../../data/schemas/grammaire/meta';
import { adresseUnPassage } from '../../data/schemas/grammaire/valeurs';
import { declarationDEnfants, defDe, enfantsDe, ouverts, pasDeDonnee, valeursAdmises } from '../../data/schemas/grammaire/descente';
import { aLaFormeDe, declarationDeFeuilleDId, estRefEmboitee, porteeDeLaFeuille } from '../../data/schemas/grammaire/ref';
import { declarationProseNommee } from '../../data/schemas/grammaire/prose';
import { OP_LABEL, OPS_NON_TYPEES } from '../../data/schemas/grammaire/mecanique';
import { choixDeLaFeuilleDId, datasetDeLEspaceDuType } from '../../data';
import type { GameOp } from '../../engine/ops';
import { libelleDuLitteral } from '../libelles';
import { estObjet } from '../../lib/objet.mjs';
import type { SourceDeLEdition } from '../edition/adresseDeProse';

export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'stringList' | 'numberList' | 'source' | 'descRef' | 'recordNumber' | 'recordText' | 'object' | 'json' | 'select' | 'selectList';

export interface FieldDesc {
  key: string;
  /** Libellé FR affiché (`libelleDuChamp`) — AFFICHAGE seul : `key` reste l'identité du champ. */
  label: string;
  kind: FieldKind;
  /** Le champ se VIDE : son nœud admet l'absence (`absenceDuNoeud`) ; sans nœud, il est null/absent sur
   *  au moins une entrée. */
  nullable: boolean;
  /** Valeurs NOMMÉES d'un champ ÉNUMÉRÉ (`kind: 'select'`, ou `'selectList'` pour une LISTE de valeurs de
   *  l'enum) — `valeur → libellé FR`, lues SUR LE NŒUD. */
  valeurs?: Readonly<Record<string, string>>;
  /** NŒUD zod du champ, quand l'appelant en tient un — ce que le sous-formulaire redescend pour
   *  retrouver les libellés de valeurs de SES propres champs (#1694). */
  noeud?: unknown;
  /** Valeur POSÉE par le def (littéral d'enveloppe) : elle s'AFFICHE, elle ne se saisit pas. */
  fige?: boolean;
  /** Bornes d'un champ `number` lues sur son nœud (`bornesDuNoeud`). */
  bornes?: BornesDuNombre;
  /** Le CONTEXTE du porteur du formulaire où vit ce champ (`formulaireDe`, `noyau/sceneEditLecture.ts`) : ce qu'il offre
   *  sous lui, et ses choix ; d'un record, les clés qu'il offre (`champsDuRecord`). */
  contexte?: ContexteDuChamp;
}

/** Un choix que le contexte d'un porteur pose : la valeur qu'il écrit, son libellé, et pourquoi il est refusé (`null` :
 *  admis). */
export interface ChoixDuContexte { valeur: unknown; libelle: string; refus: string | null }

/** Le contexte du porteur d'un formulaire, à un chemin de sa donnée : le chemin est-il offert (`cheminOffert`), s'y
 *  écrit-il entier, retrait compris, là où la donnée vaut `actuelle` (`ecritureOfferte`), et les choix qu'il y pose, dans
 *  leur ordre (`choixDuChamp`), qui priment sur ceux du nœud (`choixDuNoeud`, `variantesAChoisir`) ; `undefined` : ceux
 *  du nœud. */
export interface ContexteDuChamp {
  offert: (chemin: readonly (string | number)[]) => boolean;
  ecrivable: (chemin: readonly (string | number)[], actuelle: unknown) => boolean;
  choix: (chemin: readonly (string | number)[]) => readonly ChoixDuContexte[] | undefined;
  /** Le `Source/` que désignent les adresses de prose du porteur. */
  source: SourceDeLEdition;
}

/** Ce qu'un nœud NOMBRE admet : un entier ou non, entre sa borne basse et sa borne haute (`null` : sans borne). */
export interface BornesDuNombre { entier: boolean; min: number | null; max: number | null }

/** Une valeur d'un champ à choix, et son libellé. */
export interface ValeurDuChoix { valeur: string | number | boolean; libelle: string }

function kindOf(key: string, v: unknown): FieldKind {
  // `source` = composite {book,page} SEULEMENT quand la donnée l'est réellement — un `source` MAISON
  // (littéral string, ex. `axes.json` #409, aucune page RAW à citer) retombe sur l'inférence générique
  // (chaîne courte) plutôt que le widget livre/page (qui écraserait la valeur par un objet au 1er edit).
  if (key === 'source' && v != null && typeof v === 'object') return 'source';
  if (key === 'desc') return 'textarea';
  // `descRef` = ADRESSE d'un passage du `Source/` (#1389) : livre/chapitre/section/fragments, avec une
  // empreinte que l'auteur ne saisit JAMAIS. L'inférence générique en ferait un sous-formulaire d'objet.
  if (key === 'descRef') return 'descRef';
  if (typeof v === 'string') return v.length > 80 ? 'textarea' : 'text';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'checkbox';
  // Tableau d'objets = json (un éditeur dédié le sort du repli ; chaînes = stringList, nombres = numberList).
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return 'stringList';
    if (v.every((x) => typeof x === 'number')) return 'numberList';
    return 'json';
  }
  if (v && typeof v === 'object') {
    if ('book' in (v as object) && 'page' in (v as object)) return 'source';
    const vals = Object.values(v as Record<string, unknown>);
    // Record homogène : valeurs toutes nombres → grille de nombres ; toutes chaînes → grille de textes.
    if (vals.length > 0 && vals.every((x) => typeof x === 'number' || x === null)) return 'recordNumber';
    if (vals.length > 0 && vals.every((x) => typeof x === 'string')) return 'recordText';
    // Objet de config hétérogène (ex. interludeEvents.fx) → sous-formulaire inféré
    // (récursif) plutôt que JSON brut — chaque sous-champ retrouve son kind structuré.
    return 'object';
  }
  return 'text';
}

const SANS_FORME = Symbol('sans forme');

/** Un nœud de la fermeture `ouverts` qui ne porte aucune forme de valeur à lui seul : enveloppe,
 *  union, intersection, `lazy`, `pipe` (ses enfants transparents la portent), ou `transform`. */
export const estTransparent = (noeud: unknown): boolean =>
  defDe(noeud)?.type === 'transform' || enfantsDe(noeud).some((e) => e.segment === '' || e.segment.startsWith('|') || e.segment.startsWith('&'));

/** Échantillon d'une forme CONCRÈTE de la fermeture : la valeur dont `kindOf` tire le kind. */
function echantillonDeForme(noeud: unknown): unknown {
  const def = defDe(noeud);
  const enfant = (segment: string) => enfantsDe(noeud).find((e) => e.segment === segment)?.noeud;
  switch (def?.type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'enum': return Object.values(def.entries ?? {})[0] ?? SANS_FORME;
    case 'literal': return (def.values as unknown[] | undefined)?.find((v) => v != null) ?? SANS_FORME;
    case 'object': return {};
    case 'record': {
      const v = echantillonDu('', enfant('{}'));
      return v === SANS_FORME ? {} : { '': v };
    }
    case 'array': {
      const e = echantillonDu('', enfant('[]'));
      return [e === SANS_FORME ? {} : e];
    }
    default: return SANS_FORME;
  }
}

/** Échantillon de la valeur qu'admet `noeud`, lu sur sa fermeture canonique (`ouverts`) ; `SANS_FORME`
 *  quand ses formes concrètes ne partagent pas un même kind, ou qu'aucune n'a de contrôle typé. */
function echantillonDu(key: string, noeud: unknown): unknown {
  const echantillons = ouverts([noeud]).filter((n) => !estTransparent(n)).map(echantillonDeForme);
  if (!echantillons.length || echantillons.includes(SANS_FORME)) return SANS_FORME;
  return new Set(echantillons.map((e) => kindOf(key, e))).size === 1 ? echantillons[0] : SANS_FORME;
}

/** Kind d'un champ DÉCLARÉ qu'aucun échantillon ne porte : celui que `kindOf` donne à un échantillon de
 *  son nœud ; `json` quand le nœud n'en a pas. */
export function kindDuNoeud(key: string, noeud: unknown): FieldKind {
  const e = echantillonDu(key, noeud);
  return e === SANS_FORME ? 'json' : kindOf(key, e);
}

/** La seule forme concrète de la fermeture `ouverts` du nœud ; `undefined` quand elle en a plusieurs ou aucune. */
function seuleForme(noeud: unknown): unknown {
  const formes = ouverts([noeud]).filter((n) => !estTransparent(n));
  return formes.length === 1 ? formes[0] : undefined;
}

/** Les bornes du nœud quand sa seule forme est un nombre ; `undefined` sinon. */
export function bornesDuNoeud(noeud: unknown): BornesDuNombre | undefined {
  const n = seuleForme(noeud);
  if (defDe(n)?.type !== 'number') return undefined;
  const nombre = n as { isInt: boolean; minValue: number | null; maxValue: number | null };
  const borne = (v: number | null): number | null => (v !== null && Number.isFinite(v) ? v : null);
  return { entier: nombre.isInt, min: borne(nombre.minValue), max: borne(nombre.maxValue) };
}

/** Les bornes du nombre que le nœud admet parmi les formes de sa fermeture, quand la valeur `valeur` est ce nombre ou
 *  absente : l'Indice chiffré d'une formule (`formuleSansTirageSchema`) ; `undefined` sinon. */
export function bornesAuPoint(noeud: unknown, valeur: unknown): BornesDuNombre | undefined {
  if (valeur !== undefined && typeof valeur !== 'number') return undefined;
  const nombre = ouverts([noeud]).find((n) => defDe(n)?.type === 'number');
  return nombre === undefined ? undefined : bornesDuNoeud(nombre);
}

/** Les champs DÉCLARÉS du nœud quand sa seule forme est un objet, dans l'ordre de sa déclaration, chacun avec son
 *  nœud ; `undefined` sinon. */
export function champsDeclares(noeud: unknown): (readonly [string, unknown])[] | undefined {
  const n = seuleForme(noeud);
  if (defDe(n)?.type !== 'object') return undefined;
  return enfantsDe(n).flatMap((e) => (e.cle === undefined ? [] : [[e.cle, e.noeud] as const]));
}

/** Les valeurs d'un champ À CHOIX, chacune nommée, lues sur la fermeture de son nœud : la réunion, sans doublon, des
 *  entrées de chacune de ses références `idDe` fermées qu'un dataset porte, sa sous-liste comprise
 *  (`choixDeLaFeuilleDId`), et des valeurs de ses énumérations et littéraux membres ; sinon, de sa seule forme,
 *  les valeurs d'une énumération (`libelleDeValeur`), d'un littéral (`libelleDuLitteral`), faux et vrai d'un
 *  booléen ; `undefined` pour tout autre nœud. */
export function choixDuNoeud(noeud: unknown): ValeurDuChoix[] | undefined {
  const formes = ouverts([noeud]);
  const feuilles = formes.map(declarationDeFeuilleDId).filter((d) => d !== undefined && !d.portee && datasetDeLEspaceDuType(d.type) !== undefined);
  if (feuilles.length) {
    const vus = new Set<unknown>();
    const membres = formes.filter((n) => !estTransparent(n) && ['enum', 'literal'].includes(defDe(n)?.type ?? '')).flatMap((n) => choixDuNoeud(n) ?? []);
    return [...feuilles.flatMap((f) => choixDeLaFeuilleDId(f!).map((e): ValeurDuChoix => ({ valeur: e.id, libelle: e.label }))), ...membres]
      .filter((o) => !vus.has(o.valeur) && !!vus.add(o.valeur));
  }
  const n = seuleForme(noeud);
  const def = defDe(n);
  const nommees = (valeurs: readonly (string | number | boolean)[], libelle: (v: string | number | boolean) => string): ValeurDuChoix[] => valeurs.map((valeur) => ({ valeur, libelle: libelle(valeur) }));
  switch (def?.type) {
    case 'enum': return nommees(Object.values(def.entries ?? {}) as string[], (v) => libelleDeValeur(n, v as string));
    case 'literal': {
      const valeurs = def.values as unknown[];
      const primitives = valeurs.every((v): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v));
      return primitives ? nommees(valeurs as (string | number | boolean)[], (v) => libelleDuLitteral(v) ?? String(v)) : undefined;
    }
    case 'boolean': return nommees([false, true], (v) => libelleDuLitteral(v)!);
    default: return undefined;
  }
}

/** Le nœud ÉLÉMENT du nœud quand sa seule forme est une liste ; `undefined` sinon. */
export function elementDuNoeud(noeud: unknown): unknown {
  const n = seuleForme(noeud);
  return defDe(n)?.type === 'array' ? enfantsDe(n).find((e) => e.segment === '[]')?.noeud : undefined;
}

/** Le champ de l'élément de rang `rang` de la liste du champ `liste` (`elementDuNoeud`) : nommé par la liste et son
 *  rang, jamais vidable, puisqu'il se retire de sa liste, au contexte de la liste. */
export function champDeLElement(liste: FieldDesc, rang: number): FieldDesc {
  const noeud = elementDuNoeud(liste.noeud);
  const kind = kindDuNoeud('', noeud);
  const bornes = kind === 'number' ? bornesDuNoeud(noeud) : undefined;
  return { key: String(rang), label: `${liste.label} ${rang + 1}`, kind, nullable: false, noeud, ...(bornes ? { bornes } : {}), ...(liste.contexte ? { contexte: liste.contexte } : {}) };
}

/** Le nœud de la clé et celui de la valeur du nœud quand sa seule forme est un record ; `undefined` sinon. */
export function recordDuNoeud(noeud: unknown): { cle: unknown; valeur: unknown } | undefined {
  const n = seuleForme(noeud);
  if (defDe(n)?.type !== 'record') return undefined;
  const enfant = (segment: string) => enfantsDe(n).find((e) => e.segment === segment)?.noeud;
  return { cle: enfant('{clé}'), valeur: enfant('{}') };
}

/** Les champs du record du champ `record` (`recordDuNoeud`), de donnée `donnee`, au chemin `ici` : une entrée par clé
 *  admise que son contexte y pose (`FieldDesc.contexte`), sinon par valeur de sa clé (`choixDuNoeud`), puis par clé que
 *  la donnée porte hors d'elles ; chacune nommée par le libellé de sa clé, vidable, puisqu'elle se retire de son record,
 *  au contexte du record. */
export function champsDuRecord(record: FieldDesc, donnee: Record<string, unknown>, ici: readonly (string | number)[]): FieldDesc[] {
  const { cle, valeur } = recordDuNoeud(record.noeud)!;
  const offertes = record.contexte?.choix(ici)?.filter((c) => c.refus === null) ?? choixDuNoeud(cle) ?? [];
  const cles = [...offertes.map((o) => ({ cle: String(o.valeur), libelle: o.libelle })), ...Object.keys(donnee).filter((k) => !offertes.some((o) => o.valeur === k)).map((k) => ({ cle: k, libelle: k }))];
  const kind = kindDuNoeud('', valeur);
  const bornes = kind === 'number' ? bornesDuNoeud(valeur) : undefined;
  return cles.map((c) => ({ key: c.cle, label: c.libelle, kind, nullable: true, noeud: valeur, ...(bornes ? { bornes } : {}), ...(record.contexte ? { contexte: record.contexte } : {}) }));
}

/** Le champ `f` est-il un record (`recordDuNoeud`) dont les clés sont posées au chemin `ici` : par son contexte
 *  (`FieldDesc.contexte`), sinon par les valeurs de son nœud de clé (`choixDuNoeud`) ? Un record à clé ouverte que rien
 *  ne pose ne l'est pas. */
export function clesPosees(f: FieldDesc, ici: readonly (string | number)[]): boolean {
  const record = recordDuNoeud(f.noeud);
  return record !== undefined && (f.contexte?.choix(ici) ?? choixDuNoeud(record.cle)) !== undefined;
}

/** Une variante d'une union : la valeur de son discriminant (vide : la variante d'une union à présence qui ne le porte
 *  pas, `discriminantDePresence`), son libellé, son nœud (`undefined` : une op sans forme déclarée, de
 *  `OPS_NON_TYPEES`, qui se saisit en JSON). */
export interface VarianteDuNoeud { cle: string; libelle: string; noeud: unknown }

/** Une union dont chaque variante est nommée : son nœud, son discriminant, ses variantes. */
export interface UnionDuNoeud { noeud: unknown; discriminant: string; variantes: VarianteDuNoeud[] }

/** Les branches d'union du nœud (`|N`). */
const branchesDe = (n: unknown): unknown[] => enfantsDe(n).filter((e) => e.segment.startsWith('|')).map((e) => e.noeud);

/** Le discriminant d'une union SIMPLE, qui se lit à la forme de ses branches : l'unique clé que chacune de ses branches
 *  objet déclare à une seule valeur littérale texte, sauf une, qui ne la déclare pas ; `undefined` sans elle. */
function discriminantDePresence(n: unknown): string | undefined {
  const def = defDe(n);
  if (def?.type !== 'union' || def.discriminator !== undefined) return undefined;
  const branches = branchesDe(n).map((b) => ({ cles: champsDeclares(b)?.map(([cle]) => cle), admises: valeursAdmises(b) }));
  if (branches.length < 2 || branches.some((b) => b.cles === undefined)) return undefined;
  const litterale = (admises: ReadonlySet<unknown> | undefined) => admises?.size === 1 && typeof [...admises][0] === 'string';
  const candidates = [...new Set(branches.flatMap((b) => b.cles!))].filter((cle) =>
    branches.filter((b) => !b.cles!.includes(cle)).length === 1 && branches.every((b) => !b.cles!.includes(cle) || litterale(b.admises[cle])));
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Les variantes d'une union SIMPLE, sans discriminant : chaque branche, de clé son rang, nommée par son nœud, sinon par
 *  le libellé de la première de ses clés déclarées qu'aucune autre branche ne déclare ; `undefined` si une branche est
 *  sans nom. */
function variantesSansDiscriminant(n: unknown): VarianteDuNoeud[] | undefined {
  const def = defDe(n);
  if (def?.type !== 'union' || def.discriminator !== undefined) return undefined;
  const branches = branchesDe(n).map((b) => ({ noeud: b, cles: champsDeclares(b)?.map(([cle]) => cle) ?? [] }));
  if (branches.length < 2) return undefined;
  const variantes = branches.map((b, rang) => {
    const propre = b.cles.find((c) => branches.every((o) => o === b || !o.cles.includes(c)));
    return { cle: String(rang), libelle: nomDeNoeud(b.noeud)?.label ?? (propre === undefined ? undefined : metaDesChamps(b.noeud)?.[propre]?.label), noeud: b.noeud };
  });
  return variantes.every((v): v is VarianteDuNoeud => v.libelle !== undefined) ? variantes : undefined;
}

/** Le nœud d'union de `noeud`, à travers ses enveloppes à un seul enfant transparent (optionnel, `lazy`…) : une union
 *  discriminée, une union à présence (`discriminantDePresence`) ou sans discriminant (`variantesSansDiscriminant`), ou
 *  un nœud qui répartit ses enfants déclarés (`declarationDEnfants`) ; `undefined` sans lui. */
function noeudDUnion(noeud: unknown): unknown {
  const vus = new Set<unknown>();
  for (let n = noeud; n && !vus.has(n);) {
    if (declarationDEnfants(n) || defDe(n)?.discriminator !== undefined || discriminantDePresence(n) !== undefined || variantesSansDiscriminant(n) !== undefined) return n;
    vus.add(n);
    const enfants = enfantsDe(n);
    if (enfants.length !== 1 || enfants[0].segment !== '') return undefined;
    n = enfants[0].noeud;
  }
  return undefined;
}

/** Le libellé de la branche `option`, de valeur `cle` au discriminant `discriminant` : celui de son nœud (`nommerNoeud`),
 *  sinon celui de cette valeur dans l'énumération nommée qui porte son discriminant. */
function libelleDeLaBranche(option: unknown, discriminant: string, cle: string): string | undefined {
  return nomDeNoeud(option)?.label ?? ouverts(pasDeDonnee(ouverts([option]), discriminant)).map((n) => valeursDe(n)?.[cle]).find((l) => l !== undefined);
}

/** L'union du nœud, chacune de ses variantes nommée : d'une répartition d'ops (`payloads-op`), chaque op typée, nommée
 *  par son payload, puis chaque op de `OPS_NON_TYPEES` (`OP_LABEL`) ; d'une union discriminée, chaque branche, de
 *  l'unique valeur de son discriminant (`libelleDeLaBranche`) ; d'une union à présence, de même, la branche qui ne porte
 *  pas son discriminant de clé vide, nommée par son nœud ; d'une union sans discriminant, chaque branche
 *  (`variantesSansDiscriminant`). `undefined` hors d'une union, ou si une variante est sans nom. */
export function unionDuNoeud(noeud: unknown): UnionDuNoeud | undefined {
  const n = noeudDUnion(noeud);
  if (n === undefined) return undefined;
  const declaration = declarationDEnfants(n);
  const presence = declaration ? undefined : discriminantDePresence(n);
  const sansDiscriminant = declaration || presence !== undefined || defDe(n)!.discriminator !== undefined ? undefined : variantesSansDiscriminant(n);
  const discriminant = declaration ? 'op' : presence ?? defDe(n)!.discriminator ?? '';
  const variantes = sansDiscriminant
    ?? (declaration
    ? [
      ...declaration.enfants.map((e) => ({ cle: e.segment.slice(1), libelle: nomDeNoeud(e.noeud)?.label, noeud: e.noeud })),
      ...OPS_NON_TYPEES.map((op) => ({ cle: op, libelle: OP_LABEL[op as GameOp['op']], noeud: undefined })),
    ]
    : branchesDe(n).map((b) => {
      const lues = valeursAdmises(b)[discriminant];
      const admises = [...(lues ?? [])];
      const cle = presence !== undefined && lues === undefined ? '' : admises.length === 1 && typeof admises[0] === 'string' ? admises[0] : undefined;
      return { cle, libelle: cle === undefined ? undefined : libelleDeLaBranche(b, discriminant, cle), noeud: b };
    }));
  const nommees = variantes.filter((v): v is VarianteDuNoeud => v.cle !== undefined && v.libelle !== undefined);
  return nommees.length === variantes.length ? { noeud: n, discriminant, variantes: nommees } : undefined;
}

/** La variante de l'union `u` où se lit la valeur `valeur` : celle de son discriminant (absent : la variante de clé
 *  vide), que sa co-descente ouvre (`ouverts`) ; d'une union sans discriminant, la première, dans l'ordre du parse,
 *  dont la valeur a la forme (`aLaFormeDe`) ; `undefined` sans elle. */
export function varianteCourante(u: UnionDuNoeud, valeur: unknown): VarianteDuNoeud | undefined {
  if (valeur === null || valeur === undefined) return undefined;
  if (u.discriminant === '') return u.variantes.find((v) => aLaFormeDe(v.noeud, valeur));
  if (typeof valeur !== 'object') return undefined;
  const lu = (valeur as Record<string, unknown>)[u.discriminant] ?? '';
  const ouvertes = ouverts([u.noeud], valeur);
  return u.variantes.find((v) => v.cle === lu && (v.noeud === undefined || ouvertes.includes(v.noeud)));
}

/** La seule forme objet de la fermeture du nœud, la valeur `valeur` ouverte (`ouverts`), dont les clés déclarées portent
 *  toutes celles de la valeur : la branche d'une union sans variantes nommées que la valeur dessine ; `undefined` sans
 *  elle, ou quand plusieurs la portent. */
function formeDeLaValeur(noeud: unknown, valeur: unknown): unknown {
  if (!estObjet(valeur)) return undefined;
  const cles = Object.keys(valeur);
  const formes = ouverts([noeud], valeur).filter((n) => defDe(n)?.type === 'object' && cles.every((k) => enfantsDe(n).some((e) => e.cle === k)));
  return formes.length === 1 ? formes[0] : undefined;
}

/** Où s'écrivent les champs de la valeur `valeur` du nœud : à travers ses unions, le nœud de leur variante courante
 *  (`varianteCourante`), et les discriminants que tiennent leurs choix ; puis, d'une union sans variantes nommées, la
 *  branche que dessine la valeur (`formeDeLaValeur`) ; `undefined` quand une union n'a pas de variante courante à
 *  forme déclarée. */
export function formeAuPoint(noeud: unknown, valeur: unknown): { noeud: unknown; tenus: string[] } | undefined {
  const tenus: string[] = [];
  let n = noeud;
  for (let u = unionDuNoeud(n); u; u = unionDuNoeud(n)) {
    const v = varianteCourante(u, valeur);
    if (v?.noeud === undefined) return undefined;
    if (u.discriminant !== '') tenus.push(u.discriminant);
    n = v.noeud;
  }
  return { noeud: formeDeLaValeur(n, valeur) ?? n, tenus };
}

/** La clé `cle`, de nœud `noeud`, s'écrit-elle au formulaire ? Une clé `id` qui n'est pas une référence (`idDe`, `ref`
 *  d'une portée locale, ou référence emboîtée `{ id }` d'une op) est une identité, qui se change par son geste dédié,
 *  qui la propage. */
export const cleOfferte = (cle: string, noeud: unknown): boolean =>
  cle !== 'id' || ouverts([noeud]).some((n) => declarationDeFeuilleDId(n) !== undefined || porteeDeLaFeuille(n) !== undefined || estRefEmboitee(n));

/** La fermeture `ouverts` du nœud offre-t-elle une forme OBJET à clés déclarées qui porte toutes les
 *  clés de l'échantillon (pour une union, la variante objet que l'échantillon satisfait) ? */
function admetUnObjetDeclare(noeud: unknown, echantillon: unknown): boolean {
  if (!estObjet(echantillon)) return false;
  return ouverts([noeud], echantillon).some((n) => {
    if (defDe(n)?.type !== 'object') return false;
    const cles = new Set(enfantsDe(n).flatMap((e) => (e.cle === undefined ? [] : [e.cle])));
    return cles.size > 0 && Object.keys(echantillon).every((k) => cles.has(k));
  });
}

/** Kind d'un champ VU : son nœud tranche d'abord — un objet à clés déclarées est `object`, jamais un
 *  record ; `kindOf` classe le reste. */
function kindDuChampVu(key: string, noeud: unknown, echantillon: unknown): FieldKind {
  const kind = kindOf(key, echantillon);
  return (kind === 'recordNumber' || kind === 'recordText') && admetUnObjetDeclare(noeud, echantillon) ? 'object' : kind;
}

/** L'absence qu'admet le NŒUD : `{ vide: undefined }` s'il admet `undefined`, `{ vide: null }` s'il
 *  n'admet que `null`, `false` s'il n'admet ni l'un ni l'autre ; `undefined` sans nœud. */
export function absenceDuNoeud(noeud: unknown): { vide: null | undefined } | false | undefined {
  const n = noeud as { safeParse?: (v: unknown) => { success: boolean } } | undefined;
  if (!n?.safeParse) return undefined;
  if (n.safeParse(undefined).success) return { vide: undefined };
  return n.safeParse(null).success ? { vide: null } : false;
}

/** Valeur qu'émet un champ VIDÉ : `undefined` quand son nœud l'admet, `null` sinon (nœud qui n'admet
 *  que `null`, ou champ hors schéma). */
export function videDuNoeud(noeud: unknown): null | undefined {
  const absence = absenceDuNoeud(noeud);
  return absence ? absence.vide : null;
}

/** Le NŒUD du champ admet-il l'absence ? `undefined` quand l'appelant ne tient pas de nœud. */
export function admetLAbsence(noeud: unknown): boolean | undefined {
  const absence = absenceDuNoeud(noeud);
  return absence === undefined ? undefined : absence !== false;
}

/** Le nœud admet-il une LISTE ? `undefined` sans nœud. */
export function admetUneListe(noeud: unknown): boolean | undefined {
  return noeud === undefined ? undefined : ouverts([noeud]).some((n) => defDe(n)?.type === 'array');
}

/** Un champ `json` s'édite en RANGÉES quand sa valeur est une liste d'objets, ou quand elle est absente
 *  et que son nœud admet une liste ; sinon en JSON. */
export function offreDesRangees(field: FieldDesc, value: unknown): boolean {
  if (value == null) return admetUneListe(field.noeud) !== false;
  return Array.isArray(value) && value.every(estObjet);
}

/** Le champ `cle` de l'entrée est-il DÉRIVÉ d'un autre de ses champs, hors de l'édition : la `desc` d'une entrée
 *  dont `descRef` adresse un passage (`adresseUnPassage`, `grammaire/valeurs.ts`). #1389 */
export function estDerive(entree: Record<string, unknown>, cle: string): boolean {
  return cle === 'desc' && adresseUnPassage(entree.descRef);
}

/**
 * RÉGIME de libellé d'un champ : à quel étage du document il vit, et quelle méta d'édition le nomme.
 * L'enveloppe (`id`/`desc`/`source`…) n'existe qu'au PREMIER NIVEAU : un `maison` de bande de coût
 * (`naval-traits.json install.installation.bands[]`) ou un `id` d'op (`activities.json outcomes[].ops[]`)
 * PARTAGE la clé d'un champ d'enveloppe sans en être un. `LIBELLES_ENVELOPPE` est indexée par
 * `CleEnveloppe` (`grammaire/document.ts`), et ces clés ne décrivent que le premier niveau —
 * `document()` refuse d'ailleurs une méta dessus. Y appliquer le nom d'enveloppe nommerait un champ
 * qui n'existe pas à cet étage.
 */
export interface RegimeDeLibelle {
  /** Méta d'édition du document, par le canal registre (`SchemaDef.meta`) — champs de premier niveau. */
  meta?: Readonly<Record<string, MetaChamp>>;
  /** NŒUD OBJET du niveau édité (`noeudObjet`, `schemas/validate.ts`) — porteur des libellés de
   *  VALEURS de ses champs, à TOUTE profondeur : le libellé du CHAMP est un autre axe (`meta`). */
  noeud?: unknown;
  /** `document` = champ de premier niveau ; `profondeur` = sous-champ (méta dérivée : lot #1466 L6). */
  niveau?: 'document' | 'profondeur';
}

/**
 * Cascade du LIBELLÉ d'un champ (#1466 L1a, point 6), au régime `document` : clé d'ENVELOPPE → table
 * FR de la fabrique (`LIBELLES_ENVELOPPE`, seule détentrice de ces noms puisque `document()` refuse
 * une méta dessus) ; sinon méta d'édition du def ; sinon la clé technique — seam d'extinction à
 * mesure de l'adoption (L1b #1467).
 *
 * Au régime `profondeur`, un sous-champ se nomme par la méta de SON nœud objet (`nommerChamps`), lue
 * sur la fermeture `ouverts` (optionnel, union) — ni l'enveloppe ni la méta du document, qui décrivent
 * le PREMIER NIVEAU ; à défaut, sa clé technique.
 *
 * EXCLUSION : `type` sur un document SANS méta (donc sans handle) n'est pas le type de document mais
 * un DISCRIMINANT de charge utile (characteristics/qualities/skills/trappings/spells, mesuré) — le
 * libeller « Type de document » mentirait à l'écran.
 */
export function libelleDuChamp(key: string, { meta, noeud, niveau = 'document' }: RegimeDeLibelle = {}): string {
  if (niveau === 'profondeur') return ouverts([noeud]).map((n) => metaDesChamps(n)?.[key]?.label).find((l) => l !== undefined) ?? key;
  // Lecture sur les PROPRES clés de la table (jamais la chaîne de prototypes : `toString` rendrait
  // une fonction là où l'écran attend une chaîne).
  if (Object.prototype.hasOwnProperty.call(LIBELLES_ENVELOPPE, key) && !(key === 'type' && !meta)) return LIBELLES_ENVELOPPE[key as CleEnveloppe];
  return meta?.[key]?.label ?? key;
}

/** Champs (ordre = 1re apparition), type inféré du 1er échantillon non-null de chaque clé — et, pour
 *  un tableau, de l'UNION de ses éléments sur toutes les entrées ; libellé par `libelleDuChamp`
 *  (la `meta` du def, quand il en a une, arrive par le registre de schémas).
 *  Au régime `profondeur`, un nœud objet NOMMÉ (`nommerChamps`) dont les échantillons n'ont que des clés
 *  déclarées offre TOUS ses champs, dans l'ordre de sa déclaration : un champ qu'aucun échantillon ne
 *  porte prend son kind de son nœud. */
export function inferFields(entries: Record<string, unknown>[], regime: RegimeDeLibelle = {}): FieldDesc[] {
  const vues: string[] = [];
  for (const e of entries) for (const k of Object.keys(e)) if (!vues.includes(k)) vues.push(k);
  const ferme = ouverts([regime.noeud]);
  const declares = regime.niveau === 'profondeur' ? ferme.map((n) => metaDesChamps(n)).find((m) => m !== undefined) : undefined;
  const keys = declares && vues.every((k) => Object.prototype.hasOwnProperty.call(declares, k)) ? Object.keys(declares) : vues;
  return keys.map((key) => {
    let sample: unknown;
    let sawNull = false;
    // Un TABLEAU se classe sur l'UNION de ses éléments à travers TOUTES les entrées : `every` est VRAI
    // à vide, donc un premier échantillon `[]` (fréquent en tête de dataset) ne prouve RIEN sur la forme
    // des éléments — et une liste d'OBJETS ne peut jamais tomber en `stringList`/`numberList` (#1548).
    // DEUX cliquets : `editfields-union-elements.test.ts` tient l'ALGORITHME (union vs premier
    // échantillon) sur des entrées forgées ; `editfields-listes-objets.test.ts` confronte le kind
    // inféré à la forme de la DONNÉE réelle de toutes les catégories éditables, en profondeur.
    const elements: unknown[] = [];
    let tableaux = 0;
    let scalaires = 0;
    for (const e of entries) {
      const v = e[key];
      if (v == null) { sawNull = true; continue; }
      if (Array.isArray(v)) { elements.push(...v); tableaux++; } else scalaires++;
      if (sample === undefined) sample = v;
    }
    const echantillon = Array.isArray(sample) ? elements : sample;
    // Un champ ÉNUMÉRÉ se rend en `select` : ses options ET leurs libellés viennent de son NŒUD
    // (`enumNomme`, #1694), jamais de la donnée observée — une valeur qu'aucune entrée ne porte encore
    // reste proposable, et une valeur inconnue de l'enum n'est pas proposée. Le NŒUD vaut à TOUTE
    // profondeur : un champ énuméré de sous-formulaire se nomme comme un champ de racine.
    const noeud = ferme.flatMap(enfantsDe).find((e) => e.cle === key)?.noeud;
    const valeurs = valeursDe(noeud);
    // Le VIDABLE et la valeur vide se lisent sur le NŒUD ; l'échantillon ne tranche qu'un champ hors schéma.
    const absence = absenceDuNoeud(noeud);
    const nullable = absence === undefined ? sawNull || sample === undefined : absence !== false;
    if (valeurs) return { key, label: libelleDuChamp(key, regime), kind: (derouleEnum(noeud)?.liste ? 'selectList' : 'select') as FieldKind, nullable, valeurs, noeud };
    // Un champ qui porte ici un tableau, là un scalaire (union `booléen | chaînes`) n'a aucun contrôle
    // structuré qui rende ses deux formes : il s'édite en JSON.
    // Le texte d'une prose nommée (`proseNommee`) se saisit sur plusieurs lignes.
    const infere = tableaux && scalaires ? 'json' : !vues.includes(key) ? kindDuNoeud(key, noeud) : kindDuChampVu(key, noeud, echantillon);
    const kind = infere === 'text' && ferme.some((n) => declarationProseNommee(n)?.champ === key) ? 'textarea' : infere;
    const bornes = kind === 'number' ? bornesDuNoeud(noeud) : undefined;
    return { key, label: libelleDuChamp(key, regime), kind, nullable, noeud, ...(bornes ? { bornes } : {}) };
  });
}

/** Les champs qu'offre le formulaire de la valeur objet `donnee` du nœud `noeud` (`inferFields` au régime `profondeur`),
 *  sans les discriminants `tenus` que tient le choix d'une variante (`formeAuPoint`), ni une identité (`cleOfferte`). */
export function champsOfferts(noeud: unknown, donnee: Record<string, unknown>, tenus: readonly string[] = []): FieldDesc[] {
  return inferFields([donnee], { noeud, niveau: 'profondeur' }).filter((f) => !tenus.includes(f.key) && cleOfferte(f.key, f.noeud));
}
