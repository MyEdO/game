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
 * On stocke partout l'`id` — multilangue-safe (cf.
 * `CLAUDE.md` § Pour TOUT agent). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useId, useMemo, useState } from 'react';
import { datasetArray, type DatasetKey } from '../../data/overrides';
import { ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { estFeuilleDId, refusDeLEntree, declarationDeFeuilleDId, type FeuilleDId } from '../../data/schemas/grammaire/ref';
import { creatureLabel } from '../../data';
import { REFERENCES_NARRATIVES, type CleDeRegistreNarratif, type RegistreReference } from '../../data/schemas/defs-scenes/registres-narratifs';
import type { NarratifBlock } from '../../state/campaignNarratif';
import { NumberField } from '../NumberField';
import { CATEGORY_DATASET_DERIVE } from '../../data/schemas/exposition-derivee';
import { categoryByKey } from './registry';

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
 *  les appelants directs du composant, jamais ici.
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
  'pregens.species': { ds: 'species', single: true },
  'pregens.career': { ds: 'careers', single: true },
  // Caractéristique d'une compétence : SÉLECTEUR (pas d'input libre) — `skills.json` stocke l'`id` du
  // dataset `characteristics` (mesuré : 10/10 valeurs distinctes résolues par `id`, 0/10 par `abr` ou
  // `label`), donc valeur d'option = `id` (défaut). `abr` y est vide sur 7 des 19 entrées.
  'skills.characteristic': { ds: 'characteristics', single: true },
  // Décor posé sur chaque case d'un terrain (#1690) : le champ porte un id de `props.json`
  // (`idDe('prop')` au schéma) — SÉLECTEUR dans le catalogue, jamais un champ texte où une faute de
  // frappe ne se verrait qu'au refus de parse. Facultatif : `nullable` ouvre le choix vide.
  'terrains.overlayProp': { ds: 'props', single: true },
  // Matière des flancs d'un terrain à BLOC PLEIN (#1691) et couverture par défaut d'un bâtiment
  // (#1715) : ids de `materials.json`, restreints à la sous-liste que déclare la feuille du champ
  // (`idDe('material', 'relief')`, `idDe('material', 'roof')`), lue sur le nœud.
  'terrains.matiere': { ds: 'materials', single: true },
  'buildings.roofMaterial': { ds: 'materials', single: true },
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

/** `noeud` : le nœud de schéma du champ — sa feuille `idDe` restreint les options à sa sous-liste.
 *  `entreesEnTete` : entrées hors dataset (objets du projet édité), résolues AVANT lui — à id égal, elles priment. */
type RefFieldCommun = {
  categoryKey?: string; fieldKey?: string; label?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean;
  noeud?: unknown; entreesEnTete?: readonly { readonly id: string }[];
  /** Mode `single` + `nullable` : l'option « (aucun) » est montrée mais INÉLIGIBLE (le champ vide
   *  laisserait le porteur sans ce qu'il exige, #1882). */
  aucunIneligible?: boolean;
};
/** Nom accessible, invalidité et description du contrôle rendu. */
type Accessibilite = { ariaLabel?: string; invalide?: boolean; describedBy?: string };

/** Un contrôle UNIQUE (`single` sans `spec`, `freeText`, `vocab`) porte `Accessibilite` ; la `liste` et le
 *  `single` à `spec` n'en rendent aucun à qui la poser, et l'appel qui la passerait ne compile pas. */
export function RefField(props: RefFieldCommun & Accessibilite & { cfg: RefFieldCfgUnique }): JSX.Element;
export function RefField(props: RefFieldCommun & { cfg: RefFieldCfg; ariaLabel?: never; invalide?: never; describedBy?: never }): JSX.Element;
export function RefField(
  { cfg, fieldKey, label, ariaLabel, value, onChange, nullable, aucunIneligible, invalide, describedBy, noeud, entreesEnTete = SANS_ENTREE }:
  RefFieldCommun & Accessibilite & { cfg: RefFieldCfg },
) {
  // `label` = AFFICHAGE (libellé FR du champ, #1466) ; `fieldKey`/`cfg` restent l'IDENTITé. Un appelant
  // qui ne connaît que la clé affiche la clé.
  const affiche = label ?? fieldKey;
  const a11y = { ariaLabel, invalide, describedBy };
  const champ = { noeud, entreesEnTete };
  if (isVocab(cfg)) return <VocabField label={affiche} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} {...a11y} />;
  const single = (c: SingleCfg) => <SingleRefField label={affiche} cfg={c} champ={champ} value={value} onChange={onChange} nullable={nullable} aucunIneligible={aucunIneligible} {...a11y} />;
  if (fournies(cfg)) return single(cfg);
  if (cfg.freeText) return <FreeRefField label={affiche} cfg={cfg} champ={champ} value={value} onChange={onChange} {...a11y} />;
  if (cfg.single) return single(cfg);
  return <ListRefField label={affiche} cfg={cfg} champ={champ} value={value} onChange={onChange} />;
}

/** Le nœud de schéma d'un champ-réf et ses entrées hors dataset (`RefFieldCommun`). */
type Champ = { noeud: unknown; entreesEnTete: readonly { readonly id: string }[] };
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
 *  fournies) dont elles ne prennent pas l'id. */
function useUnivers(source: DatasetKey | EntreesCfg['entrees'], entreesEnTete: Champ['entreesEnTete']): readonly Entree[] {
  return useMemo(() => {
    const enTete = entreesEnTete.map((e) => ({ id: e.id, e: e as Record<string, unknown> }));
    const pris = new Set(enTete.map((x) => x.id));
    const entrees = (typeof source === 'string' ? datasetArray(source) : source) as Record<string, unknown>[];
    const deLaSource = entrees.map((e) => ({ id: String(e.id ?? ''), e })).filter((x) => !pris.has(x.id));
    return [...enTete, ...deLaSource];
  }, [source, entreesEnTete]);
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
  const deDataset = 'ds' in cfg ? cfg : undefined;
  const univers = useUnivers(deDataset ? deDataset.ds : (cfg as EntreesCfg).entrees, champ.entreesEnTete);
  const options = useOptions(deDataset ?? SANS_FILTRE, champ.noeud, univers, deDataset !== undefined);
  const nom = deDataset ? libelleDeDataset(deDataset.ds) : (cfg as EntreesCfg).nom;
  const avecSpec = !!deDataset?.spec;
  const cur: SpecRef = avecSpec
    ? (value && typeof value === 'object' ? (value as SpecRef) : { id: typeof value === 'string' ? value : '' })
    : { id: typeof value === 'string' ? value : '' };
  const id = cur.id ?? '';
  const known = id === '' || options.some((o) => o.v === id);
  const emit = (nextId: string, nextSpec?: string) => {
    if (nextId === '') { onChange(nullable ? null : ''); return; }
    if (avecSpec) { const v: SpecRef = { id: nextId }; if (nextSpec) v.spec = nextSpec; onChange(v); }
    else onChange(nextId);
  };
  // UN contrôle : le libellé visible le NOMME (`<label>`). Avec `spec`, deux contrôles : un `<div>`.
  const Enveloppe = avecSpec ? 'div' : 'label';
  return (
    <Enveloppe className="ed-field">
      <span>{label}{indiceDe(nom)}</span>
      <div className="de-reflrow">
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
  const dlId = useId();
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
    <div className="ed-field">
      <span>{label}{indiceDe([libelleDeDataset(cfg.ds), 'ou saisie libre'].filter(Boolean).join(', '))}</span>
      <input
        list={dlId} value={texte}
        aria-label={ariaLabel} aria-invalid={invalide || refus !== null || undefined}
        aria-describedby={[describedBy, refus === null ? undefined : idRefus].filter(Boolean).join(' ') || undefined}
        onChange={(e) => {
          const brut = e.target.value;
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
      <datalist id={dlId}>{options.map((o) => <option key={o.v} value={o.label} />)}</datalist>
      {refus !== null && <span id={idRefus} className="hint" role="status">{refus}</span>}
    </div>
  );
}

/** Mode `vocab` : `<input list>` + `<datalist>` des valeurs distinctes d'un champ `'<ds>.<champ>'`. */
function VocabField(
  { label, ariaLabel, invalide, describedBy, vocabFrom, value, onChange, nullable }:
  Accessibilite & { label?: string; vocabFrom: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
) {
  const [ds, field] = vocabFrom.split('.') as [DatasetKey, string];
  const dlId = `dl-vocab-${ds}-${field}`;
  const values = useMemo(
    () => [...new Set((datasetArray(ds) as Record<string, unknown>[]).map((e) => e[field]).filter(Boolean) as string[])].sort(),
    [ds, field],
  );
  return (
    <div className="ed-field">
      <span>{label}{indiceDe('valeurs déjà saisies, ou saisie libre')}</span>
      <input list={dlId} value={(value as string) ?? ''}
        aria-label={ariaLabel} aria-invalid={invalide || undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value === '' && nullable ? null : e.target.value)} />
      <datalist id={dlId}>{values.map((v) => <option key={v} value={v} />)}</datalist>
    </div>
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
    <div className="ed-field">
      <span>{label}{indiceDe(libelleDeDataset(cfg.ds))}</span>
      {list.map((ref, i) => (
        <div key={i} className="de-reflrow">
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

/** Clé d'une référence narrative (`REFERENCES_NARRATIVES`). */
export type CleDeReferenceNarrative = keyof typeof REFERENCES_NARRATIVES;

/** Libellé d'AFFICHAGE d'une entrée de chaque registre du narratif ; l'id reste la valeur manipulée.
 *  Un registre sans libellé ne compile pas. */
export const LIBELLE_NARRATIF: { readonly [R in CleDeRegistreNarratif]: (e: NarratifBlock[R][number]) => string } = {
  affaires: (a) => a.titre,
  indices: (i) => i.titre,
  presetsPnj: (p) => p.profil?.label ?? (p.base ? creatureLabel(p.base) : p.id),
  objets: (o) => o.label,
  documents: (d) => d.titre,
};

/** Les stades de l'indice `indiceId`, chacun libellé par son RANG (« stade 2 », comme au formulaire de
 *  l'indice) ; l'id reste la valeur manipulée. */
export function entreesDeStades(narratif: NarratifBlock, indiceId: string | undefined): { id: string; label: string }[] {
  return (narratif.indices.find((i) => i.id === indiceId)?.stades ?? []).map((s, i) => ({ id: s.id, label: `stade ${i + 1}` }));
}

/** Libellé du stade `id` de l'indice `indiceId` — `undefined` s'il ne résout pas. */
export const libelleDeStade = (narratif: NarratifBlock, indiceId: string | undefined, id: string): string | undefined =>
  entreesDeStades(narratif, indiceId).find((e) => e.id === id)?.label;

/** Nom d'AUTEUR de la source de chaque registre désigné, affiché au sélecteur. */
export const SOURCE_NARRATIVE: { readonly [R in RegistreReference]: string } = {
  affaires: 'affaires de la campagne',
  indices: 'indices de la campagne',
  presetsPnj: 'PNJ de la campagne',
  documents: 'documents de la campagne',
};

/** Les entrées (id + libellé) du registre que désigne `cle`, lu à `REFERENCES_NARRATIVES`. */
export function entreesNarratives(narratif: NarratifBlock, cle: CleDeReferenceNarrative): { id: string; label: string }[] {
  const registre = REFERENCES_NARRATIVES[cle];
  const libelle = LIBELLE_NARRATIF[registre] as (e: { id: string }) => string;
  return (narratif[registre] as readonly { id: string }[]).map((e) => ({ id: e.id, label: libelle(e) }));
}

/** Libellé de l'entrée `id` du registre que désigne `cle` — `undefined` si elle ne résout pas. */
export const libelleNarratif = (narratif: NarratifBlock, cle: CleDeReferenceNarrative, id: string): string | undefined =>
  entreesNarratives(narratif, cle).find((e) => e.id === id)?.label;

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
