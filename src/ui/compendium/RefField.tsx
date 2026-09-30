/**
 * Picker DEV de RÉFÉRENCE unifié au Codex — UN composant, 4 modes, configuré par (catégorie, champ) :
 *  - `liste`    : `Ref[]` = {id, value?} (sorts d'une créature, Bénédictions/Miracles d'un dieu, Qualités
 *                 d'une possession) — choix dans le dataset cible, LIBELLÉ affiché mais `id` STABLE stocké ;
 *  - `single`   : UN `<select>` (sous-type d'arme, classe d'une carrière, espèce/carrière d'un pré-tiré…) ;
 *  - `freeText` : `single` + `<input list>`/`<datalist>` (au lieu d'un `<select>` strict) — pioche par
 *                 LIBELLÉ (id stocké) OU saisie libre hors catalogue (objet/outil CUSTOM, valeur brute
 *                 conservée, résolue côté runtime par un repli `name`) ;
 *  - `vocab`    : `<input list>` + `<datalist>` des valeurs DISTINCTES d'un champ (refChar/refCareer/subType…)
 *                 → pioche OU saisie libre (mais la LISTE elle-même vient d'un champ, pas d'ids de dataset).
 * On stocke partout l'`id` — multilangue-safe (cf.
 * `CLAUDE.md` § Pour TOUT agent). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useMemo, useState } from 'react';
import { datasetArray, type DatasetKey } from '../../data/overrides';
import { NumberField } from '../NumberField';

type RefDatasetCfg = { ds: DatasetKey; filter?: (entry: Record<string, unknown>) => boolean };
/** Mode `liste` : une rangée par réf, aucun contrôle unique. */
type ListeRefCfg = RefDatasetCfg & { value?: boolean; single?: false; freeText?: false };
/** Mode `single` avec `spec` : le `<select>` ET l'`<input>` de spécialisation, aucun contrôle unique. */
type SpecRefCfg = RefDatasetCfg & { single: true; freeText?: false; spec: true };
/** Config dont le rendu est UN contrôle : il porte le nom accessible, l'invalidité et la description. */
export type RefFieldCfgUnique =
  | (RefDatasetCfg & { single: true; freeText?: false; spec?: false })
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

/** Libellé d'affichage d'une entrée. */
const entryLabel = (e: Record<string, unknown>): string =>
  String(e.label ?? e.id ?? '');

interface RefEntry { id: string; value?: number }
interface SpecRef { id: string; spec?: string }

type RefFieldCommun = { categoryKey?: string; fieldKey?: string; label?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean };
/** Nom accessible, invalidité et description du contrôle rendu. */
type Accessibilite = { ariaLabel?: string; invalide?: boolean; describedBy?: string };

/** Un contrôle UNIQUE (`single` sans `spec`, `freeText`, `vocab`) porte `Accessibilite` ; la `liste` et le
 *  `single` à `spec` n'en rendent aucun à qui la poser, et l'appel qui la passerait ne compile pas. */
export function RefField(props: RefFieldCommun & Accessibilite & { cfg: RefFieldCfgUnique }): JSX.Element;
export function RefField(props: RefFieldCommun & { cfg: RefFieldCfg; ariaLabel?: never; invalide?: never; describedBy?: never }): JSX.Element;
export function RefField(
  { cfg, fieldKey, label, ariaLabel, value, onChange, nullable, invalide, describedBy }:
  RefFieldCommun & Accessibilite & { cfg: RefFieldCfg },
) {
  // `label` = AFFICHAGE (libellé FR du champ, #1466) ; `fieldKey`/`cfg` restent l'IDENTITé. Un appelant
  // qui ne connaît que la clé affiche la clé.
  const affiche = label ?? fieldKey;
  const a11y = { ariaLabel, invalide, describedBy };
  if (isVocab(cfg)) return <VocabField label={affiche} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} {...a11y} />;
  if (cfg.freeText) return <FreeRefField label={affiche} cfg={cfg} value={value} onChange={onChange} {...a11y} />;
  if (cfg.single) return <SingleRefField label={affiche} cfg={cfg} value={value} onChange={onChange} nullable={nullable} {...a11y} />;
  return <ListRefField label={affiche} cfg={cfg} value={value} onChange={onChange} />;
}

/** Options triées d'un dataset (valeur stockée + libellé), pour single/liste. */
function useOptions(cfg: { ds: DatasetKey; filter?: (entry: Record<string, unknown>) => boolean }) {
  return useMemo(
    () => (datasetArray(cfg.ds) as Record<string, unknown>[])
      .filter((e) => (cfg.filter ? cfg.filter(e) : true))
      .map((e) => ({ v: String(e.id ?? ''), label: entryLabel(e) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [cfg.ds, cfg.filter],
  );
}

/** Mode `single` : UN `<select>` (+ option « — (aucun) — » si nullable, option « (inconnu) » si hors liste).
 *  `spec` → un `<input>` texte à côté, on stocke `{ id, spec? }` (spec omis si vide) ; sinon la chaîne brute. */
function SingleRefField(
  { label, ariaLabel, cfg, value, onChange, nullable, invalide, describedBy }:
  Accessibilite & { label?: string; cfg: { ds: DatasetKey; spec?: boolean; filter?: (entry: Record<string, unknown>) => boolean }; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
) {
  const options = useOptions(cfg);
  const cur: SpecRef = cfg.spec
    ? (value && typeof value === 'object' ? (value as SpecRef) : { id: typeof value === 'string' ? value : '' })
    : { id: typeof value === 'string' ? value : '' };
  const id = cur.id ?? '';
  const known = id === '' || options.some((o) => o.v === id);
  const emit = (nextId: string, nextSpec?: string) => {
    if (nextId === '') { onChange(nullable ? null : ''); return; }
    if (cfg.spec) { const v: SpecRef = { id: nextId }; if (nextSpec) v.spec = nextSpec; onChange(v); }
    else onChange(nextId);
  };
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (réf {cfg.ds})</em></span>
      <div className="de-reflrow">
        <select aria-label={ariaLabel} aria-invalid={invalide || undefined} aria-describedby={describedBy} value={id} onChange={(e) => emit(e.target.value, cur.spec)}>
          {nullable && <option value="">— (aucun) —</option>}
          {!nullable && id === '' && <option value="">— (choisir dans {cfg.ds}) —</option>}
          {id !== '' && !known && <option value={id}>{id} (inconnu)</option>}
          {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        {cfg.spec && (
          <input placeholder="spec" style={{ width: 120 }} value={cur.spec ?? ''}
            onChange={(e) => emit(id, e.target.value || undefined)} />
        )}
      </div>
    </div>
  );
}

/** Mode `single` + `freeText` : `<input list>` + `<datalist>` du dataset — pioche par LIBELLÉ (id
 *  stocké) OU saisie libre hors catalogue (objet/outil CUSTOM, valeur brute conservée telle quelle,
 *  résolue côté runtime par un repli `name`). Calque le patron `hasItem`/`test.tool` existant.
 *  Le texte saisi vit ICI : il ne se recale sur `value` que lorsqu'elle diffère de la dernière valeur
 *  que le champ a émise, jamais à chaque frappe. */
function FreeRefField(
  { label, ariaLabel, invalide, describedBy, cfg, value, onChange }:
  Accessibilite & { label?: string; cfg: { ds: DatasetKey }; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg);
  const cur = typeof value === 'string' ? value : '';
  const dlId = `dl-free-${cfg.ds}`;
  const shown = options.find((o) => o.v === cur)?.label ?? cur;
  const [texte, setTexte] = useState(shown);
  const [connue, setConnue] = useState(cur);
  if (cur !== connue) {
    setConnue(cur);
    setTexte(shown);
  }
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (réf {cfg.ds}, ou saisie libre)</em></span>
      <input
        list={dlId} value={texte}
        aria-label={ariaLabel} aria-invalid={invalide || undefined} aria-describedby={describedBy}
        onChange={(e) => {
          const brut = e.target.value;
          const v = brut.trim();
          const match = options.find((o) => o.label.toLowerCase() === v.toLowerCase());
          const emise = match ? match.v : v || undefined;
          setTexte(brut);
          setConnue(emise ?? '');
          onChange(emise);
        }}
      />
      <datalist id={dlId}>{options.map((o) => <option key={o.v} value={o.label} />)}</datalist>
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
      <span>{label}<em className="de-hint"> (vocabulaire {ds}.{field})</em></span>
      <input list={dlId} value={(value as string) ?? ''}
        aria-label={ariaLabel} aria-invalid={invalide || undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value === '' && nullable ? null : e.target.value)} />
      <datalist id={dlId}>{values.map((v) => <option key={v} value={v} />)}</datalist>
    </div>
  );
}

/** Mode `liste` (défaut) : `Ref[]` = {id, value?} — choix dans le dataset, +Ajouter / ✕, `value` (Indice) si `cfg.value`. */
function ListRefField(
  { label, cfg, value, onChange }:
  { label?: string; cfg: { ds: DatasetKey; value?: boolean }; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg);
  const list = (value as RefEntry[]) ?? [];
  const set = (next: RefEntry[]) => onChange(next);
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (réf {cfg.ds} par id)</em></span>
      {list.map((ref, i) => (
        <div key={i} className="de-reflrow">
          <select value={ref.id} onChange={(e) => set(list.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}>
            {ref.id === '' && <option value="">— (choisir dans {cfg.ds}) —</option>}
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
