/**
 * Éditeurs STRUCTURÉS du Codex (lot E2) — sortent du repli `json` brut les champs « objet » /
 * « tableau d'objets » des datasets éditables, sur le MÊME patron que les éditeurs déjà en place
 * (filtrer le champ inféré + rendre un composant dédié au-dessus du formulaire). Tous réutilisent :
 *  - `RefField` (lot E1) pour les parties RÉFÉRENCE (compétence/talent/possession par id, +spec/+count) ;
 *  - le patron de LIGNES `RefField`/`GameOpEditor` (rangée + ✕ + « +Ajouter ») — pas de re-roll maison.
 * On édite les VRAIS objets de `src/data/*.json` (rien de transformé) → la donnée stockée reste celle
 * que le moteur lit (DiseaseSymptom / CombatFeature / AdvancementRef / TrappingRef).
 */
import { RefField, type RefFieldCfg } from './RefField';
import { datasetArray } from '../../data/overrides';
import { DIFFICULTY_LABELS, CHAR_KEYS, CHAR_LABELS, type Difficulty, type CharKey } from '../../engine/types';
import type { DiseaseSymptom } from '../../engine/disease';
import { formatDice, parseDice } from '../../engine/dice';
import type { CombatFeature, CastingKind } from '../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef, CountSpec, DomainData, HarvestRarity, HarvestDanger, TalentTest, TestMatch, SpecEntry } from '../../data';
import { dispoSaisonniereSchema, harvestRaritySchema } from '../../data/schemas/grammaire/valeurs';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { missileBypassSchema } from '../../data/schemas/defs/domains';
import { specEntryId, specEntryLabel, charAbr, findCreatureById, findVehicleById, seasonLabel } from '../../data';
import type { z } from 'zod';
import { slugId } from '../../data/slug';
import { ConditionEditor } from '../editor/ConditionEditor';
import { isOptionalNote, type TraitInstance, type OptionalEntry } from '../../engine/statEntry';
import { parseTraitInstance, formatTrait, optionalLabel } from '../../engine/traits/dispatch';
import { GameOpEditor, newOp } from '../editor/GameOpEditor';
import { NoeudTestField, noeudTestNeuf, type NoeudTest } from '../editor/FlowEditor';
import type { GameOp } from '../../engine/ops';
import type { CrewTarget } from '../../data/shipCriticals';
import { NumberField } from '../NumberField';
import { PlageField } from '../PlageField';
import { OptionChooser } from '../OptionChooser';
import type { OptionalRule, RuleValue } from '../../engine/policy';

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

/** Cibles du coup à l'équipage : deux catalogues, servis par `RefField` (liste / choix unique). Ces
 *  cfg vivent AU SITE et non dans `REF_FIELD` — ce registre indexe les champs de PREMIER NIVEAU d'un
 *  def, or `crewHit.crewTarget` est imbriqué (garde `ref-field-cles.test.ts`). */
const CFG_STATIONS: RefFieldCfg = { ds: 'shipStations' };
const CFG_ROLE: RefFieldCfg = { ds: 'crewRoles', single: true };

/** Les quatre colonnes saisonnières d'une cargaison, telles que la grammaire les déclare. */
type DispoSaisonniere = z.infer<typeof dispoSaisonniereSchema>;

/** 1°ʳᵉ référence d'un slot qui porte une LISTE de réfs (`reverseFailed.skills` : Pilote → Ramer OU
 *  Voile) — le contrôle MONO de cet atelier n'édite que celle-là, les suivantes sont conservées. PURE. */
const premiereRef = (r: readonly RefDesignee[]): RefDesignee => r[0] ?? { id: '' };

/* ─────────────────────────────────────────────────────────────────────────────
 * 1) maladies.symptoms — DiseaseSymptom[] = { symptomId, severity?, difficulty? }
 *    Le symptomId RÉFÉRENCE un symptôme de `symptoms.json` (catalogue éditable au Codex).
 * ──────────────────────────────────────────────────────────────────────────── */

export function SymptomsField({ value, onChange }: { value: DiseaseSymptom[] | undefined; onChange: (v: DiseaseSymptom[]) => void }) {
  const list = value ?? [];
  const syms = datasetArray('symptoms'); // catalogue live (id + label) — un nouveau symptôme apparaît tout seul
  const set = (i: number, patch: Partial<DiseaseSymptom>) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="ed-field">
      <span>symptômes (LDB 20 — chacun = un symptôme du catalogue + sévérité/difficulté éventuelles)</span>
      {list.map((s, i) => (
        <div className="de-reflrow" key={i}>
          <select value={s.symptomId} onChange={(e) => set(i, { symptomId: e.target.value })}>
            {!s.symptomId && <option value="">— (choisir un symptôme) —</option>}
            {syms.map((sym) => <option key={sym.id} value={sym.id}>{sym.label}</option>)}
          </select>
          <select value={s.severity ?? ''} onChange={(e) => set(i, { severity: (e.target.value || undefined) as DiseaseSymptom['severity'] })}>
            <option value="">— sévérité —</option>
            <option value="moderee">Modérée</option>
            <option value="grave">Grave</option>
          </select>
          <select value={s.difficulty ?? ''} onChange={(e) => set(i, { difficulty: (e.target.value || undefined) as Difficulty | undefined })}>
            <option value="">— difficulté —</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          {/* Localisation/précision imprimée (« Gonflement (Visage et tête) », EDO 11 l.119) — affichage seul. */}
          <input placeholder="précision (ex. Visage et tête)" value={s.spec ?? ''} onChange={(e) => set(i, { spec: e.target.value || undefined })} />
          <button className="btn small danger" title="Retirer le symptôme" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { symptomId: '' }])}>+ Symptôme</button>
    </div>
  );
}

/** symptoms[].onTick — cycle quotidien de PHASE ACTIVE d'un symptôme : SOIT une épreuve (`test`, le
 *  nœud `test` du Flow, dont la branche d'échec porte la conséquence), SOIT des ops CERTAINES (`ops` —
 *  éclatement du Vers du Reik, sans jet) ; cadencé sur la phase active (`afterDays` : Vers de carie
 *  J+7 ; `once` : UNE fois). `difficultyBySeverity` (Toxine) préservée par fusion — jamais perdue à
 *  l'édition. */
export type SymptomTick = {
  test?: NoeudTest;
  ops?: GameOp[];
  difficultyBySeverity?: Partial<Record<'moderee' | 'grave', Difficulty>>;
  afterDays?: number;
  once?: boolean;
};
export function SymptomTickField({ value, onChange }: { value: SymptomTick | undefined; onChange: (v: SymptomTick | undefined) => void }) {
  const patch = (p: Partial<SymptomTick>) => onChange({ ...value, ...p });
  /** Bascule ÉPREUVE ↔ CERTAIN : les deux clefs sont EXCLUSIVES au schéma (`defs/symptoms.ts`), la
   *  Difficulté par sévérité n'a de sens que sous jet et s'efface avec lui. */
  const versEpreuve = () => patch({ test: value?.test ?? noeudTestNeuf(), ops: undefined });
  // Le schéma exige une conséquence NON VIDE (`gameOpSchema[]` d'au moins une op serait sinon un
  // cycle qui ne fait rien) : la bascule pose une op de départ éditable plutôt qu'un `ops: []` que
  // le save refuserait sans que rien à l'écran ne le dise.
  const versCertain = () => patch({ test: undefined, difficultyBySeverity: undefined, ops: value?.ops?.length ? value.ops : [newOp('wounds')] });
  return (
    <div className="ed-field">
      <span>Cycle quotidien de phase active (Blessé / Toxine / Vers) — sous jet (nœud `test`) ou conséquence certaine</span>
      <label><input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? { test: noeudTestNeuf() } : undefined)} /> cycle actif</label>
      {value && (
        <>
          <OptionChooser
            layout="seg"
            options={[
              { key: 'cycle-epreuve', label: 'sous jet', selected: value.test != null, onSelect: versEpreuve },
              { key: 'cycle-certain', label: 'certain (sans jet)', selected: value.test == null, onSelect: versCertain },
            ]}
          />
          <label>à partir du jour de phase active <NumberField variant="nu" label="Jour de phase active" min={1} vide value={value.afterDays} onChange={(n) => patch({ afterDays: n ?? undefined })} /></label>
          <label><input type="checkbox" checked={!!value.once} onChange={(e) => patch({ once: e.target.checked || undefined })} /> une seule fois (au jour exact)</label>
          {value.test
            ? <NoeudTestField desc="jet du cycle (Difficulté, compétence, conséquence de l’échec)" retirable={false} branches="echec" value={value.test} onChange={(t) => patch({ test: t ?? noeudTestNeuf() })} />
            : <GameOpEditor ops={value.ops ?? []} onChange={(ops) => patch({ ops })} />}
        </>
      )}
    </div>
  );
}

/** maladies[].dailyTest — le Test de cycle porté par la MALADIE elle-même (EDOC 08 l.104) : le JET et
 *  sa conséquence dans le nœud `test`, le symptôme MIS EN JEU (libellé d'étape, réf d'enjeu) sur le
 *  porteur. Même canal que le cycle d'un symptôme : seule la branche d'échec est servie. */
export type DiseaseDailyTest = { test: NoeudTest; symptomId: string };
export function DiseaseDailyTestField({ value, onChange }: { value: DiseaseDailyTest | undefined; onChange: (v: DiseaseDailyTest | undefined) => void }) {
  const syms = datasetArray('symptoms');
  return (
    <div className="ed-field">
      <span>Test quotidien de la maladie (EDOC 08 l.104) — jet porté par la maladie, pas par un de ses symptômes</span>
      <label><input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? { test: noeudTestNeuf(), symptomId: syms[0]?.id ?? '' } : undefined)} /> test quotidien actif</label>
      {value && (
        <>
          <div className="de-reflrow">
            <span>symptôme mis en jeu</span>
            <select value={value.symptomId} onChange={(e) => onChange({ ...value, symptomId: e.target.value })}>
              {!value.symptomId && <option value="">— (choisir un symptôme) —</option>}
              {syms.map((sym) => <option key={sym.id} value={sym.id}>{sym.label}</option>)}
            </select>
          </div>
          <NoeudTestField desc="jet du cycle (Difficulté, compétence, conséquence de l’échec)" retirable={false} branches="echec" value={value.test} onChange={(t) => onChange({ ...value, test: t ?? noeudTestNeuf() })} />
        </>
      )}
    </div>
  );
}
/** `ShipCritEntry.crewHit` — ce qu'un Critique de coque fait à l'ÉQUIPAGE (MDG 13 l.680/l.714/l.730/
 *  l.751/l.763, MSRC 07 l.78/l.82/l.86/l.94) : le porteur dit QUI encaisse (`crewTarget`, REQUIS),
 *  l'issue est SOIT une épreuve (le nœud `test`, dont seule la branche d'ÉCHEC est servie par
 *  `applyCrewHit`), SOIT des ops CERTAINES (`ops`). Deux bascules `OptionChooser` : la CIBLE (poste /
 *  stations / rôle) et l'ISSUE — les deux clefs d'issue sont EXCLUSIVES au schéma. */
export type ShipCrewHitValue = { crewTarget: CrewTarget; test?: NoeudTest; ops?: GameOp[] };

/** Mode de désignation LU dans la valeur — la donnée porte la forme, l'atelier ne la devine pas. */
const modeDeCible = (c: CrewTarget): 'poste' | 'stations' | 'role' =>
  'poste' in c ? 'poste' : 'role' in c ? 'role' : 'stations';

export function ShipCrewHitField({ value, onChange }: { value: ShipCrewHitValue | undefined; onChange: (v: ShipCrewHitValue | undefined) => void }) {
  const patch = (p: Partial<ShipCrewHitValue>) => onChange({ ...value!, ...p });
  const versEpreuve = () => patch({ test: value?.test ?? noeudTestNeuf(), ops: undefined });
  // Le schéma exige une conséquence NON VIDE : la bascule pose une op de départ éditable plutôt
  // qu'un `ops: []` que le save refuserait sans que rien à l'écran ne le dise.
  const versCertain = () => patch({ test: undefined, ops: value?.ops?.length ? value.ops : [newOp('wounds')] });
  // Chaque mode pose une valeur VALIDE au schéma (`stations` non vide, `role` réel) : une bascule ne
  // laisse jamais un document que le save refuserait sans rien dire à l'écran.
  const mode = value ? modeDeCible(value.crewTarget) : 'poste';
  const versCible = (m: 'poste' | 'stations' | 'role') => patch({
    crewTarget: m === 'poste' ? { poste: true }
      : m === 'stations' ? { stations: [String(datasetArray('shipStations')[0]?.id ?? '')] }
        : { role: { id: String(datasetArray('crewRoles')[0]?.id ?? '') } },
  });
  return (
    <div className="ed-field">
      <span>Coup à l’équipage — qui encaisse, puis l’issue : un Test à réussir, ou une conséquence certaine</span>
      <label><input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? { crewTarget: { poste: true }, test: noeudTestNeuf() } : undefined)} /> coup à l’équipage</label>
      {value && (
        <>
          <OptionChooser
            layout="seg"
            options={[
              { key: 'cible-poste', label: 'Équipage du poste', selected: mode === 'poste', onSelect: () => versCible('poste') },
              { key: 'cible-stations', label: 'Stations à bord', selected: mode === 'stations', onSelect: () => versCible('stations') },
              { key: 'cible-role', label: 'Rôle d’équipage', selected: mode === 'role', onSelect: () => versCible('role') },
            ]}
          />
          {mode === 'stations' && (
            <RefField
              cfg={CFG_STATIONS} fieldKey="stations" label="Stations touchées"
              value={(value.crewTarget as { stations: string[] }).stations.map((id) => ({ id }))}
              onChange={(v) => patch({ crewTarget: { stations: (v as { id: string }[]).map((r) => r.id) } })}
            />
          )}
          {mode === 'role' && (
            <RefField
              cfg={CFG_ROLE} fieldKey="crewRole" label="Rôle touché"
              value={(value.crewTarget as { role: { id: string } }).role.id}
              onChange={(v) => patch({ crewTarget: { role: { id: String(v) } } })}
            />
          )}
          <OptionChooser
            layout="seg"
            options={[
              { key: 'coup-epreuve', label: 'un Test à réussir', selected: value.test != null, onSelect: versEpreuve },
              { key: 'coup-certain', label: 'conséquence certaine', selected: value.test == null, onSelect: versCertain },
            ]}
          />
          {value.test
            ? <NoeudTestField desc="Test encouru — Difficulté, Compétence ou Caractéristique, et ce que l’échec inflige" retirable={false} branches="echec" value={value.test} onChange={(t) => patch({ test: t ?? noeudTestNeuf() })} />
            : <GameOpEditor ops={value.ops ?? []} onChange={(ops) => patch({ ops })} />}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1bis) talents.test — { raw verbatim, matches: TestMatch[] } (LDB 10 : +DR sur un Test lié)
 *    `raw` = la ligne « Tests : » du livre (affichage) ; `matches` = la règle STRUCTURÉE id-based
 *    (skill XOR char, spec / « au choix » / sauf-spec, contexte `when` mécanisable, `manual` narratif).
 * ──────────────────────────────────────────────────────────────────────────── */

export function TalentTestField({ value, onChange }: { value: TalentTest | undefined; onChange: (v: TalentTest | undefined) => void }) {
  const raw = value?.raw ?? '';
  const matches = value?.matches ?? [];
  const skillsList = datasetArray('skills');
  const emit = (r: string, m: TestMatch[]) => onChange(r || m.length ? { raw: r, matches: m } : undefined);
  const setM = (i: number, patch: Partial<TestMatch>) => emit(raw, matches.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ed-field">
      <span>Tests liés (LDB 10 : +1 DR/niveau sur un Test lié RÉUSSI) — « raw » = ligne du livre (affichage, verbatim) ; « matches » = règle structurée</span>
      <input value={raw} placeholder="ligne « Tests : » du livre (verbatim)" onChange={(e) => emit(e.target.value, matches)} />
      {matches.map((m, i) => (
        <div key={i}>
          <div className="de-reflrow">
            <select value={m.char != null ? '@char' : (m.skill?.id ?? '')} onChange={(e) => {
              const v = e.target.value;
              if (v === '@char') setM(i, { skill: undefined, specFromInstance: undefined, exceptSpec: undefined, char: CHAR_KEYS[0] });
              else setM(i, { char: undefined, skill: { id: v, ...(m.skill?.spec ? { spec: m.skill.spec } : {}) } });
            }}>
              <option value="">— compétence —</option>
              {skillsList.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="@char">▸ Caractéristique…</option>
            </select>
            {m.char != null && (
              <select value={m.char} onChange={(e) => setM(i, { char: e.target.value as CharKey })}>
                {CHAR_KEYS.map((ck) => <option key={ck} value={ck}>{CHAR_LABELS[ck]}</option>)}
              </select>
            )}
            {m.skill != null && !m.specFromInstance && (
              <input value={m.skill.spec ?? ''} placeholder="spec" title="spécialisation FIXE (Langue (Magick)…)" onChange={(e) => setM(i, { skill: { id: m.skill!.id, ...(e.target.value ? { spec: e.target.value } : {}) } })} />
            )}
            {m.skill != null && (
              <input value={m.exceptSpec ?? ''} placeholder="sauf spec" title="EXCLUT une spécialisation (Linguistique : toute Langue sauf Magick)" onChange={(e) => setM(i, { exceptSpec: e.target.value || undefined })} />
            )}
            {m.skill != null && (
              <label title="« (Au choix) » : matche la spécialisation CHOISIE du talent (Métier (Au choix)…)">
                <input type="checkbox" checked={!!m.specFromInstance} onChange={(e) => setM(i, { specFromInstance: e.target.checked || undefined, skill: { id: m.skill!.id } })} /> au choix
              </label>
            )}
            <label title="contexte NARRATIF inmécanisable → advisory, JAMAIS appliqué automatiquement">
              <input type="checkbox" checked={!!m.manual} onChange={(e) => setM(i, { manual: e.target.checked || undefined })} /> manuel
            </label>
            <button className="btn small danger" title="Retirer ce Test lié" onClick={() => emit(raw, matches.filter((_, j) => j !== i))}>✕</button>
          </div>
          {m.when ? (
            <div className="de-reflrow" style={{ marginLeft: 16 }}>
              <span>quand :</span>
              <ConditionEditor cond={m.when} onChange={(c) => setM(i, { when: c })} />
              <button className="btn small danger" title="Retirer le contexte" onClick={() => setM(i, { when: undefined })}>✕</button>
            </div>
          ) : (
            <button className="btn small" style={{ marginLeft: 16 }} title="Contexte de combat mécanisable (Condition)" onClick={() => setM(i, { when: { kind: 'engaged' } })}>+ contexte (when)</button>
          )}
        </div>
      ))}
      <button className="btn small" onClick={() => emit(raw, [...matches, { skill: { id: '' } }])}>+ Test lié</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2) talents.combat — CombatFeature partiel : ~40 drapeaux booléens + champs spéciaux
 * ──────────────────────────────────────────────────────────────────────────── */

/** Clés NON-booléennes de `CombatFeature` (rendues par des contrôles dédiés) — le RESTE est traité
 *  génériquement comme un drapeau booléen. Source unique pour ne PAS les compter comme des cases. */
const COMBAT_NON_BOOL = new Set<keyof CombatFeature>(['offHandPenalty', 'attackModes', 'castingKind', 'reverseFailed']);

/** Drapeaux booléens de `CombatFeature` (LDB 10) — DÉRIVÉS de la donnée existante (union des clés
 *  présentes dans `talents.json`, moins les clés spéciales) → un nouveau drapeau câblé dans la donnée
 *  s'édite tout seul, aucun libellé codé à la main. Le LABEL affiché est la clé (le type est la doc). */
function combatBoolKeys(all: (Partial<CombatFeature> | undefined)[]): (keyof CombatFeature)[] {
  const keys = new Set<keyof CombatFeature>();
  for (const c of all) if (c) for (const k of Object.keys(c) as (keyof CombatFeature)[]) if (!COMBAT_NON_BOOL.has(k)) keys.add(k);
  return [...keys].sort((a, b) => a.localeCompare(b));
}

const CASTING_KINDS: CastingKind[] = ['mineure', 'arcane', 'invocation', 'beni', 'chaos'];

export function CombatField(
  { value, onChange, allFeatures }:
  { value: Partial<CombatFeature> | undefined; onChange: (v: Partial<CombatFeature> | undefined) => void; allFeatures: (Partial<CombatFeature> | undefined)[] },
) {
  const c = value ?? {};
  // Patch CREUX : on ne stocke QUE les drapeaux à `true` et les champs spéciaux renseignés (pas de
  // `false`/`undefined` qui alourdiraient le JSON). Objet vide → champ supprimé (undefined).
  const emit = (next: Partial<CombatFeature>) => {
    const clean: Partial<CombatFeature> = {};
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== false) (clean as Record<string, unknown>)[k] = v;
    onChange(Object.keys(clean).length ? clean : undefined);
  };
  const boolKeys = combatBoolKeys([...allFeatures, c]);
  const offHand = c.offHandPenalty;
  return (
    <div className="ed-field">
      <span>capacité de combat (drapeaux LDB 10 — n'afficher/stocker que les actifs)</span>
      <div className="de-grid de-flags">
        {boolKeys.map((k) => (
          <label className="ed-check" key={k}>
            <input type="checkbox" checked={!!c[k]} onChange={(e) => emit({ ...c, [k]: e.target.checked || undefined })} />
            <span>{k}</span>
          </label>
        ))}
      </div>
      <div className="tf-row">
        <label className="dr">Famille d'incantation
          <select value={c.castingKind ?? ''} onChange={(e) => emit({ ...c, castingKind: (e.target.value || undefined) as CastingKind | undefined })}>
            <option value="">— (aucune) —</option>
            {CASTING_KINDS.map((ck) => <option key={ck} value={ck}>{ck}</option>)}
          </select>
        </label>
      </div>
      <div className="ed-subfield">
        <span>Modes d'attaque ajoutés (ex. dual-wield)</span>
        {(c.attackModes ?? []).map((mode, i) => (
          <div className="de-reflrow" key={i}>
            <input value={mode} onChange={(e) => emit({ ...c, attackModes: (c.attackModes ?? []).map((m, j) => (j === i ? e.target.value : m)) })} />
            <button className="btn small danger" title="Retirer" onClick={() => { const next = (c.attackModes ?? []).filter((_, j) => j !== i); emit({ ...c, attackModes: next.length ? next : undefined }); }}>✕</button>
          </div>
        ))}
        <button className="btn small" onClick={() => emit({ ...c, attackModes: [...(c.attackModes ?? []), ''] })}>+ Mode d'attaque</button>
      </div>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={!!offHand} onChange={(e) => emit({ ...c, offHandPenalty: e.target.checked ? { perLevel: 10, zeroAt: 2 } : undefined })} /> Pénalité de main secondaire</label>
        {offHand && (
          <>
            <label className="dr">par niveau<NumberField variant="nu" label="Pénalité de main secondaire — par niveau" value={offHand.perLevel} onChange={(perLevel) => emit({ ...c, offHandPenalty: { ...offHand, perLevel } })} /></label>
            <label className="dr">nulle à<NumberField variant="nu" label="Pénalité de main secondaire — nulle à" value={offHand.zeroAt} onChange={(zeroAt) => emit({ ...c, offHandPenalty: { ...offHand, zeroAt } })} /></label>
          </>
        )}
      </div>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={!!c.reverseFailed} onChange={(e) => emit({ ...c, reverseFailed: e.target.checked ? { skills: [{ id: '' }] } : undefined })} /> Inverse un Test raté (Sociable…)</label>
        {c.reverseFailed && (() => {
          const rf = c.reverseFailed;
          const tete = premiereRef(rf.skills);
          const poseTete = (r: RefDesignee) => emit({ ...c, reverseFailed: { ...rf, skills: [r, ...rf.skills.slice(1)] } });
          return (
            <>
              {/* `reverseFailed.skills` est une LISTE (Pilote → Ramer OU Voile) ; ce sélecteur MONO édite
                  la 1ʳᵉ Compétence, les suivantes sont conservées telles quelles. */}
              <select value={tete.id} onChange={(e) => poseTete({ id: e.target.value, ...(tete.spec ? { spec: tete.spec } : {}) })}>
                {!tete.id && <option value="">— (choisir une compétence) —</option>}
                {datasetArray('skills').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input className="dr" placeholder="spec" value={tete.spec ?? ''} onChange={(e) => poseTete({ id: tete.id, ...(e.target.value ? { spec: e.target.value } : {}) })} />
              <label className="dr">cap DR<NumberField variant="nu" label="Inverse un Test raté — cap DR" value={rf.capDR ?? 0} onChange={(n) => emit({ ...c, reverseFailed: { ...rf, capDR: n || undefined } })} /></label>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3) skills/talents d'avancement — AdvancementRef[] (espèce / niveau de carrière)
 *    union (RefDesignee & { choix? }) | { pick, of[] } | { random }
 * ──────────────────────────────────────────────────────────────────────────── */

type AdvMode = 'ref' | 'choix' | 'pick' | 'random';
const ADV_MODE_LABEL: Record<AdvMode, string> = { ref: 'Réf.', choix: 'Joker (Au choix)', pick: 'Choix (A ou B)', random: 'Aléatoire (N)' };
const advMode = (a: AdvancementRef): AdvMode =>
  'id' in a ? (a.choix == null ? 'ref' : 'choix') : 'pick' in a ? 'pick' : 'random';

/** Référence PORTÉE par une entrée (celle qui se transpose d'un mode à l'autre). */
const advRef = (a: AdvancementRef): RefDesignee => ('id' in a ? { id: a.id, ...(a.spec ? { spec: a.spec } : {}) } : { id: '' });

/** Convertit une entrée vers un autre mode en gardant ce qui se transpose (la réf courante). */
function advTo(a: AdvancementRef, mode: AdvMode): AdvancementRef {
  const cur = advRef(a);
  switch (mode) {
    case 'ref': return cur;
    case 'choix': return { id: cur.id, choix: true };
    case 'pick': return { pick: 1, of: 'pick' in a ? a.of : [cur] };
    case 'random': return { random: 'random' in a ? a.random : 1 };
  }
}

/** `ds` = dataset cible des réfs (skills OU talents) selon le champ édité. */
export function AdvancementRefField(
  { ds, label, value, onChange }:
  { ds: 'skills' | 'talents'; label: string; value: AdvancementRef[] | undefined; onChange: (v: AdvancementRef[]) => void },
) {
  const list = value ?? [];
  const set = (i: number, a: AdvancementRef) => onChange(list.map((x, j) => (j === i ? a : x)));
  const refCfg = { ds, single: true as const, spec: true as const };
  return (
    <div className="ed-field">
      <span>{label} — emplacements d'avancement (réf / joker / choix / aléatoire)</span>
      {list.map((a, i) => {
        const mode = advMode(a);
        return (
          <div className="ed-subfield" key={i}>
            <div className="de-reflrow">
              <select value={mode} onChange={(e) => set(i, advTo(a, e.target.value as AdvMode))}>
                {(Object.keys(ADV_MODE_LABEL) as AdvMode[]).map((m) => <option key={m} value={m}>{ADV_MODE_LABEL[m]}</option>)}
              </select>
              <button className="btn small danger" title="Retirer l'emplacement" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
            </div>
            {mode === 'ref' && (
              <RefField cfg={refCfg} fieldKey="réf" value={advRef(a)} onChange={(v) => set(i, (v as RefDesignee) ?? { id: '' })} />
            )}
            {mode === 'choix' && 'id' in a && (
              <>
                <RefField cfg={{ ds, single: true as const }} fieldKey="joker" value={{ id: a.id }} onChange={(v) => set(i, { id: ((v as RefDesignee) ?? { id: '' }).id, choix: a.choix ?? true })} />
                <label className="dr">specs restreintes (CSV d'ids — vide = « Au choix »)
                  <input value={Array.isArray(a.choix) ? a.choix.join(', ') : ''} onChange={(e) => { const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); set(i, { id: a.id, choix: opts.length ? opts : true }); }} />
                </label>
              </>
            )}
            {'pick' in a && (
              <ChoiceList ds={ds} value={a.of} onChange={(of) => set(i, { pick: a.pick, of })} />
            )}
            {'random' in a && (
              <label className="dr">nombre aléatoire<NumberField variant="nu" label="nombre aléatoire" min={1} value={a.random} onChange={(random) => set(i, { random })} /></label>
            )}
          </div>
        );
      })}
      <button className="btn small" onClick={() => onChange([...list, { id: '' }])}>+ Emplacement</button>
    </div>
  );
}

/** Branches d'un `{ pick, of: AdvancementRef[] }` — chaque branche est elle-même un AdvancementRef
 *  (récursif : on réutilise `AdvancementRefField` borné aux modes ref/joker pour rester lisible). */
function ChoiceList({ ds, value, onChange }: { ds: 'skills' | 'talents'; value: AdvancementRef[]; onChange: (v: AdvancementRef[]) => void }) {
  return (
    <div className="ed-subfield">
      <AdvancementRefField ds={ds} label="branches du choix" value={value} onChange={onChange} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4) trappings (classe / niveau de carrière) — TrappingRef[]
 *    ( RefDesignee & { count? } ) | { text, count? }
 * ──────────────────────────────────────────────────────────────────────────── */

const isText = (t: TrappingRef): t is { text: string; count?: CountSpec } => 'text' in t;
const isVehicle = (t: TrappingRef): t is { vehicleId: string; count?: CountSpec; label?: string } => 'vehicleId' in t;
const isCreature = (t: TrappingRef): t is { creatureId: string; count?: CountSpec; label?: string } => 'creatureId' in t;

export function TrappingRefField({ value, onChange }: { value: TrappingRef[] | undefined; onChange: (v: TrappingRef[]) => void }) {
  const list = value ?? [];
  const set = (i: number, t: TrappingRef) => onChange(list.map((x, j) => (j === i ? t : x)));
  const refCfg = { ds: 'trappings' as const, single: true as const };
  const vehicleCfg = { ds: 'vehicles' as const, single: true as const };
  const creatureCfg = { ds: 'creatures' as const, single: true as const };
  // Quantité : nombre fixe « (3) » OU jet « (1d10) » — une seule entrée texte, jet si elle contient un d.
  const countOf = (t: TrappingRef): string => ('count' in t && t.count ? ('fixed' in t.count ? String(t.count.fixed) : formatDice(t.count.roll)) : '');
  const parseCount = (s: string): CountSpec | undefined => {
    const v = s.trim();
    if (!v) return undefined;
    const dc = parseDice(v);
    return dc ? { roll: dc } : { fixed: Number(v) || 1 };
  };
  const kindOf = (t: TrappingRef): 'text' | 'vehicle' | 'creature' | 'ref' => (isText(t) ? 'text' : isVehicle(t) ? 'vehicle' : isCreature(t) ? 'creature' : 'ref');
  return (
    <div className="ed-field">
      <span>possessions — par id du catalogue (+ quantité), dotation véhicule (`vehicles.json`), dotation bête (`creatures.json`), ou texte narratif hors catalogue</span>
      {list.map((t, i) => (
        <div className="ed-subfield" key={i}>
          <div className="de-reflrow">
            <select
              value={kindOf(t)}
              onChange={(e) => { const c = 'count' in t ? t.count : undefined; return set(i, e.target.value === 'text' ? { text: '', count: c } : e.target.value === 'vehicle' ? { vehicleId: '', count: c, ...('label' in t && t.label ? { label: t.label } : {}) } : e.target.value === 'creature' ? { creatureId: '', count: c, ...('label' in t && t.label ? { label: t.label } : {}) } : { id: '', count: c }); }}
            >
              <option value="ref">Réf. (catalogue)</option>
              <option value="vehicle">Véhicule (vehicles.json)</option>
              <option value="creature">Bête (creatures.json)</option>
              <option value="text">Texte (narratif)</option>
            </select>
            <label className="dr">quantité<input style={{ width: 80 }} placeholder="3 / 1d10" value={countOf(t)} onChange={(e) => set(i, { ...t, count: parseCount(e.target.value) })} /></label>
            <button className="btn small danger" title="Retirer la possession" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          {isText(t)
            ? <input placeholder="possession narrative (ex. Pile de prospectus)" value={t.text} onChange={(e) => set(i, { text: e.target.value, count: t.count })} />
            : isVehicle(t)
              ? (
                <>
                  <RefField cfg={vehicleCfg} fieldKey="vehicule" value={t.vehicleId} onChange={(v) => set(i, { vehicleId: typeof v === 'string' ? v : (v as RefDesignee)?.id ?? '', count: t.count, ...(t.label ? { label: t.label } : {}) })} />
                  <label className="dr">nom<input placeholder={findVehicleById(t.vehicleId)?.label ?? ''} value={t.label ?? ''} onChange={(e) => set(i, { ...t, label: e.target.value.trim() || undefined })} /></label>
                </>
              )
              : isCreature(t)
                ? (
                  <>
                    <RefField cfg={creatureCfg} fieldKey="bete" value={t.creatureId} onChange={(v) => set(i, { creatureId: typeof v === 'string' ? v : (v as RefDesignee)?.id ?? '', count: t.count, ...(t.label ? { label: t.label } : {}) })} />
                    <label className="dr">nom<input placeholder={findCreatureById(t.creatureId)?.label ?? ''} value={t.label ?? ''} onChange={(e) => set(i, { ...t, label: e.target.value.trim() || undefined })} /></label>
                  </>
                )
                : <RefField cfg={refCfg} fieldKey="possession" value={'id' in t ? t.id : ''} onChange={(v) => set(i, { id: typeof v === 'string' ? v : (v as RefDesignee)?.id ?? '', count: 'count' in t ? t.count : undefined })} />}
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { id: '' }])}>+ Possession</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5) characteristics de careerLevels — CharKey[] (vocabulaire FERMÉ) : multi-sélection
 *    de `CHAR_KEYS` (pas de saisie libre — un id de carac ≠ libellé multilangue).
 * ──────────────────────────────────────────────────────────────────────────── */

export function CharKeysField({ value, onChange }: { value: CharKey[] | undefined; onChange: (v: CharKey[]) => void }) {
  const set = new Set(value ?? []);
  const toggle = (k: CharKey, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(k); else next.delete(k);
    onChange(CHAR_KEYS.filter((c) => next.has(c))); // ordre canon stable, peu importe l'ordre de clic
  };
  return (
    <div className="ed-field">
      <span>caractéristiques avancées (LDB 07 — vocabulaire fermé, cocher celles du Niveau)</span>
      <div className="de-grid de-flags">
        {CHAR_KEYS.map((k) => (
          <label className="ed-check" key={k}>
            <input type="checkbox" checked={set.has(k)} onChange={(e) => toggle(k, e.target.checked)} />
            <span>{charAbr(k)} — {CHAR_LABELS[k]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6) sea-cargo / land-cargo `avail` — DISPONIBILITÉ SAISONNIÈRE : quatre colonnes d100, chacune une
 *    fourchette `{min, max}` (`dispoSaisonniereSchema`). Une `PlageField` par saison.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Les quatre colonnes, DÉRIVÉES du nœud de grammaire : la liste des saisons n'est écrite qu'une
 *  fois dans le dépôt (`parSaison`, `schemas/grammaire/valeurs.ts`). */
const SAISONS_DE_DISPO = Object.keys(dispoSaisonniereSchema.shape) as (keyof DispoSaisonniere)[];

export function DispoSaisonniereField(
  { label, value, onChange }: { label: string; value: DispoSaisonniere | undefined; onChange: (v: DispoSaisonniere) => void },
) {
  const colonnes = value ?? ({} as Partial<DispoSaisonniere>);
  return (
    <div className="ed-field">
      <span>{label}</span>
      {SAISONS_DE_DISPO.map((saison) => (
        <PlageField
          key={saison}
          label={seasonLabel(saison)}
          // MDG 15 l.406-418 / MSRC 13 l.73-78 : les quatre colonnes sont tirées au d100, et chacune
          // couvre 1 à 100 d'un seul tenant (refine de def, `catalogueSaisonnier`).
          domaine={{ nom: 'd100', min: 1, max: 100 }}
          value={colonnes[saison]}
          onChange={(f) => f && onChange({ ...(colonnes as DispoSaisonniere), [saison]: f as { min: number; max: number } })}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6bis) skills/talents.specs — SpecEntry[] = `{id,label}[]` (langue/chevaucher/discretion/art,
 *    talent résistance…) : id STABLE auto-dérivé du libellé FR à l'édition.
 * ──────────────────────────────────────────────────────────────────────────── */

export function SpecsField({ value, onChange }: { value: SpecEntry[] | undefined; onChange: (v: SpecEntry[]) => void }) {
  const list = value ?? [];
  const set = (next: SpecEntry[]) => onChange(next);
  // Renommer = changer le LIBELLÉ et l'id qui en dérive ; les autres champs de l'entrée
  // (`source`, `alsoIn`, `pool`) sont PORTÉS, jamais reconstruits.
  const setLabel = (i: number, label: string) =>
    set(list.map((s, j) => (j === i ? { ...s, id: slugId(label), label } : s)));
  const setPool = (i: number, propose: boolean) =>
    set(list.map((s, j) => {
      if (j !== i) return s;
      const { pool: _pool, ...rest } = s;
      return propose ? rest : { ...rest, pool: false as const };
    }));
  return (
    <div className="ed-field">
      <span>spécialisations (id auto-dérivé du libellé ; « proposée d’office » = offerte au créateur/à l’avancement, `LDB 09 l.40`)</span>
      {list.map((s, i) => (
        <div key={i} className="de-reflrow">
          <input value={specEntryLabel(s)} onChange={(e) => setLabel(i, e.target.value)} />
          <em className="de-hint">{specEntryId(s)}</em>
          <OptionChooser
            layout="seg"
            options={[
              { key: `pool-${i}-oui`, label: 'proposée d’office', selected: s.pool !== false, onSelect: () => setPool(i, true) },
              { key: `pool-${i}-non`, label: 'hors pool', selected: s.pool === false, onSelect: () => setPool(i, false) },
            ]}
          />
          <button className="btn small danger" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: '', label: '' }])}>+ Ajouter</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7) domains.castBonus / missile / casterOps — attributs de Domaine (LDB 48).
 *    `castBonus` { perCondition (id d'État — résolu par id, jamais un libellé, #173), radiusStat (CharKey fermé), bonus }
 *      → CAPABILITY irréductible (modif du JET d'incantation via géométrie arène, hors GameOp).
 *    `missile`   { bypass ('metal'|'nonMagic'), bonusFromBypass? }
 *    `casterOps` GameOp[] — ops appliquées AU LANCEUR après incantation réussie (ex. Bête → Peur 1).
 *      → Edité via `GameOpEditor` (source unique, même brique que sorts/traits/mutations).
 * ──────────────────────────────────────────────────────────────────────────── */

export function DomainEffectsField(
  { castBonus, missile, casterOps, onCastBonus, onMissile, onCasterOps }:
  {
    castBonus: DomainData['castBonus']; missile: DomainData['missile']; casterOps: DomainData['casterOps'];
    onCastBonus: (v: DomainData['castBonus']) => void; onMissile: (v: DomainData['missile']) => void; onCasterOps: (v: DomainData['casterOps']) => void;
  },
) {
  const etatOpts = datasetArray('etats') as { id: string; label: string }[];
  return (
    <div className="ed-field">
      <span>attributs du domaine (LDB 48 — bonus d'incantation conditionnel / mitigation de Projectile / ops au lanceur)</span>
      <div className="ed-subfield">
        <label className="dr"><input type="checkbox" checked={!!castBonus} onChange={(e) => onCastBonus(e.target.checked ? { perCondition: '', radiusStat: 'force-mentale', bonus: 10 } : undefined)} /> Bonus d'incantation conditionnel</label>
        {castBonus && (
          <div className="tf-row">
            <label className="dr">par État
              {/* #173 : `perCondition` est l'id de l'État (résolu par `stacks(c, cb.perCondition)`,
                  state/combatFlow.ts — cf. ConditionInstance.name), pas son libellé → sélecteur id→label,
                  pas de datalist par label. */}
              <select value={castBonus.perCondition} onChange={(e) => onCastBonus({ ...castBonus, perCondition: e.target.value })}>
                <option value="">— (choisir un État) —</option>
                {etatOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="dr">rayon B-carac.
              <select value={castBonus.radiusStat} onChange={(e) => onCastBonus({ ...castBonus, radiusStat: e.target.value as CharKey })}>
                {CHAR_KEYS.map((k) => <option key={k} value={k}>{CHAR_LABELS[k]}</option>)}
              </select>
            </label>
            <label className="dr">bonus<NumberField variant="nu" label="Bonus à l'Incantation" value={castBonus.bonus} onChange={(bonus) => onCastBonus({ ...castBonus, bonus })} /></label>
          </div>
        )}
      </div>
      <div className="ed-subfield">
        <label className="dr"><input type="checkbox" checked={!!missile} onChange={(e) => onMissile(e.target.checked ? { bypass: 'metal' } : undefined)} /> Mitigation de Projectile</label>
        {missile && (
          <div className="tf-row">
            <label className="dr">ignore
              <select value={missile.bypass} onChange={(e) => onMissile({ ...missile, bypass: e.target.value as NonNullable<DomainData['missile']>['bypass'] })}>
                {Object.entries(valeursDe(missileBypassSchema) ?? {}).map(([b, l]) => <option key={b} value={b}>{l}</option>)}
              </select>
            </label>
            <label className="dr"><input type="checkbox" checked={!!missile.bonusFromBypass} onChange={(e) => onMissile({ ...missile, bonusFromBypass: e.target.checked || undefined })} /> + ajoute aux Dégâts</label>
          </div>
        )}
      </div>
      <div className="ed-subfield">
        <span>Ops post-incantation (appliquées au lanceur après incantation réussie — ex. Bête → Peur 1 pour 1d10 Rounds)</span>
        <GameOpEditor ops={casterOps ?? []} onChange={(ops) => onCasterOps(ops.length ? ops : undefined)} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8) TraitInstance[] — liste de Traits de créature STRUCTURÉS (édités via la chaîne
 *    réversible `formatTrait` ⇄ `parseTraitInstance`, comme dans StatblockEditor).
 *    PARTAGÉ : StatblockEditor (traits fixes) + Codex `creatures.traits`/`.optionals`.
 *    L'auteur complète l'Indice/la Cible dans la chaîne (« Arme (Épée) +7 », « Peur 3 »).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Suggestions d'autocomplétion : libellés du dataset `traits` (le param libre reste saisi à la main). */
const traitDatalistOptions = (): string[] => (datasetArray('traits') as { label: string }[]).map((t) => t.label);

export function TraitListField(
  { label, hint, value, onChange, suggestions }:
  { label: string; hint?: string; value: TraitInstance[] | undefined; onChange: (v: TraitInstance[]) => void; suggestions?: string[] },
) {
  const list = value ?? [];
  const set = (next: TraitInstance[]) => onChange(next);
  const dlId = `dl-traitlist-${label.replace(/\s+/g, '-')}`;
  const opts = suggestions ?? traitDatalistOptions();
  return (
    <div className="ed-field">
      <span>{label}{hint && <em className="de-hint"> {hint}</em>}</span>
      {list.map((t, i) => (
        <div key={i} className="trait-row">
          <input list={dlId} value={formatTrait(t)} onChange={(e) => set(list.map((x, j) => (j === i ? parseTraitInstance(e.target.value) : x)))} />
          <button className="btn small danger" title="Retirer ce trait" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <datalist id={dlId}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
      <button className="btn small" onClick={() => set([...list, { id: '' }])}>+ Ajouter un trait</button>
    </div>
  );
}

/** Liste d'OPTIONNELS (LDB 76) : `TraitInstance` ORDINAIRES éditables en chaîne (comme `TraitListField`)
 *  + NOTES composées (joker « tous les traits », variante « swap » ZI) affichées en LECTURE SEULE
 *  (texte source VERBATIM — pas de saisie libre, elles se curent en JSON) mais supprimables. Les notes
 *  sont PRÉSERVÉES lors de l'édition des traits ordinaires (jamais écrasées par le round-trip chaîne). */
export function OptionalsListField(
  { label, hint, value, onChange }:
  { label: string; hint?: string; value: OptionalEntry[] | undefined; onChange: (v: OptionalEntry[]) => void },
) {
  const list = value ?? [];
  const dlId = `dl-optlist-${label.replace(/\s+/g, '-')}`;
  const opts = traitDatalistOptions();
  return (
    <div className="ed-field">
      <span>{label}{hint && <em className="de-hint"> {hint}</em>}</span>
      {list.map((t, i) => (
        <div key={i} className="trait-row">
          {isOptionalNote(t) ? (
            <span className="chip">{optionalLabel(t)}</span>
          ) : (
            <input list={dlId} value={formatTrait(t)} onChange={(e) => onChange(list.map((x, j) => (j === i ? parseTraitInstance(e.target.value) : x)))} />
          )}
          <button className="btn small danger" title="Retirer cet optionnel" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <datalist id={dlId}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
      <button className="btn small" onClick={() => onChange([...list, { id: '' }])}>+ Ajouter un trait optionnel</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9) creatures.harvest — { rarity, danger, uses } (Précieuses Entrailles, ZI).
 *    Deux vocabulaires FERMÉS (selects) + un texte d'usage ; checkbox = présence.
 * ──────────────────────────────────────────────────────────────────────────── */

const HARVEST_RARITIES = harvestRaritySchema.options;
const HARVEST_DANGERS: HarvestDanger[] = ['Inoffensive', 'Inquiétante', 'Menaçante', 'Mortelle'];

type Harvest = { rarity: HarvestRarity; danger: HarvestDanger; uses: string };

export function HarvestField({ value, onChange }: { value: Harvest | undefined; onChange: (v: Harvest | undefined) => void }) {
  const h = value;
  return (
    <div className="ed-field">
      <span>récolte « Précieuses Entrailles » (ZI — rareté + dangerosité → valeur par Enc, usages des organes)</span>
      <label className="dr"><input type="checkbox" checked={!!h} onChange={(e) => onChange(e.target.checked ? { rarity: 'Commune', danger: 'Inoffensive', uses: '' } : undefined)} /> récoltable</label>
      {h && (
        <>
          <div className="tf-row">
            <label className="dr">Rareté
              <select value={h.rarity} onChange={(e) => onChange({ ...h, rarity: e.target.value as HarvestRarity })}>
                {HARVEST_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="dr">Dangerosité
              <select value={h.danger} onChange={(e) => onChange({ ...h, danger: e.target.value as HarvestDanger })}>
                {HARVEST_DANGERS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label className="ed-subfield">Usages (organes, parties prélevées)
            <textarea rows={2} value={h.uses} onChange={(e) => onChange({ ...h, uses: e.target.value })} />
          </label>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 11) reglesOptionnelles.default / .action.when — RuleValue TYPÉE PAR LE `kind` de la règle.
 *
 *    Le formulaire générique infère le type d'un champ sur le PREMIER échantillon non-null du
 *    dataset (`inferFields`, `editFields.ts`) : `default` y est échantillonné sur une règle `mode`
 *    (chaîne) et deviendrait un champ TEXTE pour les 81 règles — dont 46 `flag` (booléen) et 23
 *    `param` (nombre). `ruleValueSchema` étant l'union booléen|nombre|chaîne, écrire `"false"` au
 *    lieu de `false` passe le schéma, passe l'écriture disque, et éteint la règle SANS UN MOT
 *    (`rule(id)` rend une chaîne, qu'aucun `=== true` ne reconnaît). D'où un contrôle PAR `kind` :
 *    interrupteur, nombre borné (`NumberField`, primitive partagée), ou choix parmi `options`.
 *    Le refus au save vit dans `validateEntry` (`CodexEdit.tsx`) : ici on empêche de se tromper,
 *    là-bas on empêche d'enregistrer une donnée déjà fausse (JSON édité à la main).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Le sous-ensemble de la règle qui pilote le contrôle rendu (jamais l'entrée entière : cet éditeur
 *  ne lit ni ne modifie autre chose que la valeur). */
export type RuleShape = Pick<OptionalRule, 'kind' | 'options' | 'min' | 'max' | 'step'>;

export function RuleValueField({ id, label, rule, value, onChange }: {
  id: string; label: string; rule: RuleShape; value: RuleValue | undefined; onChange: (v: RuleValue) => void;
}) {
  if (rule.kind === 'flag') {
    return (
      <div className="ed-field">
        <span>{label} — interrupteur</span>
        <label className="dr" htmlFor={id}>
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {value === true ? ' activée' : ' désactivée'}
        </label>
      </div>
    );
  }
  if (rule.kind === 'param') {
    const min = rule.min ?? 0;
    const max = rule.max ?? 100;
    return (
      <div className="ed-field">
        <NumberField
          id={id}
          label={`${label} — nombre borné`}
          min={min}
          max={max}
          step={rule.step ?? 1}
          value={typeof value === 'number' ? value : min}
          onChange={onChange}
        />
      </div>
    );
  }
  const options = rule.options ?? [];
  return (
    <div className="ed-field">
      <span>{label} — choix</span>
      <select id={id} value={typeof value === 'string' ? value : (options[0] ?? '')} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Action de jeu attachée à une règle (`OptionalRule.action`) : sa valeur déclenchante `when` passe
 *  par le MÊME contrôle typé que `default` (même piège, même remède) ; `label`/`icon`/`run` restent
 *  des chaînes, liées au registre d'icônes et au store par `src/ui/rule-action-wiring.test.ts`. */
export function RuleActionField({ rule, value, onChange }: {
  rule: RuleShape; value: OptionalRule['action']; onChange: (v: OptionalRule['action']) => void;
}) {
  const vide: NonNullable<OptionalRule['action']> = {
    when: rule.kind === 'flag' ? true : rule.kind === 'param' ? (rule.min ?? 0) : (rule.options?.[0] ?? ''),
    label: '', icon: '', run: '',
  };
  if (!value) {
    return (
      <div className="ed-field">
        <span>action de jeu attachée — aucune</span>
        <button className="btn small" onClick={() => onChange(vide)}>Attacher une action</button>
      </div>
    );
  }
  const set = (patch: Partial<NonNullable<OptionalRule['action']>>) => onChange({ ...value, ...patch });
  return (
    <div className="ed-field">
      <span>action de jeu attachée — rendue sous la rangée quand la règle vaut la valeur ci-dessous</span>
      <RuleValueField id="rule-action-when" label="valeur déclenchante" rule={rule} value={value.when} onChange={(when) => set({ when })} />
      <label className="ed-subfield">Libellé du bouton
        <input value={value.label} onChange={(e) => set({ label: e.target.value })} />
      </label>
      <label className="ed-subfield">Icône (id du registre src/ui/icons/)
        <input value={value.icon} onChange={(e) => set({ icon: e.target.value })} />
      </label>
      <label className="ed-subfield">Action du store à déclencher
        <input value={value.run} onChange={(e) => set({ run: e.target.value })} />
      </label>
      <button className="btn small" onClick={() => onChange(undefined)}>Retirer l'action</button>
    </div>
  );
}
