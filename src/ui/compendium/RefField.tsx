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
 * On stocke partout l'`id` (ou la valeur de `valueKey`) — multilangue-safe (cf.
 * `CLAUDE.md` § Pour TOUT agent). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useMemo, useState } from 'react';
import { useFocusRangeeNeuve } from '../useFocusRangeeNeuve';
import { datasetArray, typeDuDataset, type DatasetKey } from '../../data/overrides';
import { specCatalogOf, specLabel, specResolves, type SpecEntry, type SpecsSource } from '../../data';
import { entreeOuverte, type RefASpecialisation, type RegimeDePorteur } from '../../data/schemas/grammaire/ref';
import { NumberField } from '../NumberField';

/** Config d'un champ-réf, par (catégorie, champ). Dataset réel (liste/single) OU vocabulaire d'un champ. */
export type RefFieldCfg =
  | { ds: DatasetKey; value?: boolean; single?: boolean; freeText?: boolean; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name'; spec?: boolean; filter?: (entry: Record<string, unknown>) => boolean }
  | { vocabFrom: string };

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
type SpecRef = RefASpecialisation;

export function RefField(
  { cfg, fieldKey, label, value, onChange, nullable, regime }:
  { cfg: RefFieldCfg; categoryKey?: string; fieldKey?: string; label?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean; regime?: RegimeDePorteur },
) {
  // `label` = AFFICHAGE (libellé FR du champ, #1466) ; `fieldKey`/`cfg` restent l'IDENTITé. Un appelant
  // qui ne connaît que la clé affiche la clé.
  const affiche = label ?? fieldKey;
  if (isVocab(cfg)) return <VocabField label={affiche} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} />;
  if (cfg.freeText) return <FreeRefField label={affiche} cfg={cfg} value={value} onChange={onChange} />;
  if (cfg.single) return <SingleRefField label={affiche} cfg={cfg} value={value} onChange={onChange} nullable={nullable} regime={regime} />;
  return <ListRefField label={affiche} cfg={cfg} value={value} onChange={onChange} />;
}

/** Options triées d'un dataset (valeur stockée + libellé), pour single/liste. */
function useOptions(cfg: { ds: DatasetKey; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name'; filter?: (entry: Record<string, unknown>) => boolean }) {
  return useMemo(
    () => (datasetArray(cfg.ds) as Record<string, unknown>[])
      .filter((e) => (cfg.filter ? cfg.filter(e) : true))
      .map((e) => ({ v: valueOf(e, cfg.valueKey), label: entryLabel(e, cfg.labelOf) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [cfg.ds, cfg.valueKey, cfg.labelOf, cfg.filter],
  );
}

/** Mode `single` : UN `<select>` (+ option « — (aucun) — » si nullable, option « (inconnu) » si hors liste).
 *  `spec` → la spécialisation de la référence (`SpecDeRef`), on stocke `{ id, spec? | choix? }` ; sinon la
 *  chaîne brute. */
function SingleRefField(
  { label, cfg, value, onChange, nullable, regime = 'specSeule' }:
  { label?: string; cfg: { ds: DatasetKey; valueKey?: 'id' | 'label' | 'abr'; labelOf?: 'label' | 'name'; spec?: boolean; filter?: (entry: Record<string, unknown>) => boolean }; value: unknown; onChange: (v: unknown) => void; nullable?: boolean; regime?: RegimeDePorteur },
) {
  const options = useOptions(cfg);
  const cur: SpecRef = cfg.spec
    ? (value && typeof value === 'object' ? (value as SpecRef) : { id: typeof value === 'string' ? value : '' })
    : { id: typeof value === 'string' ? value : '' };
  const id = cur.id ?? '';
  const known = id === '' || options.some((o) => o.v === id);
  const emitId = (nextId: string) => {
    if (nextId === '') { onChange(nullable ? null : ''); return; }
    onChange(cfg.spec ? { id: nextId } : nextId);
  };
  return (
    <div className="ed-field">
      <span>{label}<em className="de-hint"> (réf {cfg.ds})</em></span>
      <div className="de-reflrow">
        <select value={id} onChange={(e) => emitId(e.target.value)}>
          {nullable && <option value="">— (aucun) —</option>}
          {!nullable && id === '' && <option value="">— (choisir dans {cfg.ds}) —</option>}
          {id !== '' && !known && <option value={id}>{id} (inconnu)</option>}
          {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        {cfg.spec && id !== '' && <SpecDeRef key={id} ds={cfg.ds} cur={cur} regime={regime} onChange={onChange} />}
      </div>
    </div>
  );
}

const CHOIX_LIBRE = '__choix';
const CHOIX_BORNE = '__borne';
const TEXTE_LIBRE = '__libre';

/** Spécialisation d'une référence : les specs du catalogue de l'entrée (`specCatalogOf`), la saisie libre
 *  si l'entrée est OUVERTE (`entreeOuverte`), l'emplacement `choix` (libre ou borné) si le régime du champ
 *  l'admet (`specOuChoixFacultatifs`). Rien sans catalogue. Une borne vide et un texte libre vide ne
 *  s'émettent pas : le mode tient dans l'état local jusqu'à la première valeur. */
function SpecDeRef({ ds, cur, regime, onChange }: { ds: DatasetKey; cur: SpecRef; regime: RegimeDePorteur; onChange: (v: SpecRef) => void }) {
  const [modeEnCours, setModeEnCours] = useState<typeof CHOIX_BORNE | typeof TEXTE_LIBRE | null>(null);
  const type = typeDuDataset(ds);
  const def = (datasetArray(ds) as { id: string; specs?: SpecEntry[]; specsSource?: SpecsSource }[]).find((e) => e.id === cur.id);
  const catalogue = def ? specCatalogOf(def) : [];
  const ouverte = !!type && entreeOuverte(type, cur.id);
  const aChoix = regime === 'specOuChoixFacultatifs';
  if (!catalogue.length && !ouverte && cur.spec == null && cur.choix == null && modeEnCours == null) return null;
  const libelle = (spec: string) => specLabel(ds, cur.id, spec);
  const resout = (spec: string) => !!def && specResolves(def, spec);
  const mode = cur.choix === true ? CHOIX_LIBRE
    : Array.isArray(cur.choix) ? CHOIX_BORNE
    : cur.spec == null ? modeEnCours ?? ''
    : resout(cur.spec) ? cur.spec
    : ouverte ? TEXTE_LIBRE : cur.spec;
  const choisir = (v: string) => {
    setModeEnCours(v === CHOIX_BORNE || v === TEXTE_LIBRE ? v : null);
    if (v === '' || v === CHOIX_BORNE || v === TEXTE_LIBRE) onChange({ id: cur.id });
    else if (v === CHOIX_LIBRE) onChange({ id: cur.id, choix: true });
    else onChange({ id: cur.id, spec: v });
  };
  const borne = Array.isArray(cur.choix) ? cur.choix : [];
  const basculer = (spec: string) => {
    const suivante = borne.includes(spec) ? borne.filter((x) => x !== spec) : [...borne, spec];
    setModeEnCours(CHOIX_BORNE);
    onChange(suivante.length ? { id: cur.id, choix: suivante } : { id: cur.id });
  };
  return (
    <>
      <select aria-label="Spécialisation" value={mode} onChange={(e) => choisir(e.target.value)}>
        <option value="">— (aucune spécialisation) —</option>
        {aChoix && <option value={CHOIX_LIBRE}>au choix du joueur</option>}
        {aChoix && catalogue.length > 0 && <option value={CHOIX_BORNE}>au choix parmi…</option>}
        {catalogue.map((spec) => <option key={spec} value={spec}>{libelle(spec)}</option>)}
        {ouverte && <option value={TEXTE_LIBRE}>autre (texte libre)</option>}
        {mode === cur.spec && cur.spec != null && !catalogue.includes(cur.spec) && (
          <option value={cur.spec}>{resout(cur.spec) ? libelle(cur.spec) : `${cur.spec} (inconnu)`}</option>
        )}
      </select>
      {mode === TEXTE_LIBRE && (
        <input aria-label="Spécialisation (texte libre)" style={{ width: 160 }} value={cur.spec ?? ''}
          onChange={(e) => onChange(e.target.value ? { id: cur.id, spec: e.target.value } : { id: cur.id })} />
      )}
      {mode === CHOIX_BORNE && catalogue.map((spec) => (
        <button type="button" className="chip" key={spec} aria-pressed={borne.includes(spec)} onClick={() => basculer(spec)}>
          {libelle(spec)}
        </button>
      ))}
    </>
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
      <span>{label}<em className="de-hint"> (réf {cfg.ds}, ou saisie libre)</em></span>
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
      <span>{label}<em className="de-hint"> (vocabulaire {ds}.{field})</em></span>
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
  const { refListe, ajouter } = useFocusRangeeNeuve();
  return (
    <div className="ed-field" ref={refListe}>
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
      <button className="btn small" onClick={() => ajouter(() => set([...list, { id: '' }]))}>+ Ajouter</button>
    </div>
  );
}
