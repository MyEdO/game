import type { JSX } from 'react';
/**
 * Picker DEV de RÉFÉRENCE unifié au Codex — UN composant, 3 modes, configuré par (catégorie, champ) :
 *  - `liste`    : `Ref[]` = {id, value?} (sorts d'une créature, Bénédictions/Miracles d'un dieu, Qualités
 *                 d'une possession) — choix dans le dataset cible, LIBELLÉ affiché mais `id` STABLE stocké ;
 *  - `single`   : UN `<select>` (sous-type d'arme, classe d'une carrière, espèce/carrière d'un pré-tiré…) ;
 *  - `vocab`    : `<input list>` + `<datalist>` des valeurs DISTINCTES d'un champ (refChar/refCareer/subType…)
 *                 → pioche OU saisie libre (mais la LISTE elle-même vient d'un champ, pas d'ids de dataset).
 * On stocke partout l'`id` — multilangue-safe (cf.
 * `CLAUDE.md` § Pour TOUT agent). Le composant est « bête » : il reçoit sa `cfg`.
 */
import { useMemo } from 'react';
import { datasetArray, type DatasetKey } from '../../data/overrides';
import { trappingDesObjetsPuisDuCatalogue, type TrappingData } from '../../data';
import { ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { estFeuilleDId, refusDeLEntree, declarationDeFeuilleDId, type FeuilleDId } from '../../data/schemas/grammaire/ref';
import { NumberField } from '../NumberField';

/** `filter` : un prédicat MOTEUR sur l'entrée (`Inspector.tsx`, portes/murs), jamais une sous-liste du
 *  schéma — celle-ci se lit sur le NŒUD du champ (`noeud`, `refusDuNoeud`). */
type RefDatasetCfg = { ds: DatasetKey; filter?: (entry: Record<string, unknown>) => boolean };
/** Mode `liste` : une rangée par réf, aucun contrôle unique. */
type ListeRefCfg = RefDatasetCfg & { value?: boolean; single?: false };
/** Mode `single` avec `spec` : le `<select>` ET l'`<input>` de spécialisation, aucun contrôle unique. */
type SpecRefCfg = RefDatasetCfg & { single: true; spec: true };
/** Config dont le rendu est UN contrôle : il porte le nom accessible, l'invalidité et la description. */
export type RefFieldCfgUnique =
  | (RefDatasetCfg & { single: true; spec?: false })
  | { vocabFrom: string };
/** Config d'un champ-réf, par (catégorie, champ). Dataset réel (liste/single) OU vocabulaire d'un champ. */
export type RefFieldCfg = ListeRefCfg | SpecRefCfg | RefFieldCfgUnique;

/**
 * REF_FIELD — clés par `'<catégorie>.<champ>'` (priorité) ou par `'<champ>'` (repli global).
 *  Trois formes, lues sur l'entrée elle-même : une LISTE d'ids d'un dataset (`ds`), un id SEUL
 *  (`single`), ou un vocabulaire tiré d'un champ (`vocabFrom`). `spec` est posé par les appelants
 *  directs du composant, jamais ici.
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

/** Libellé d'affichage d'une entrée. */
const entryLabel = (e: Record<string, unknown>): string =>
  String(e.label ?? e.id ?? '');

interface RefEntry { id: string; value?: number }
interface SpecRef { id: string; spec?: string }

/** `noeud` : le nœud de schéma du champ — sa feuille `idDe` restreint les options à sa sous-liste.
 *  `entreesEnTete` : objets du projet édité (`narratif.objets`, champ du dataset `trappings`), résolus AVANT
 *  lui par `trappingDesObjetsPuisDuCatalogue` — à id égal, ils priment. */
type RefFieldCommun = {
  categoryKey?: string; fieldKey?: string; label?: string; value: unknown; onChange: (v: unknown) => void; nullable?: boolean;
  noeud?: unknown; entreesEnTete?: readonly TrappingData[];
};
/** Nom accessible, invalidité et description du contrôle rendu. */
type Accessibilite = { ariaLabel?: string; invalide?: boolean; describedBy?: string };

/** Un contrôle UNIQUE (`single` sans `spec`, `vocab`) porte `Accessibilite` ; la `liste` et le
 *  `single` à `spec` n'en rendent aucun à qui la poser, et l'appel qui la passerait ne compile pas. */
export function RefField(props: RefFieldCommun & Accessibilite & { cfg: RefFieldCfgUnique }): JSX.Element;
export function RefField(props: RefFieldCommun & { cfg: RefFieldCfg; ariaLabel?: never; invalide?: never; describedBy?: never }): JSX.Element;
export function RefField(
  { cfg, fieldKey, label, ariaLabel, value, onChange, nullable, invalide, describedBy, noeud, entreesEnTete = SANS_ENTREE }:
  RefFieldCommun & Accessibilite & { cfg: RefFieldCfg },
) {
  // `label` = AFFICHAGE (libellé FR du champ, #1466) ; `fieldKey`/`cfg` restent l'IDENTITé. Un appelant
  // qui ne connaît que la clé affiche la clé.
  const affiche = label ?? fieldKey;
  const a11y = { ariaLabel, invalide, describedBy };
  const champ = { noeud, entreesEnTete };
  if (isVocab(cfg)) return <VocabField label={affiche} vocabFrom={cfg.vocabFrom} value={value} onChange={onChange} nullable={nullable} {...a11y} />;
  if (cfg.single) return <SingleRefField label={affiche} cfg={cfg} champ={champ} value={value} onChange={onChange} nullable={nullable} {...a11y} />;
  return <ListRefField label={affiche} cfg={cfg} champ={champ} value={value} onChange={onChange} />;
}

/** Le nœud de schéma d'un champ-réf et ses entrées hors dataset (`RefFieldCommun`). */
type Champ = { noeud: unknown; entreesEnTete: readonly TrappingData[] };
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

/** L'univers du champ : les entrées du dataset ; avec des objets du projet (`entreesEnTete`), leurs ids
 *  d'abord, chaque id résolu par la source unique `trappingDesObjetsPuisDuCatalogue`. */
function useUnivers(ds: DatasetKey, entreesEnTete: Champ['entreesEnTete']): readonly Entree[] {
  return useMemo(() => {
    const duDataset = (datasetArray(ds) as Record<string, unknown>[]).map((e) => ({ id: String(e.id ?? ''), e }));
    if (!entreesEnTete.length) return duDataset;
    if (ds !== 'trappings') throw new Error(`RefField : des objets du projet (\`entreesEnTete\`) sur le dataset « ${ds} » — ils ne précèdent que \`trappings\`.`);
    const parId = new Map(entreesEnTete.map((o) => [o.id, o]));
    const ids = [...new Set([...parId.keys(), ...duDataset.map((x) => x.id)])];
    return ids.map((id) => {
      const e = trappingDesObjetsPuisDuCatalogue(parId, id);
      if (!e) throw new Error(`RefField : « ${id} » n'est ni un objet du projet ni une entrée du catalogue des objets.`);
      return { id, e: e as unknown as Record<string, unknown> };
    });
  }, [ds, entreesEnTete]);
}

/** Options triées de l'univers (valeur stockée + libellé) : les entrées que la sous-liste de la feuille
 *  du champ admet (`refusDuNoeud`), puis le prédicat moteur `filter`. */
function useOptions(cfg: { ds: DatasetKey; filter?: (entry: Record<string, unknown>) => boolean }, noeud: unknown, univers: readonly Entree[]) {
  return useMemo(() => {
    const refus = refusDuNoeud(noeud);
    return univers
      .filter(({ id, e }) => (!refus || refus({ ...e, id }) === null) && (cfg.filter ? cfg.filter(e) : true))
      .map(({ id, e }) => ({ v: id, label: entryLabel(e) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cfg.filter, noeud, univers]);
}

/** Mode `single` : UN `<select>` (+ option « — (aucun) — » si nullable, option « (inconnu) » si hors liste).
 *  `spec` → un `<input>` texte à côté, on stocke `{ id, spec? }` (spec omis si vide) ; sinon la chaîne brute. */
function SingleRefField(
  { label, ariaLabel, cfg, champ, value, onChange, nullable, invalide, describedBy }:
  Accessibilite & { label?: string; cfg: { ds: DatasetKey; spec?: boolean; filter?: (entry: Record<string, unknown>) => boolean }; champ: Champ; value: unknown; onChange: (v: unknown) => void; nullable?: boolean },
) {
  const options = useOptions(cfg, champ.noeud, useUnivers(cfg.ds, champ.entreesEnTete));
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
  { label, cfg, champ, value, onChange }:
  { label?: string; cfg: { ds: DatasetKey; value?: boolean }; champ: Champ; value: unknown; onChange: (v: unknown) => void },
) {
  const options = useOptions(cfg, champ.noeud, useUnivers(cfg.ds, champ.entreesEnTete));
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
