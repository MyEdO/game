import type { JSX } from 'react';
/**
 * Picker DEV de RÉFÉRENCE unifié au Codex — UN composant, 4 modes, configuré par (catégorie, champ) :
 *  - `liste`    : `Ref[]` = {id, value?} (sorts d'une créature, Bénédictions/Miracles d'un dieu, Qualités
 *                 d'une possession) — choix dans le dataset cible, LIBELLÉ affiché mais `id` STABLE stocké ;
 *  - `single`   : UN `<select>` (sous-type d'arme, classe d'une carrière, espèce/carrière d'un pré-tiré…),
 *                 sur un dataset OU sur des entrées fournies (`entrees` : registre du narratif d'un
 *                 projet, `RefNarrativeField`) ;
 *  - `freeText` : `single` + `<input list>`/`<datalist>` (au lieu d'un `<select>` strict) — pioche par
 *                 LIBELLÉ ou id (id stocké) OU saisie libre hors catalogue, émise telle quelle ;
 *  - `vocab`    : `<input list>` + `<datalist>` des valeurs DISTINCTES d'un champ (refChar/refCareer/subType…)
 *                 → pioche OU saisie libre (mais la LISTE elle-même vient d'un champ, pas d'ids de dataset).
 * `SaisieSuggeree` est le contrôle `<input list>` + `<datalist>` de `freeText` et `vocab`, exporté pour une
 * saisie libre que l'appelant compose (chaîne « Arme (Épée) +7 », libellé de dataset) : la saisie s'émet
 * telle quelle. On stocke partout l'`id` — multilangue-safe (cf.
 * `AGENTS.md` § Pour TOUT agent). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useId, useMemo, useState } from 'react';
import { datasetArray, type DatasetKey } from '../../../data/overrides';
import { ouverts, pasDeDonnee } from '../../../data/schemas/grammaire/descente';
import { espaceDe, estFeuilleDId, refusDeLEntree, declarationDeFeuilleDId, type FeuilleDId } from '../../../data/schemas/grammaire/ref';
import { slugId } from '../../../data/slug';
import { REFERENCES_NARRATIVES, type RegistreReference } from '../../../data/schemas/defs-scenes/registres-narratifs';
import { entreesNarratives, type CleDeReferenceNarrative } from '../libellesNarratifs';
import type { NarratifBlock } from '../../../state/campaignNarratif';
import { NumberField } from '../../NumberField';
import { useVersionDesDatasets } from '../../useVersionDesDatasets';
import { CATEGORY_DATASET_DERIVE, DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE } from '../../../data/schemas/exposition-derivee';
import { categoryByKey } from '../registry';
import { videDuNoeud } from '../editFields';

/** `filter` : un prédicat MOTEUR sur l'entrée (`Inspector.tsx`, portes/murs), jamais une sous-liste du
 *  schéma — celle-ci se lit sur le NŒUD du champ (`noeud`, `refusDuNoeud`). */
type RefDatasetCfg = { ds: DatasetKey; filter?: (entry: Record<string, unknown>) => boolean };
/** Mode `liste` : une rangée par réf, aucun contrôle unique. */
type ListeRefCfg = RefDatasetCfg & { value?: boolean; single?: false; freeText?: false };
/** Mode `single` avec `spec` : le `<select>` ET l'`<input>` de spécialisation, aucun contrôle unique. */
type SpecRefCfg = RefDatasetCfg & { single: true; freeText?: false; spec: true };
/** Entrées FOURNIES par l'appelant (mode `single`) quand leur source n'est pas un dataset du catalogue :
 *  un registre du narratif d'un projet, les stades d'un indice. `nom` = la source, affichée en indice ;
 *  les entrées gardent leur ordre déclaré. */
type EntreesCfg = { entrees: readonly { id: string; label: string }[]; nom: string };
/** Config dont le rendu est UN contrôle : il porte le nom accessible, l'invalidité et la description. */
export type RefFieldCfgUnique =
  | (RefDatasetCfg & { single: true; freeText?: false; spec?: false })
  | EntreesCfg
  | (RefDatasetCfg & { freeText: true; single?: boolean })
  | { vocabFrom: string };
/** Config d'un champ-réf, par (catégorie, champ). Dataset réel (liste/single) OU vocabulaire d'un champ. */
export type RefFieldCfg = ListeRefCfg | SpecRefCfg | RefFieldCfgUnique;

/**
 * REF_FIELD — clés par `'<catégorie>.<champ>'` (priorité) ou par `'<champ>'` (repli global).
 *  Trois formes, lues sur l'entrée elle-même : une LISTE d'ids d'un dataset (`ds`), un id SEUL
 *  (`single`), ou un vocabulaire tiré d'un champ (`vocabFrom`). `spec` et `freeText` sont posés par
 *  les appelants directs du composant, jamais ici. Un champ dont la feuille est un `idDe` FERMÉ n'y
 *  entre pas : `Field` (`CodexEdit.tsx`) le route par `cfgDeLaFeuille`.
 */
export const REF_FIELD: Record<string, RefFieldCfg> = {
  // ── listes (Ref[]) — existant ───────────────────────────────────────────────
  spells: { ds: 'spells' },
  blessings: { ds: 'spells' },
  miracles: { ds: 'spells' },
  chaosSpells: { ds: 'spells' },
  qualities: { ds: 'qualities', value: true },
  grantsManeuvers: { ds: 'maneuvers' },
  // ── single (dataset réel) ───────────────────────────────────────────────────
  'trappings.subType': { ds: 'weaponGroups', single: true },
  'careers.class': { ds: 'classes', single: true },
  'careerLevels.career': { ds: 'careers', single: true },
  'locations.parent': { ds: 'locations', single: true },
  // Caractéristique d'une compétence : SÉLECTEUR (pas d'input libre) — `skills.json` stocke l'`id` du
  // dataset `characteristics` (mesuré : 10/10 valeurs distinctes résolues par `id`, 0/10 par `abr` ou
  // `label`), donc valeur d'option = `id` (défaut). `abr` y est vide sur 7 des 19 entrées.
  'skills.characteristic': { ds: 'characteristics', single: true },
  // ── vocab (valeurs distinctes d'un champ) ───────────────────────────────────
  // refChar/refCareer n'existent QUE sur les espèces → repli global par nom (la catégorie Codex
  // d'`species.json` est `races`, pas `species` ; un nom de champ unique évite de la coder en dur).
  refChar: { vocabFrom: 'species.refChar' },
  refCareer: { vocabFrom: 'species.refCareer' },
  'qualities.subType': { ds: 'qualitySubtypes', single: true },
  'qualities.polarite': { ds: 'qualityTypes', single: true },
};

/** Résout la config d'un champ : clé (catégorie, champ) puis repli global par champ. */
export function refFieldCfg(categoryKey: string, fieldKey: string): RefFieldCfg | undefined {
  return REF_FIELD[`${categoryKey}.${fieldKey}`] ?? REF_FIELD[fieldKey];
}

/** Config `single` d'un champ dont le NŒUD est une feuille `idDe` FERMÉE : le dataset de racine de
 *  l'espace de son type (`DATASET_FICHIER_DERIVE`), `undefined` sinon. */
export function cfgDeLaFeuille(noeud: unknown): (RefDatasetCfg & { single: true }) | undefined {
  const feuille = noeud === undefined ? undefined : ouverts([noeud]).map(declarationDeFeuilleDId).find((d) => d !== undefined);
  if (!feuille || feuille.ouverte) return undefined;
  const espace = espaceDe(feuille.type);
  const ds = Object.keys(DATASET_FICHIER_DERIVE).find((d) => DATASET_FICHIER_DERIVE[d] === espace && DATASET_SUITE_DERIVE[d] === '');
  return ds === undefined ? undefined : { ds: ds as DatasetKey, single: true };
}

const isVocab = (cfg: RefFieldCfg): cfg is { vocabFrom: string } => 'vocabFrom' in cfg;
const fournies = (cfg: RefFieldCfg): cfg is EntreesCfg => 'entrees' in cfg;

/** Libellé d'affichage d'une entrée. */
const entryLabel = (e: Record<string, unknown>): string =>
  String(e.label ?? e.id ?? '');

interface RefEntry { id: string; value?: number }
interface SpecRef { id: string; spec?: string }

/** Nom d'AUTEUR d'un dataset : le libellé de sa catégorie au Codex (`CATEGORY_DATASET_DERIVE`, puis
 *  une catégorie du même nom). `undefined` quand le dataset n'a pas de catégorie : rien ne s'affiche
 *  plutôt qu'une clé de moteur. */
export function libelleDeDataset(ds: string): string | undefined {
  const categorie = Object.keys(CATEGORY_DATASET_DERIVE).find((c) => CATEGORY_DATASET_DERIVE[c] === ds) ?? ds;
  return categoryByKey(categorie)?.label;
}

/** L'indication `(…)` d'un champ-réf, ou rien. */
const indiceDe = (texte: string | undefined) => (texte ? <em className="ed-hint"> ({texte})</em> : null);

/** Forme comparable d'un libellé : son slug (`slugId`), marque du pluriel effacée. */
const forme = (texte: string): string => slugId(texte).replace(/[sx]$/, '');
/** Le nom du registre que montre l'indication, sauf quand le libellé du champ le dit déjà (« Livre » / « Livres »). */
const nomDistinct = (label: string | undefined, nom: string | undefined): string | undefined =>
  (nom && !(label && forme(label) === forme(nom)) ? nom : undefined);

/** `noeud` : le nœud de schéma du champ — sa feuille `idDe` restreint les options à sa sous-liste.
 *  `entreesEnTete` : entrées hors dataset (objets du projet édité), résolues AVANT lui — à id égal, elles priment. */
type RefFieldCommun = {
  categoryKey?: string; fieldKey?: string; label?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean;
  noeud?: unknown; entreesEnTete?: readonly { readonly id: string }[];
  /** Mode `single` + `nullable` : l'option « (aucun) » est montrée mais INÉLIGIBLE (le champ vide
   *  laisserait le porteur sans ce qu'il exige, #1882). */
  aucunIneligible?: boolean;
  /** L'explication optionnelle du champ (`docs/charte-ui.md`, « Zéro texte tutoriel ») : `title` de son enveloppe. */
  title?: string;
};
/** Nom accessible, invalidité et description du contrôle rendu. */
type Accessibilite = { ariaLabel?: string; invalide?: boolean; describedBy?: string };

/** Un contrôle UNIQUE (`single` sans `spec`, `freeText`, `vocab`) porte `Accessibilite` ; la `liste` et le
 *  `single` à `spec` n'en rendent aucun à qui la poser, et l'appel qui la passerait ne compile pas. */
export function RefField(props: RefFieldCommun & Accessibilite & { cfg: RefFieldCfgUnique }): JSX.Element;
export function RefField(props: RefFieldCommun & { cfg: RefFieldCfg; ariaLabel?: never; invalide?: never; describedBy?: never }): JSX.Element;
export function RefField(
  { cfg, fieldKey, label, title, ariaLabel, value, onChange, nullable, aucunIneligible, invalide, describedBy, noeud, entreesEnTete = SANS_ENTREE }:
  RefFieldCommun & Accessibilite & { cfg: RefFieldCfg },
) {
  // `label` = AFFICHAGE (libellé FR du champ, #1466) ; `fieldKey`/`cfg` restent l'IDENTITé. Un appelant
  // qui ne connaît que la clé affiche la clé.
  const affiche = label ?? fieldKey;
  const champ = { noeud, entreesEnTete, title };
  const a11y = { ariaLabel, invalide, describedBy };
  if (isVocab(cfg)) return <VocabField label={affiche} title={title} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} noeud={noeud} {...a11y} />;
  const single = (c: SingleCfg) => <SingleRefField label={affiche} cfg={c} champ={champ} value={value} onChange={onChange} nullable={nullable} aucunIneligible={aucunIneligible} {...a11y} />;
  if (fournies(cfg)) return single(cfg);
  if (cfg.freeText) return <FreeRefField label={affiche} cfg={cfg} champ={champ} value={value} onChange={onChange} {...a11y} />;
  if (cfg.single) return single(cfg);
  return <ListRefField label={affiche} cfg={cfg} champ={champ} value={value} onChange={onChange} />;
}

/** Le nœud de schéma d'un champ-réf, ses entrées hors dataset et son explication (`RefFieldCommun`). */
type Champ = { noeud: unknown; entreesEnTete: readonly { readonly id: string }[]; title?: string };
/** `entreesEnTete` absent : une référence STABLE, que les `useMemo` de l'univers ne voient pas changer. */
const SANS_ENTREE: Champ['entreesEnTete'] = [];

/** Les feuilles `idDe` du champ : celle du nœud, sinon celle de son élément pour un champ liste. */
function feuillesDuNoeud(noeud: unknown): FeuilleDId[] {
  if (noeud === undefined) return [];
  const champ = ouverts([noeud]);
  const direct = champ.filter(estFeuilleDId);
  return (direct.length ? direct : ouverts(pasDeDonnee(champ, 0)).filter(estFeuilleDId)).flatMap((n) => declarationDeFeuilleDId(n) ?? []);
}

/**
 * Le refus d'une ENTRÉE par la sous-liste des feuilles `idDe` du champ (`refusDeLEntree`) — `null` si
 * l'une l'admet —, `undefined` si aucune ne déclare de sous-liste.
 */
export function refusDuNoeud(noeud: unknown): ((entree: { readonly id: string }) => string | null) | undefined {
  const restreintes = feuillesDuNoeud(noeud).flatMap((f) => (f.sousListe === undefined ? [] : [{ type: f.type, sousListe: f.sousListe }]));
  if (!restreintes.length) return undefined;
  return (entree) => {
    const refus = restreintes.map((f) => refusDeLEntree(f.type, f.sousListe, entree));
    return refus.includes(null) ? null : refus[0];
  };
}

/** Une entrée et son id (`String(e.id)`) : la forme que lisent univers, options et refus. */
type Entree = { id: string; e: Record<string, unknown> };

/** L'univers du champ : `entreesEnTete`, puis les entrées de la source (dataset `ds`, ou entrées
 *  fournies) dont elles ne prennent pas l'id ; recalculé à chaque écriture au seam (`useVersionDesDatasets`). */
function useUnivers(source: DatasetKey | EntreesCfg['entrees'], entreesEnTete: Champ['entreesEnTete']): readonly Entree[] {
  const version = useVersionDesDatasets();
  return useMemo(() => {
    const enTete = entreesEnTete.map((e) => ({ id: e.id, e: e as Record<string, unknown> }));
    const pris = new Set(enTete.map((x) => x.id));
    const entrees = (typeof source === 'string' ? datasetArray(source) : source) as Record<string, unknown>[];
    const deLaSource = entrees.map((e) => ({ id: String(e.id ?? ''), e })).filter((x) => !pris.has(x.id));
    return [...enTete, ...deLaSource];
  }, [source, entreesEnTete, version]);
}

/** Options de l'univers (valeur stockée + libellé) : les entrées que la sous-liste de la feuille du
 *  champ admet (`refusDuNoeud`), puis le prédicat moteur `filter` — triées par libellé pour un dataset,
 *  dans leur ordre déclaré pour des entrées fournies (`trier`). */
function useOptions(cfg: { ds?: DatasetKey; filter?: (entry: Record<string, unknown>) => boolean }, noeud: unknown, univers: readonly Entree[], trier = true) {
  return useMemo(() => {
    const refus = refusDuNoeud(noeud);
    const options = univers
      .filter(({ id, e }) => (!refus || refus({ ...e, id }) === null) && (cfg.filter ? cfg.filter(e) : true))
      .map(({ id, e }) => ({ v: id, label: entryLabel(e) }));
    return trier ? options.sort((a, b) => a.label.localeCompare(b.label)) : options;
  }, [cfg.filter, noeud, univers, trier]);
}

/** Config d'un `SingleRefField` : un dataset (avec ou sans `spec`), ou des entrées fournies. */
type SingleCfg = { ds: DatasetKey; spec?: boolean; filter?: (entry: Record<string, unknown>) => boolean } | EntreesCfg;
/** Les entrées fournies d'une `SingleCfg` n'ont ni `filter` ni `spec`. */
const SANS_FILTRE: { filter?: undefined } = {};

/** Mode `single` : UN `<select>` (+ option « — (aucun) — » si nullable, option « (inconnu) » si hors liste).
 *  `spec` → un `<input>` texte à côté, on stocke `{ id, spec? }` (spec omis si vide) ; sinon la chaîne brute. */
function SingleRefField(
  { label, ariaLabel, cfg, champ, value, onChange, nullable, aucunIneligible, invalide, describedBy }:
  Accessibilite & { label?: string; cfg: SingleCfg; champ: Champ; value: unknown; onChange: (v: unknown) => void; nullable?: boolean; aucunIneligible?: boolean },
) {
  const deDataset = 'entrees' in cfg ? undefined : cfg;
  const univers = useUnivers('entrees' in cfg ? cfg.entrees : cfg.ds, champ.entreesEnTete);
  const options = useOptions(deDataset ?? SANS_FILTRE, champ.noeud, univers, deDataset !== undefined);
  const nom = 'entrees' in cfg ? cfg.nom : libelleDeDataset(cfg.ds);
  const avecSpec = !!deDataset?.spec;
  const cur: SpecRef = avecSpec
    ? (value && typeof value === 'object' ? (value as SpecRef) : { id: typeof value === 'string' ? value : '' })
    : { id: typeof value === 'string' ? value : '' };
  const id = cur.id ?? '';
  const known = id === '' || options.some((o) => o.v === id);
  const emit = (nextId: string, nextSpec?: string) => {
    if (nextId === '') { onChange(nullable ? videDuNoeud(champ.noeud) : ''); return; }
    if (avecSpec) { const v: SpecRef = { id: nextId }; if (nextSpec) v.spec = nextSpec; onChange(v); }
    else onChange(nextId);
  };
  // UN contrôle : le libellé visible le NOMME (`<label>`). Avec `spec`, deux contrôles : un `<div>`.
  const Enveloppe = avecSpec ? 'div' : 'label';
  return (
    <Enveloppe className="ed-field" title={champ.title}>
      <span>{label}{indiceDe(nomDistinct(label, nom))}</span>
      <div className="fieldrow">
        <select aria-label={ariaLabel} aria-invalid={invalide || undefined} aria-describedby={describedBy} value={id} onChange={(e) => emit(e.target.value, cur.spec)}>
          {nullable && <option value="" disabled={aucunIneligible}>— (aucun) —</option>}
          {!nullable && id === '' && <option value="">{nom ? `— (choisir dans ${nom}) —` : '— (choisir) —'}</option>}
          {id !== '' && !known && <option value={id}>{id} (inconnu)</option>}
          {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        {avecSpec && (
          <input placeholder="spec" style={{ width: 120 }} value={cur.spec ?? ''}
            onChange={(e) => emit(id, e.target.value || undefined)} />
        )}
      </div>
    </Enveloppe>
  );
}

/** Mode `single` + `freeText` : `<input list>` + `<datalist>` des options — la saisie se résout par id
 *  puis par LIBELLÉ dans l'univers du champ (`useUnivers`, entrées refusées comprises) : une entrée
 *  admise émet son id ; une entrée que la sous-liste refuse (`refusDuNoeud`) affiche le refus et
 *  n'émet rien ; une saisie non résolue s'émet telle quelle. Une datalist par instance (`useId`).
 *  Le texte saisi vit ICI : il ne se recale sur `value` que lorsqu'elle diffère de la dernière valeur
 *  que le champ a émise, jamais à chaque frappe. */
function FreeRefField(
  { label, ariaLabel, invalide, describedBy, cfg, champ, value, onChange }:
  Accessibilite & { label?: string; cfg: { ds: DatasetKey }; champ: Champ; value: unknown; onChange: (v: unknown) => void },
) {
  const univers = useUnivers(cfg.ds, champ.entreesEnTete);
  const options = useOptions(cfg, champ.noeud, univers);
  const juger = useMemo(() => refusDuNoeud(champ.noeud), [champ.noeud]);
  const cur = typeof value === 'string' ? value : '';
  const idRefus = useId();
  const libelleDe = (id: string) => entryLabel(univers.find((x) => x.id === id)?.e ?? { id });
  const [texte, setTexte] = useState(() => libelleDe(cur));
  const [connue, setConnue] = useState(cur);
  const [refus, setRefus] = useState<string | null>(null);
  if (cur !== connue) {
    setConnue(cur);
    setTexte(libelleDe(cur));
    setRefus(null);
  }
  const resoudre = (v: string): Entree | undefined =>
    univers.find((x) => x.id === v) ?? univers.find((x) => entryLabel(x.e).toLowerCase() === v.toLowerCase());
  return (
    <div className="ed-field" title={champ.title}>
      <span>{label}{indiceDe([nomDistinct(label, libelleDeDataset(cfg.ds)), 'saisie libre'].filter(Boolean).join(', ou '))}</span>
      <SaisieSuggeree
        suggestions={options.map((o) => o.label)} value={texte}
        ariaLabel={ariaLabel} invalide={invalide || refus !== null}
        describedBy={[describedBy, refus === null ? undefined : idRefus].filter(Boolean).join(' ') || undefined}
        onChange={(brut) => {
          const v = brut.trim();
          const entree = v ? resoudre(v) : undefined;
          const r = entree && juger ? juger({ ...entree.e, id: entree.id }) : null;
          setTexte(brut);
          setRefus(r);
          if (r !== null) return;
          const emise = entree ? entree.id : v || undefined;
          setConnue(emise ?? '');
          onChange(emise);
        }}
      />
      {refus !== null && <span id={idRefus} className="hint" role="status">{refus}</span>}
    </div>
  );
}

/** Valeurs DISTINCTES et non vides du champ `champ` des entrées du dataset `ds`, dans l'ordre du
 *  dataset : suggestions d'une saisie libre (`SaisieSuggeree`). */
function valeursDistinctes(ds: DatasetKey, champ: string): string[] {
  return [...new Set((datasetArray(ds) as Record<string, unknown>[]).flatMap((e) => (typeof e[champ] === 'string' && e[champ] ? [e[champ]] : [])))];
}

/** `valeursDistinctes` de `ds` (absent : aucune suggestion), recalculées à chaque écriture au seam
 *  (`useVersionDesDatasets`). */
export function useValeursDistinctes(ds: DatasetKey, champ: string): string[];
export function useValeursDistinctes(ds: DatasetKey | undefined, champ: string): string[] | undefined;
export function useValeursDistinctes(ds: DatasetKey | undefined, champ: string): string[] | undefined {
  const version = useVersionDesDatasets();
  return useMemo(() => (ds ? valeursDistinctes(ds, champ) : undefined), [ds, champ, version]);
}

/** Mode `vocab` : `<input list>` + `<datalist>` des valeurs distinctes d'un champ `'<ds>.<champ>'`. */
function VocabField(
  { label, title, ariaLabel, invalide, describedBy, vocabFrom, value, onChange, nullable, noeud }:
  Accessibilite & { label?: string; title?: string; vocabFrom: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean; noeud?: unknown },
) {
  const [ds, field] = vocabFrom.split('.') as [DatasetKey, string];
  const distinctes = useValeursDistinctes(ds, field);
  const values = useMemo(() => [...distinctes].sort(), [distinctes]);
  return (
    <div className="ed-field" title={title}>
      <span>{label}{indiceDe('valeurs déjà saisies, ou saisie libre')}</span>
      <SaisieSuggeree suggestions={values} value={(value as string) ?? ''}
        ariaLabel={ariaLabel} invalide={invalide} describedBy={describedBy}
        onChange={(v) => onChange(v === '' && nullable ? videDuNoeud(noeud) : v)} />
    </div>
  );
}

/** Suggestions PARTAGÉES par les saisies d'un même champ (une rangée par valeur d'une liste) : UNE
 *  `<datalist>`, que l'appelant rend une fois (`datalist`) et que chaque `SaisieSuggeree` désigne. */
export interface SuggestionsPartagees { readonly id: string }
export function useSuggestionsPartagees(suggestions: readonly string[] | undefined): { partagees?: SuggestionsPartagees; datalist: JSX.Element | null } {
  const id = useId();
  const partagees = useMemo(() => ({ id }), [id]);
  return suggestions ? { partagees, datalist: <ListeDeSuggestions id={id} suggestions={suggestions} /> } : { datalist: null };
}

function ListeDeSuggestions({ id, suggestions }: { id: string; suggestions: readonly string[] }) {
  return <datalist id={id}>{suggestions.map((s, i) => <option key={i} value={s} />)}</datalist>;
}

/** Saisie LIBRE à suggestions : `<input list>` + sa `<datalist>` (une par instance, `useId`), une option
 *  par suggestion, ou la datalist PARTAGÉE d'un champ (`useSuggestionsPartagees`) ; `suggestions`
 *  absentes, un `<input>` nu. La saisie brute s'émet telle quelle. */
export function SaisieSuggeree(
  { suggestions, value, onChange, ariaLabel, invalide, describedBy }:
  Accessibilite & { suggestions?: readonly string[] | SuggestionsPartagees; value: string; onChange: (v: string) => void },
) {
  const dlId = useId();
  const propres = Array.isArray(suggestions) ? suggestions as readonly string[] : undefined;
  const liste = propres ? dlId : (suggestions as SuggestionsPartagees | undefined)?.id;
  return (
    <>
      <input
        list={liste} value={value}
        aria-label={ariaLabel} aria-invalid={invalide || undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)} />
      {propres && <ListeDeSuggestions id={dlId} suggestions={propres} />}
    </>
  );
}

/** Mode `liste` (défaut) : `Ref[]` = {id, value?} — choix dans le dataset, +Ajouter / ✕, `value` (Indice) si `cfg.value`. */
function ListRefField(
  { label, cfg, champ, value, onChange }:
  { label?: string; cfg: { ds: DatasetKey; value?: boolean }; champ: Champ; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg, champ.noeud, useUnivers(cfg.ds, champ.entreesEnTete));
  const list = (value as RefEntry[]) ?? [];
  const set = (next: RefEntry[]) => onChange(next);
  return (
    <div className="ed-field" title={champ.title}>
      <span>{label}{indiceDe(nomDistinct(label, libelleDeDataset(cfg.ds)))}</span>
      {list.map((ref, i) => (
        <div key={i} className="fieldrow">
          <select value={ref.id} onChange={(e) => set(list.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}>
            {ref.id === '' && <option value="">— (choisir) —</option>}
            {ref.id !== '' && !options.some((o) => o.v === ref.id) && <option value={ref.id}>{ref.id} (inconnu)</option>}
            {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          {cfg.value && (
            <NumberField
              variant="nu" label={`Indice — ${label}`} placeholder="Indice" width={64}
              vide value={ref.value} onChange={(n) => set(list.map((r, j) => (j === i ? { ...r, value: n ?? undefined } : r)))}
            />
          )}
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: '' }])}>+ Ajouter</button>
    </div>
  );
}

/** Nom d'AUTEUR de la source de chaque registre désigné, affiché au sélecteur. */
export const SOURCE_NARRATIVE: { readonly [R in RegistreReference]: string } = {
  affaires: 'affaires de la campagne',
  indices: 'indices de la campagne',
  presetsPnj: 'PNJ de la campagne',
  documents: 'documents de la campagne',
  etats: 'états de la campagne',
};

/** Sélecteur UNIQUE d'une référence narrative : mode `single` de `RefField` sur les entrées du registre
 *  que désigne `cle`. */
export function RefNarrativeField({ cle, narratif, label, value, onChange, nullable, aucunIneligible }: {
  cle: CleDeReferenceNarrative;
  narratif: NarratifBlock;
  label: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  nullable?: boolean;
  aucunIneligible?: boolean;
}) {
  return (
    <RefField
      cfg={{ entrees: entreesNarratives(narratif, cle), nom: SOURCE_NARRATIVE[REFERENCES_NARRATIVES[cle]] }}
      label={label}
      value={value ?? ''}
      onChange={(v) => onChange(typeof v === 'string' && v !== '' ? v : undefined)}
      nullable={nullable}
      aucunIneligible={aucunIneligible}
    />
  );
}
