/**
 * Picker DEV de RÉFÉRENCE unifié au Codex — UN composant, 4 modes, configuré par (catégorie, champ) :
 *  - `liste`    : `Ref[]` = {id, value?} (sorts d'une créature, Bénédictions/Miracles d'un dieu, Qualités
 *                 d'une possession) — choix dans le dataset cible, LIBELLÉ affiché mais `id` STABLE stocké ;
 *  - `single`   : UN `<select>` (sous-type d'arme, classe d'une carrière, espèce/carrière d'un pré-tiré…),
 *                 sur un dataset OU sur des entrées fournies (`entrees` : registre du narratif d'un
 *                 projet, `RefNarrativeField`) ;
 *  - `freeText` : `single` + `<input list>`/`<datalist>` (au lieu d'un `<select>` strict) — pioche par
 *                 LIBELLÉ (id stocké) OU saisie libre hors catalogue (objet/outil CUSTOM, valeur brute
 *                 conservée, résolue côté runtime par un repli `name`) ;
 *  - `vocab`    : `<input list>` + `<datalist>` des valeurs DISTINCTES d'un champ (refChar/refCareer/subType…)
 *                 → pioche OU saisie libre (mais la LISTE elle-même vient d'un champ, pas d'ids de dataset).
 * On stocke partout l'`id` (ou la valeur de `valueKey`) — multilangue-safe (cf.
 * `CLAUDE.md` § Pour TOUT agent). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useMemo } from 'react';
import { datasetArray, type DatasetKey } from '../../data/overrides';
import { creatureLabel } from '../../data';
import { REFERENCES_NARRATIVES, type RegistreReference } from '../../data/schemas/defs-scenes/registres-narratifs';
import type { NarratifBlock } from '../../state/campaignNarratif';
import { NumberField } from '../NumberField';
import { CATEGORY_DATASET_DERIVE } from '../../data/schemas/exposition-derivee';
import { categoryByKey } from './registry';

/** Entrées FOURNIES par l'appelant (mode `single`) quand leur source n'est pas un dataset du catalogue :
 *  un registre du narratif d'un projet, les stades d'un indice. `nom` = la source, affichée en indice. */
type CfgDEntrees = { entrees: readonly { id: string; label: string }[]; nom: string };
type CfgDeDataset = { ds: DatasetKey; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name'; spec?: boolean; filter?: (entry: Record<string, unknown>) => boolean };

/** Config d'un champ-réf, par (catégorie, champ). Dataset réel (liste/single), vocabulaire d'un champ, OU
 *  entrées fournies (`single`). */
export type RefFieldCfg =
  | (CfgDeDataset & { value?: boolean; single?: boolean; freeText?: boolean })
  | { vocabFrom: string }
  | CfgDEntrees;

/**
 * REF_FIELD — clés par `'<catégorie>.<champ>'` (priorité) ou par `'<champ>'` (repli global).
 *  - listes (comportement existant conservé) : sorts/bénédictions/miracles, qualités (Indice), manœuvres ;
 *  - single (dataset réel) : sous-type d'arme, classe, carrière (niveau/pré-tiré), parent de lieu (par
 *    label), espèce d'un pré-tiré, compétence/talent ajouté par un talent (+ spec libre) ;
 *  - vocab : caracs/carrières de référence d'une espèce, sous-type d'une qualité.
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
  'locations.parent': { ds: 'locations', single: true, valueKey: 'label' },
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
  // Matière des flancs d'un terrain à BLOC PLEIN (#1691) : le champ porte un id de `materials.json`
  // du domaine `relief` (`idDe('material', 'relief')` au schéma) — le sélecteur n'offre donc QUE ce
  // domaine, une couverture de toit ou une matière de décor n'ayant rien à faire sur une falaise.
  'terrains.matiere': { ds: 'materials', single: true, filter: (e) => e.domain === 'relief' },
  // Couverture par défaut d'un bâtiment (#1715) : le champ porte un id de `materials.json` du domaine
  // `roof` (`idDe('material', 'roof')` au schéma) — le sélecteur n'offre donc QUE ce domaine, une
  // matière de relief ou de décor n'ayant rien à faire sur une nappe de toit.
  'buildings.roofMaterial': { ds: 'materials', single: true, filter: (e) => e.domain === 'roof' },
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

/** Libellé d'affichage d'une entrée (maladies → `name`, sinon `label`). */
const entryLabel = (e: Record<string, unknown>, labelOf: 'label' | 'name' = 'label'): string =>
  String(e[labelOf] ?? e.label ?? e.id ?? '');
/** Valeur stockée d'une entrée (lieux keyés par `label` → `label`, sinon `id`). */
const valueOf = (e: Record<string, unknown>, valueKey: 'id' | 'label' | 'abr' = 'id'): string =>
  String(e[valueKey] ?? '');

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

export function RefField(
  { cfg, fieldKey, label, value, onChange, nullable, aucunIneligible, nu }:
  {
    cfg: RefFieldCfg; categoryKey?: string; fieldKey?: string; label?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean;
    /** Mode `single` + `nullable` : l'option « (aucun) » est montrée mais INÉLIGIBLE (le champ vide
     *  laisserait le porteur sans ce qu'il exige, #1882). */
    aucunIneligible?: boolean;
    /** Mode `single` : le CONTRÔLE NU, sans libellé visible (`label` devient son nom accessible) — pour
     *  un champ composé qui porte déjà le sien (patron `NumberField variant="nu"`). */
    nu?: boolean;
  },
) {
  // `label` = AFFICHAGE (libellé FR du champ, #1466) ; `fieldKey`/`cfg` restent l'IDENTITé. Un appelant
  // qui ne connaît que la clé affiche la clé.
  const affiche = label ?? fieldKey;
  if (isVocab(cfg)) return <VocabField label={affiche} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} />;
  const single = <SingleRefField label={affiche} cfg={cfg} value={value} onChange={onChange} nullable={nullable} aucunIneligible={aucunIneligible} nu={nu} />;
  if ('entrees' in cfg) return single;
  if (cfg.freeText) return <FreeRefField label={affiche} cfg={cfg} value={value} onChange={onChange} />;
  if (cfg.single) return single;
  return <ListRefField label={affiche} cfg={cfg} value={value} onChange={onChange} />;
}

/** Options d'un champ-réf (valeur stockée + libellé) : dataset trié par libellé, ou entrées fournies
 *  dans leur ordre déclaré. */
function useOptions(cfg: CfgDeDataset | CfgDEntrees) {
  const ds = 'ds' in cfg ? cfg : undefined;
  const duDataset = useMemo(
    () => ds
      ? (datasetArray(ds.ds) as Record<string, unknown>[])
        .filter((e) => (ds.filter ? ds.filter(e) : true))
        .map((e) => ({ v: valueOf(e, ds.valueKey), label: entryLabel(e, ds.labelOf) }))
        .sort((a, b) => a.label.localeCompare(b.label))
      : [],
    [ds?.ds, ds?.valueKey, ds?.labelOf, ds?.filter],
  );
  return 'entrees' in cfg ? cfg.entrees.map((e) => ({ v: e.id, label: e.label })) : duDataset;
}

/** Mode `single` : UN `<select>` (+ option « — (aucun) — » si nullable, option « (inconnu) » si hors liste).
 *  `spec` → un `<input>` texte à côté, on stocke `{ id, spec? }` (spec omis si vide) ; sinon la chaîne brute. */
function SingleRefField(
  { label, cfg, value, onChange, nullable, aucunIneligible, nu }:
  { label?: string; cfg: CfgDeDataset | CfgDEntrees; value: unknown; onChange: (v: unknown) => void; nullable?: boolean; aucunIneligible?: boolean; nu?: boolean },
) {
  const options = useOptions(cfg);
  const nom = 'entrees' in cfg ? cfg.nom : libelleDeDataset(cfg.ds);
  const avecSpec = 'spec' in cfg && !!cfg.spec;
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
  const controle = (
    <span className="de-reflrow">
      <select aria-label={nu ? label : undefined} value={id} onChange={(e) => emit(e.target.value, cur.spec)}>
        {nullable && <option value="" disabled={aucunIneligible}>— (aucun) —</option>}
        {!nullable && id === '' && <option value="">{nom ? `— (choisir dans ${nom}) —` : '— (choisir) —'}</option>}
        {id !== '' && !known && <option value={id}>{id} (inconnu)</option>}
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      {avecSpec && (
        <input placeholder="spec" style={{ width: 120 }} value={cur.spec ?? ''}
          onChange={(e) => emit(id, e.target.value || undefined)} />
      )}
    </span>
  );
  if (nu) return controle;
  return (
    <label className="ed-field">
      <span>{label}{indiceDe(nom)}</span>
      {controle}
    </label>
  );
}

/** Mode `single` + `freeText` : `<input list>` + `<datalist>` du dataset — pioche par LIBELLÉ (id
 *  stocké) OU saisie libre hors catalogue (objet/outil CUSTOM, valeur brute conservée telle quelle,
 *  résolue côté runtime par un repli `name`). Calque le patron `hasItem`/`test.tool` existant. */
function FreeRefField(
  { label, cfg, value, onChange }:
  { label?: string; cfg: { ds: DatasetKey; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name' }; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg);
  const cur = typeof value === 'string' ? value : '';
  const dlId = `dl-free-${cfg.ds}`;
  const shown = options.find((o) => o.v === cur)?.label ?? cur;
  return (
    <div className="ed-field">
      <span>{label}{indiceDe([libelleDeDataset(cfg.ds), 'ou saisie libre'].filter(Boolean).join(', '))}</span>
      <input
        list={dlId} defaultValue={shown} key={cur}
        onChange={(e) => {
          const v = e.target.value.trim();
          const match = options.find((o) => o.label.toLowerCase() === v.toLowerCase());
          onChange(match ? match.v : v || undefined);
        }}
      />
      <datalist id={dlId}>{options.map((o) => <option key={o.v} value={o.label} />)}</datalist>
    </div>
  );
}

/** Mode `vocab` : `<input list>` + `<datalist>` des valeurs distinctes d'un champ `'<ds>.<champ>'`. */
function VocabField(
  { label, vocabFrom, value, onChange, nullable }:
  { label?: string; vocabFrom: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
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
        onChange={(e) => onChange(e.target.value === '' && nullable ? null : e.target.value)} />
      <datalist id={dlId}>{values.map((v) => <option key={v} value={v} />)}</datalist>
    </div>
  );
}

/** Mode `liste` (défaut) : `Ref[]` = {id, value?} — choix dans le dataset, +Ajouter / ✕, `value` (Indice) si `cfg.value`. */
function ListRefField(
  { label, cfg, value, onChange }:
  { label?: string; cfg: { ds: DatasetKey; value?: boolean; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name' }; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg);
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

/** Libellé d'AFFICHAGE d'une entrée de chaque registre désigné par une référence narrative ; l'id reste
 *  la valeur manipulée. Un registre désigné sans libellé ne compile pas. */
export const LIBELLE_NARRATIF: { readonly [R in RegistreReference]: (e: NarratifBlock[R][number]) => string } = {
  affaires: (a) => a.titre,
  indices: (i) => i.titre,
  presetsPnj: (p) => p.profil?.label ?? (p.base ? creatureLabel(p.base) : p.id),
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
