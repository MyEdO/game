/**
 * LE FORMULAIRE TIRÉ DU SCHÉMA (#3606) : ce qu'un hôte offre d'écrire sur une donnée, lu sur le nœud zod qui la décrit
 * (`grammaire/descente.ts`), champ par champ, en description sérialisable (`ChampDeFormulaire`) ; la valeur neuve d'un
 * nœud (`valeurNeuveDe`) ; et l'écriture bornée par cette même lecture (`avecLaValeur`), que le geste `valeur` de la
 * session joue (`./session`). Une union, une liste, un dictionnaire, ou tout nœud dont la fermeture n'a pas une seule
 * forme, se saisit en JSON. Le formulaire d'une zone d'effet n'offre que `CHAMPS_DU_FORMULAIRE_DE_ZONE`.
 */
import type { z } from 'zod';
import type { SceneEffectZone } from '../monde/scene';
import { defDe, enfantsDe, ouverts } from '../../data/schemas/grammaire/descente';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { declarationDeFeuilleDId } from '../../data/schemas/grammaire/ref';
import { sceneEffectZoneSchema } from '../../data/schemas/defs-scenes/scene';
import { choixDeLaFeuilleDId, datasetDeLEspaceDuType } from '../../data';
import { absenceDuNoeud, estTransparent, libelleDuChamp } from '../codex/editFields';
import { libelleDuLitteral } from '../libelles';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';

/** Un pas du chemin d'un champ dans sa donnée : une clé d'objet, ou un rang de liste. */
export type Segment = string | number;

/** Une valeur d'un champ à choix, et ce qu'elle dit. */
interface OptionDuChoix { valeur: string | number | boolean; libelle: string }

/** Ce que la saisie d'un champ exige, d'après la forme de son nœud : `choix` parmi ses options (énumération, littéral,
 *  booléen, référence d'un catalogue fermé, sa sous-liste comprise) ; `nombre`, entier ou non, entre les bornes de ses
 *  checks (`null` : sans borne) ; `texte` ; `json`. */
type FormeDeFeuille =
  | { sorte: 'choix'; options: OptionDuChoix[] }
  | { sorte: 'nombre'; entier: boolean; min: number | null; max: number | null }
  | { sorte: 'texte' }
  | { sorte: 'json' };

/** La forme d'un nœud : une feuille, ou un objet, son nœud objet porteur de ses clés déclarées. */
type Forme = FormeDeFeuille | { sorte: 'objet'; noeud: unknown };

/** Un champ du formulaire : son chemin dans la donnée, son libellé (`libelleDuChamp`), si son absence est admise
 *  (`absenceDuNoeud`), s'il est présent ; un objet présent porte ses champs, absent sa valeur neuve ; une feuille, sa
 *  forme et sa valeur, s'il est présent. */
export type ChampDeFormulaire = { chemin: Segment[]; libelle: string; absenceAdmise: boolean } & (
  | { sorte: 'objet'; present: true; champs: ChampDeFormulaire[] }
  | { sorte: 'objet'; present: false; neuve: unknown }
  | (FormeDeFeuille & { present: boolean; valeur?: unknown })
);

type Objet = Record<string, unknown>;

/** Les champs du formulaire d'une zone d'effet : son Test de traversée, ses effets à la traversée et à chaque Round. */
const CHAMPS_DU_FORMULAIRE_DE_ZONE = ['crossTest', 'onCross', 'perRound'] as const;

/** Les clés déclarées de l'objet de schéma `objet`, dans l'ordre de sa déclaration, chacune avec son nœud. */
const clesDe = (objet: unknown): (readonly [string, unknown])[] => enfantsDe(objet).flatMap((e) => (e.cle === undefined ? [] : [[e.cle, e.noeud] as const]));

/** Le nœud admet-il que son champ soit retiré (`undefined`) ? */
function admetLeRetrait(noeud: unknown): boolean {
  const absence = absenceDuNoeud(noeud);
  return !!absence && absence.vide === undefined;
}

/** Les options d'un choix, chaque valeur nommée par `libelle`. */
const choix = (valeurs: readonly (string | number | boolean)[], libelle: (v: string | number | boolean) => string): FormeDeFeuille => ({ sorte: 'choix', options: valeurs.map((valeur) => ({ valeur, libelle: libelle(valeur) })) });

const JSON_ = { sorte: 'json' } as const;
const estPrimitive = (v: unknown): v is string | number | boolean => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
const borne = (v: number | null): number | null => (v !== null && Number.isFinite(v) ? v : null);

/** La forme du nœud `noeud`, lue sur sa fermeture (`ouverts`) : une référence `idDe` fermée dont un dataset porte
 *  l'espace se choisit parmi ses entrées (`choixDeLaFeuilleDId`) ; sinon la seule forme concrète de la fermeture
 *  (`estTransparent`) la donne, et une fermeture de plusieurs formes, ou d'une forme sans saisie, se saisit en JSON. */
function formeDu(noeud: unknown): Forme {
  const ferme = ouverts([noeud]);
  const feuille = ferme.map(declarationDeFeuilleDId).find((d) => d !== undefined);
  if (feuille && !feuille.ouverte && datasetDeLEspaceDuType(feuille.type) !== undefined) {
    return { sorte: 'choix', options: choixDeLaFeuilleDId(feuille).map((e) => ({ valeur: e.id, libelle: e.label })) };
  }
  const formes = ferme.filter((n) => !estTransparent(n));
  if (formes.length !== 1) return JSON_;
  const [n] = formes;
  const def = defDe(n)!;
  switch (def.type) {
    case 'object': return { sorte: 'objet', noeud: n };
    case 'enum': return choix(Object.values(def.entries ?? {}) as string[], (v) => libelleDeValeur(n, v as string));
    case 'literal': {
      const valeurs = def.values as unknown[];
      return valeurs.every(estPrimitive) ? choix(valeurs, (v) => libelleDuLitteral(v) ?? String(v)) : JSON_;
    }
    case 'boolean': return choix([false, true], (v) => libelleDuLitteral(v)!);
    case 'number': {
      const nombre = n as z.ZodNumber;
      return { sorte: 'nombre', entier: nombre.isInt, min: borne(nombre.minValue), max: borne(nombre.maxValue) };
    }
    case 'string': return { sorte: 'texte' };
    default: return JSON_;
  }
}

/** La valeur NEUVE d'un nœud : d'un objet, ses seuls champs requis, chacun à sa valeur neuve ; d'un choix, sa première
 *  option ; d'un nombre, 0, ou sa borne basse si elle est au-dessus ; d'un texte, '' ; d'une liste, [] ; `undefined`
 *  pour tout autre nœud saisi en JSON, qu'un objet neuf ne porte pas. */
export function valeurNeuveDe(noeud: unknown): unknown {
  const forme = formeDu(noeud);
  switch (forme.sorte) {
    case 'objet': return Object.fromEntries(clesDe(forme.noeud).flatMap(([cle, n]) => {
      const neuve = admetLeRetrait(n) ? undefined : valeurNeuveDe(n);
      return neuve === undefined ? [] : [[cle, neuve]];
    }));
    case 'choix': return forme.options[0]?.valeur;
    case 'nombre': return forme.min !== null && forme.min > 0 ? forme.min : 0;
    case 'texte': return '';
    case 'json': return ouverts([noeud]).some((n) => defDe(n)?.type === 'array') ? [] : undefined;
  }
}

/** Le champ `cle` de nœud `noeud` de l'objet de schéma `objet`, de valeur `valeur`, au chemin `chemin`. */
function champ(objet: unknown, cle: string, noeud: unknown, valeur: unknown, chemin: Segment[]): ChampDeFormulaire {
  const forme = formeDu(noeud);
  const base = { chemin, libelle: libelleDuChamp(cle, { noeud: objet, niveau: 'profondeur' }), absenceAdmise: admetLeRetrait(noeud) };
  if (forme.sorte !== 'objet') return { ...base, ...forme, present: valeur !== undefined, ...(valeur === undefined ? {} : { valeur }) };
  if (valeur === undefined) return { ...base, sorte: 'objet', present: false, neuve: valeurNeuveDe(noeud) };
  const donnee = valeur as Objet;
  return { ...base, sorte: 'objet', present: true, champs: clesDe(forme.noeud).map(([c, n]) => champ(forme.noeud, c, n, donnee[c], [...chemin, c])) };
}

/** Le formulaire de la zone d'effet `zone` : chacun de `CHAMPS_DU_FORMULAIRE_DE_ZONE`, lu sur `sceneEffectZoneSchema`. */
export function formulaireDeZone(zone: SceneEffectZone): ChampDeFormulaire[] {
  const noeuds = new Map(clesDe(sceneEffectZoneSchema));
  return CHAMPS_DU_FORMULAIRE_DE_ZONE.map((cle) => champ(sceneEffectZoneSchema, cle, noeuds.get(cle), zone[cle], [cle]));
}

/** La valeur `valeur` est-elle de la sorte du nœud `noeud` ? `undefined` : s'il admet le retrait ; un objet, sa valeur
 *  neuve ; un choix, l'une de ses options ; un nombre, un fini, entier s'il l'est ; un texte, une chaîne ; du JSON, une
 *  valeur que le nœud parse. */
function admise(noeud: unknown, valeur: unknown): boolean {
  if (valeur === undefined) return admetLeRetrait(noeud);
  const forme = formeDu(noeud);
  switch (forme.sorte) {
    case 'objet': return jsonCanonique(valeur) === jsonCanonique(valeurNeuveDe(noeud));
    case 'choix': return forme.options.some((o) => o.valeur === valeur);
    case 'nombre': return typeof valeur === 'number' && Number.isFinite(valeur) && (!forme.entier || Number.isInteger(valeur));
    case 'texte': return typeof valeur === 'string';
    case 'json': return (noeud as z.ZodType).safeParse(valeur).success;
  }
}

/** L'objet `o` où le champ au chemin `[cle, ...reste]` vaut `valeur`, retiré s'il vaut `undefined` ; un objet que ce
 *  retrait vide, au rang `rang` du chemin, en part aussi quand `retirable(rang)`. */
function ecrit(o: Objet, [cle, ...reste]: readonly string[], valeur: unknown, retirable: (rang: number) => boolean, rang = 0): Objet {
  const suite = reste.length ? ecrit(o[cle] as Objet, reste, valeur, retirable, rang + 1) : valeur;
  const vide = valeur === undefined && reste.length > 0 && Object.keys(o[cle] as Objet).length > 0 && !Object.keys(suite as Objet).length;
  const out = { ...o, [cle]: suite };
  if (suite === undefined || (vide && retirable(rang))) delete out[cle];
  return out;
}

/** La donnée `donnee` de l'objet de schéma `objet` où `valeur` s'écrit au chemin `chemin`, le champ retiré si elle
 *  vaut `undefined` (`ecrit`) ; `undefined` si le formulaire ne l'offre pas : un pas qui n'est pas une clé déclarée
 *  d'un objet présent, une clé `id` qui n'est pas une référence `idDe` (une identité se change par son geste dédié,
 *  qui la propage), ou une valeur qui n'est pas de la sorte du champ (`admise`). La porte du schéma entier reste à
 *  l'enregistrement et à l'essai. */
export function avecLaValeur(objet: unknown, donnee: Objet, chemin: readonly Segment[], valeur: unknown): Objet | undefined {
  const noeuds: unknown[] = [];
  let parent: unknown = objet;
  let point: unknown = donnee;
  for (const pas of chemin) {
    const forme = noeuds.length ? formeDu(noeuds[noeuds.length - 1]) : { sorte: 'objet' as const, noeud: parent };
    if (forme.sorte !== 'objet' || typeof pas !== 'string' || point === null || typeof point !== 'object') return undefined;
    parent = forme.noeud;
    const noeud = clesDe(parent).find(([cle]) => cle === pas)?.[1];
    if (noeud === undefined || (pas === 'id' && !ouverts([noeud]).some((n) => declarationDeFeuilleDId(n) !== undefined))) return undefined;
    noeuds.push(noeud);
    point = (point as Objet)[pas];
  }
  if (!noeuds.length || !admise(noeuds[noeuds.length - 1], valeur)) return undefined;
  return ecrit(donnee, chemin as readonly string[], valeur, (rang) => admetLeRetrait(noeuds[rang]));
}

/** La zone d'effet `zone` où `valeur` s'écrit au chemin `chemin` de son formulaire (`formulaireDeZone`, `avecLaValeur`) ;
 *  `undefined` si son formulaire ne l'offre pas. */
export function zoneAvecLaValeur(zone: SceneEffectZone, chemin: readonly Segment[], valeur: unknown): SceneEffectZone | undefined {
  const offert = (CHAMPS_DU_FORMULAIRE_DE_ZONE as readonly Segment[]).includes(chemin[0]);
  return offert ? (avecLaValeur(sceneEffectZoneSchema, zone as unknown as Objet, chemin, valeur) as SceneEffectZone | undefined) : undefined;
}
