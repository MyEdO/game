/**
 * ÉDITEUR DE CONDITION — l'algèbre CLOSE de `Condition` (flag / créneau horaire / ET / OU / NON),
 * récursive. SOURCE UNIQUE de l'édition des conditions : le `when` d'un trigger / d'un choix de
 * dialogue / d'un lieu ou d'une route de la carte du monde (où « Toujours » = pas de condition →
 * `undefined`) ET le nœud `si` d'un Flow. La prop `kinds` BORNE l'offre au contexte d'évaluation du
 * porteur (ex. `CONDITION_KINDS_CARTE`) ; absente = toute l'algèbre. Remplace les
 * adaptateurs plats `whenFlag/whenWindow/buildWhen` (qui n'exprimaient que « flag ET créneau »).
 */
import {
  seuilDeBourse,
  type Condition,
  type ActorRef,
  type ActorField,
  type CompareOp,
  type PartySelector,
  type TemporalCondition,
} from '../../engine/flowCore';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { HIT_LOCATION_LABELS, type HitLocation } from '../../engine/types';
import { libelleDeValeur, optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { etatsAdmettant, valeursDeclarees } from '../../data/schemas/defs-scenes/formes-d-etat';
import {
  actorFieldSchema,
  actorRefSchema,
  CONDITIONS_RESERVEES,
  conditionSchema,
  hasWhatSchema,
  partyWhoSchema,
  relationOrCampSchema,
  startleCauseSchema,
} from '../../data/schemas/grammaire/mecanique';
import type { Camp, Relation } from '../../engine/relations';
import { ChoixDeSpec, RefField, reposerLId } from '../compendium/refField/RefField';
import { NumberField } from '../NumberField';
import { CONDITION_TOUJOURS, recast } from '../../data/valeursNeuves';
import { unionDuNoeud } from '../../noyau/codex/editFields';
import { ATTACK_KIND_LABELS, valeurDeHas } from './interne/resumeDeCondition';


/** Sélecteur de héros d'une Condition de groupe : le quantificateur (`partyWhoSchema`) ou un état déclaré
 *  par le projet dont la forme admet la sélection (`FORMES_D_ETAT`). */
function SelecteurDeHeros({ who, narratif, onChange }: { who: PartySelector; narratif: NarratifBlock | undefined; onChange: (w: PartySelector) => void }) {
  const heros = etatsAdmettant(narratif?.etats, 'selectionner');
  const valeur = typeof who === 'object' ? `etat:${who.etat}` : who;
  return (
    <select className="cond-kind" aria-label="Héros visé" value={valeur}
      onChange={(e) => onChange(e.target.value.startsWith('etat:') ? { etat: e.target.value.slice(5) } : e.target.value === 'all' ? 'all' : 'any')}>
      {optionsDuNoeud(partyWhoSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      {heros.map((e) => <option key={e.id} value={`etat:${e.id}`}>{e.label}</option>)}
    </select>
  );
}

/** Condition `etat` : l'état lu (déclaré au projet) et, si sa forme admet la comparaison, la valeur
 *  comparée (vide = « défini »). */
function EtatFields({ cond, narratif, onChange }: { cond: Extract<Condition, { kind: 'etat' }>; narratif: NarratifBlock | undefined; onChange: (c: Condition) => void }) {
  const etats = narratif?.etats ?? [];
  const etat = etatsAdmettant(etats, 'comparer').find((e) => e.id === cond.etat);
  return (
    <span className="cond-time">
      <select className="cond-kind" aria-label="État de campagne lu" value={cond.etat} onChange={(e) => onChange({ kind: 'etat', etat: e.target.value })}>
        <option value="">— état de campagne —</option>
        {etats.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
      {etat && (
        <select className="cond-kind" aria-label="Valeur comparée" value={cond.value ?? ''}
          onChange={(e) => onChange(e.target.value ? { kind: 'etat', etat: cond.etat, value: e.target.value } : { kind: 'etat', etat: cond.etat })}>
          <option value="">est défini</option>
          {valeursDeclarees(etat).map((v) => <option key={v.id} value={v.id}>= {v.label}</option>)}
        </select>
      )}
    </span>
  );
}

const COMPARE_OPS: CompareOp[] = ['>=', '<=', '==', '<', '>'];

/** Le libellé de chaque variante de l'algèbre `Condition`, porté par son schéma (`unionDuNoeud`). */
const LIBELLE_DE_CONDITION = new Map(unionDuNoeud(conditionSchema)!.variantes.map((v) => [v.cle, v.libelle]));

/** Les variantes de Condition offertes, dans l'ordre du sélecteur, nommées par l'algèbre (`LIBELLE_DE_CONDITION`). */
const KIND_OPTIONS: [Condition['kind'], string][] = ([
  'always', 'flag', 'etat', 'time', 'hasItem', 'money', 'partyDead', 'compare', 'slThreshold', 'location',
  'attackKind', 'startleCause', 'woundsDealt', 'engagedAdvantageGap', 'engagedAdvantageLead', 'foeInLoS',
  'cibleEnVue', 'hiddenFromFoes', 'engaged', 'crewTest', 'roundDeCombat', 'nearestFoe', 'capability',
  'visiblePassive', 'relation', 'has', 'casterChaosDomain', 'skill', 'talent', 'career', 'species', 'status', 'all',
  'any', 'not',
] as const).map((k): [Condition['kind'], string] => [k, LIBELLE_DE_CONDITION.get(k)!]);

/** La Condition `has`, dont la branche se lit à son `what`. */
type ConditionHas = Extract<Condition, { kind: 'has' }>;

/** La `value` de la Condition `has` : sélecteur du registre que la branche `what` du schéma désigne
 *  (`valeurDeHas`). */
function ValeurDeHas({ cond, onChange }: { cond: ConditionHas; onChange: (value: string) => void }) {
  const { noeud, cfg } = valeurDeHas(cond);
  return <RefField cfg={cfg} noeud={noeud} ariaLabel={libelleDeValeur(hasWhatSchema, cond.what)} value={cond.value} onChange={(v) => onChange(typeof v === 'string' ? v : '')} />;
}

function TimeWindowFields({ window: w, onChange }: { window: TemporalCondition; onChange: (w: TemporalCondition) => void }) {
  const set = (patch: Partial<TemporalCondition>) => {
    const m = { ...w, ...patch };
    onChange(Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)) as TemporalCondition);
  };
  const field = (key: 'afterHour' | 'afterMinute' | 'beforeHour' | 'beforeMinute', max: number, title: string) => (
    <NumberField
      variant="nu" min={0} max={max} label={title} title={title}
      vide value={w[key]}
      onChange={(n) => set({ [key]: n ?? undefined })}
    />
  );
  return (
    <span className="cond-time">
      après {field('afterHour', 23, 'heure (0-23)')}:{field('afterMinute', 59, 'minute (0-59)')} avant {field('beforeHour', 23, 'heure (0-23)')}:{field('beforeMinute', 59, 'minute (0-59)')}
    </span>
  );
}

export function ConditionEditor({ cond, onChange, kinds, narratif, noeud = conditionSchema }: {
  cond: Condition;
  onChange: (c: Condition) => void;
  /** Schéma de la Condition dans son contexte (l'algèbre de la famille mécanique du porteur ; défaut : la famille
   *  fermée). Une Condition RÉSERVÉE (`CONDITIONS_RESERVEES`) n'est offerte que s'il l'admet. */
  noeud?: { safeParse: (v: unknown) => { success: boolean } };
  /** Sous-ensemble de kinds offert (défaut : tous). Le porteur du `when` le fournit quand son
   *  contexte d'évaluation n'en couvre qu'une partie — ex. `CONDITION_KINDS_CARTE`. */
  kinds?: ReadonlySet<Condition['kind']>;
  /** Narratif du projet : ses états de campagne (Condition `etat`, sélecteur `{etat}`). Absent = racine de
   *  CATALOGUE, aucun état offert (`Ctx.narratif`). */
  narratif?: NarratifBlock;
}) {
  const admise = (k: Condition['kind']) =>
    k === cond.kind || !(CONDITIONS_RESERVEES as readonly string[]).includes(k) || noeud.safeParse({ kind: k }).success;
  const options = KIND_OPTIONS.filter(([k]) => (!kinds || kinds.has(k)) && admise(k));
  return (
    <div className="cond-node tf-row">
      <select className="cond-kind" value={cond.kind} onChange={(e) => onChange(recast(cond, e.target.value as Condition['kind']))}>
        {options.map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      {cond.kind === 'flag' && (
        <input className="cond-flag" value={cond.expr} placeholder="flag, !flag2 (ET de drapeaux)" onChange={(e) => onChange({ kind: 'flag', expr: e.target.value })} />
      )}
      {cond.kind === 'time' && <TimeWindowFields window={cond.window} onChange={(window) => onChange({ kind: 'time', window })} />}
      {cond.kind === 'hasItem' && (
        <>
          {/* L'objet catalogué se choisit par LIBELLÉ mais on stocke son `id` ; un nom hors catalogue
              (objet CUSTOM) est stocké tel quel → repli `it.name` côté runtime (evalCondition). */}
          <RefField
            cfg={{ ds: 'trappings', freeText: true }}
            value={cond.trappingId}
            onChange={(v) => onChange({ kind: 'hasItem', trappingId: (v as string) ?? '', count: cond.count })}
          />
          <label className="dr">×<NumberField variant="nu" label="Nombre d’exemplaires" min={1} value={cond.count ?? 1} onChange={(count) => onChange({ kind: 'hasItem', trappingId: cond.trappingId, count })} /></label>
        </>
      )}
      {cond.kind === 'money' && <SeuilDeBourse atLeast={cond.atLeast} onChange={(atLeast) => onChange({ kind: 'money', atLeast })} />}
      {cond.kind === 'partyDead' && (
        <SelecteurDeHeros narratif={narratif} who={cond.who} onChange={(who) => onChange({ kind: 'partyDead', who })} />
      )}
      {cond.kind === 'etat' && <EtatFields cond={cond} narratif={narratif} onChange={onChange} />}
      {cond.kind === 'compare' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.subject.who} onChange={(e) => onChange({ ...cond, subject: { ...cond.subject, who: e.target.value as ActorRef } })}>
            {optionsDuNoeud(actorRefSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="cond-kind" value={'field' in cond.subject ? cond.subject.field : 'condition'}
            onChange={(e) => onChange({ ...cond, subject: e.target.value === 'condition' ? { who: cond.subject.who, condition: '' } : { who: cond.subject.who, field: e.target.value as ActorField } })}>
            {optionsDuNoeud(actorFieldSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            <option value="condition">valeur d’un État</option>
          </select>
          {'condition' in cond.subject && (
            <input className="cond-flag" value={cond.subject.condition} placeholder="nom de l'État (ex. Brisé)" onChange={(e) => onChange({ ...cond, subject: { who: cond.subject.who, condition: e.target.value } })} />
          )}
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {/* Valeur comparée : une CONSTANTE, ou la donnée d'un AUTRE acteur (Taille cible < Taille attaquant). */}
          <select className="cond-kind" value={typeof cond.value === 'number' ? 'const' : 'actor'}
            onChange={(e) => onChange({ ...cond, value: e.target.value === 'const' ? 0 : { who: 'caster', field: 'woundsCurrent' } })}>
            <option value="const">une valeur</option>
            <option value="actor">donnée d’un acteur</option>
          </select>
          {typeof cond.value === 'number' ? (
            <NumberField variant="nu" label="Valeur comparée" value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
          ) : (
            <>
              <select className="cond-kind" value={cond.value.who} onChange={(e) => onChange({ ...cond, value: { who: e.target.value as ActorRef, field: (cond.value as { field: ActorField }).field } })}>
                {optionsDuNoeud(actorRefSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="cond-kind" value={'field' in cond.value ? cond.value.field : 'woundsCurrent'} onChange={(e) => onChange({ ...cond, value: { who: (cond.value as { who: ActorRef }).who, field: e.target.value as ActorField } })}>
                {optionsDuNoeud(actorFieldSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </>
          )}
        </span>
      )}
      {cond.kind === 'slThreshold' && (
        <span className="cond-time">marge
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NumberField variant="nu" label="Marge en Degrés de Réussite" min={0} value={cond.value} onChange={(value) => onChange({ ...cond, value })} /> DR
        </span>
      )}
      {cond.kind === 'cibleEnVue' && (
        <label className="cond-time"><input type="checkbox" checked={cond.hostiles === true}
          onChange={(e) => onChange(e.target.checked ? { kind: 'cibleEnVue', hostiles: true } : { kind: 'cibleEnVue' })} /> hostiles seulement</label>
      )}
      {cond.kind === 'nearestFoe' && (
        <span className="cond-time">ennemi proche
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NumberField variant="nu" label="Distance en cases" min={0} value={cond.value} onChange={(value) => onChange({ ...cond, value })} /> cases
        </span>
      )}
      {cond.kind === 'capability' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {optionsDuNoeud(actorRefSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="cond-flag" value={cond.id} placeholder="capacité (ex. braveheart)" onChange={(e) => onChange({ ...cond, id: e.target.value.trim() })} />
          <select className="cond-kind" value={cond.op ?? '>='} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NumberField variant="nu" label="Niveau de capacité comparé" min={0} value={cond.value ?? 1} onChange={(value) => onChange({ ...cond, value })} />
        </span>
      )}
      {cond.kind === 'location' && (
        <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ kind: 'location', is: e.target.value as HitLocation })}>
          {(Object.keys(HIT_LOCATION_LABELS) as HitLocation[]).map((l) => <option key={l} value={l}>{HIT_LOCATION_LABELS[l]}</option>)}
        </select>
      )}
      {cond.kind === 'attackKind' && (
        <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ kind: 'attackKind', is: e.target.value })}>
          {Object.keys(ATTACK_KIND_LABELS).map((k) => <option key={k} value={k}>{ATTACK_KIND_LABELS[k]}</option>)}
        </select>
      )}
      {cond.kind === 'startleCause' && (
        <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ kind: 'startleCause', is: e.target.value as 'noise' | 'magic' })}>
          {optionsDuNoeud(startleCauseSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {cond.kind === 'woundsDealt' && (
        <span className="cond-time">PB infligés
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NumberField variant="nu" label="Points de Blessure infligés" min={0} value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
        </span>
      )}
      {cond.kind === 'engagedAdvantageGap' && (
        <span className="cond-time">écart d’Avantage
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NumberField variant="nu" label="Écart d’Avantage" min={0} value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
        </span>
      )}
      {cond.kind === 'engagedAdvantageLead' && (
        <span className="cond-time">avance d’Avantage
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <NumberField variant="nu" label="Avance d’Avantage" value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
        </span>
      )}
      {cond.kind === 'visiblePassive' && (
        <span className="cond-time">
          <select className="cond-kind" aria-label="Porteur de l’atteinte visible" value={cond.who}
            onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {optionsDuNoeud(actorRefSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          porte une atteinte visible
        </span>
      )}
      {cond.kind === 'relation' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {optionsDuNoeud(actorRefSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          est
          <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ ...cond, is: e.target.value as Relation | Camp })}>
            <optgroup label="relatif au lanceur">
              {(['soi', 'allie', 'adversaire'] as const).map((r) => <option key={r} value={r}>{libelleDeValeur(relationOrCampSchema, r)}</option>)}
            </optgroup>
            <optgroup label="camp absolu">
              {(['groupe', 'neutre', 'hostile'] as const).map((r) => <option key={r} value={r}>{libelleDeValeur(relationOrCampSchema, r)}</option>)}
            </optgroup>
          </select>
        </span>
      )}
      {cond.kind === 'has' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {optionsDuNoeud(actorRefSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          a
          <select className="cond-kind" value={cond.what} onChange={(e) => onChange({ kind: 'has', who: cond.who, what: e.target.value as ConditionHas['what'], value: '' })}>
            {optionsDuNoeud(hasWhatSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ValeurDeHas cond={cond} onChange={(value) => onChange(cond.what === 'talent' ? { kind: 'has', who: cond.who, what: 'talent', value } : { ...cond, value })} />
          {cond.what === 'talent' && (
            <ChoixDeSpec type="talent" id={cond.value} value={cond.spec} ariaLabel="Spécialisation du Talent" onChange={(spec) => onChange({ ...cond, spec })} />
          )}
        </span>
      )}
      {cond.kind === 'casterChaosDomain' && (
        <span className="cond-time">
          Domaine du Chaos du lanceur =
          <input className="cond-flag" value={cond.is} placeholder="nurgle / slaanesh / tzeentch / indivisible" onChange={(e) => onChange({ ...cond, is: e.target.value })} />
        </span>
      )}
      {cond.kind === 'skill' && (
        <span className="cond-time">
          <RefField
            cfg={{ ds: 'skills', single: true }}
            value={cond.id}
            onChange={(v) => onChange(reposerLId(cond, (v as string) ?? ''))}
          />
          <ChoixDeSpec type="skill" id={cond.id} value={cond.spec} ariaLabel="Spécialisation de la Compétence" onChange={(spec) => onChange({ ...cond, spec })} />
          <label className="dr">≥ avances<NumberField variant="nu" label="Avances minimales" min={0} vide value={cond.advances} onChange={(n) => onChange({ ...cond, advances: n ?? undefined })} /></label>
          <SelecteurDeHeros narratif={narratif} who={cond.who ?? 'any'} onChange={(who) => onChange({ ...cond, who })} />
        </span>
      )}
      {cond.kind === 'talent' && (
        <span className="cond-time">
          <RefField
            cfg={{ ds: 'talents', single: true }}
            value={cond.id}
            onChange={(v) => onChange(reposerLId(cond, (v as string) ?? ''))}
          />
          <ChoixDeSpec type="talent" id={cond.id} value={cond.spec} ariaLabel="Spécialisation du Talent" onChange={(spec) => onChange({ ...cond, spec })} />
          <SelecteurDeHeros narratif={narratif} who={cond.who ?? 'any'} onChange={(who) => onChange({ ...cond, who })} />
        </span>
      )}
      {cond.kind === 'career' && (
        <span className="cond-time">
          <RefField
            cfg={{ ds: 'careers', single: true }}
            value={cond.id}
            onChange={(v) => onChange({ ...cond, id: (v as string) ?? '' })}
          />
          <SelecteurDeHeros narratif={narratif} who={cond.who ?? 'any'} onChange={(who) => onChange({ ...cond, who })} />
        </span>
      )}
      {cond.kind === 'species' && (
        <span className="cond-time">
          <RefField
            cfg={{ ds: 'species', single: true }}
            value={cond.id}
            onChange={(v) => onChange({ ...cond, id: (v as string) ?? '' })}
          />
          <SelecteurDeHeros narratif={narratif} who={cond.who ?? 'any'} onChange={(who) => onChange({ ...cond, who })} />
        </span>
      )}
      {cond.kind === 'status' && (
        <span className="cond-time">
          <input className="cond-flag" value={cond.atLeast} placeholder="Statut (ex. Argent 2)" onChange={(e) => onChange({ ...cond, atLeast: e.target.value })} />
          <SelecteurDeHeros narratif={narratif} who={cond.who ?? 'any'} onChange={(who) => onChange({ ...cond, who })} />
        </span>
      )}
      {(cond.kind === 'all' || cond.kind === 'any') && (
        <div className={`cond-children ${cond.kind}`}>
          {cond.of.map((c, i) => (
            <div className="cond-child" key={i}>
              <ConditionEditor cond={c} kinds={kinds} narratif={narratif} noeud={noeud} onChange={(nc) => onChange({ ...cond, of: cond.of.map((x, j) => (j === i ? nc : x)) })} />
              <button className="btn small danger" title="Retirer cette sous-condition" onClick={() => onChange({ ...cond, of: cond.of.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button className="btn small" onClick={() => onChange({ ...cond, of: [...cond.of, { kind: 'flag', expr: '' }] })}>
            + {cond.kind === 'all' ? 'ET' : 'OU'}
          </button>
        </div>
      )}
      {cond.kind === 'not' && (
        <div className="cond-children not">
          <ConditionEditor cond={cond.of} kinds={kinds} narratif={narratif} noeud={noeud} onChange={(nc) => onChange({ kind: 'not', of: nc })} />
        </div>
      )}
    </div>
  );
}

/** Variante pour un `when` OPTIONNEL : « Toujours » ↔ `undefined` (pas de condition). */
export function WhenEditor({ when, onChange, kinds, narratif }: {
  when?: Condition;
  onChange: (c: Condition | undefined) => void;
  kinds?: ReadonlySet<Condition['kind']>;
  narratif?: NarratifBlock;
}) {
  return <ConditionEditor cond={when ?? CONDITION_TOUJOURS} kinds={kinds} narratif={narratif} onChange={(c) => onChange(c.kind === 'always' ? undefined : c)} />;
}

type SeuilDeLaBourse = Extract<Condition, { kind: 'money' }>['atLeast'];

/** Seuil de la Condition `money` : un montant, ou une valeur liée du Flow relue par son nom (MDG 15 l.245-247). */
function SeuilDeBourse({ atLeast, onChange }: { atLeast: SeuilDeLaBourse; onChange: (s: SeuilDeLaBourse) => void }) {
  const seuil = seuilDeBourse(atLeast);
  return (
    <span className="cond-time">≥
      <label className="cond-time"><input type="checkbox" checked={'lie' in seuil}
        onChange={(e) => onChange(e.target.checked ? { brass: { tire: 'valeur' } } : {})} /> valeur liée</label>
      {'lie' in seuil
        ? <input className="cond-flag" value={seuil.lie} placeholder="nom de la valeur liée (ex. rancon)" onChange={(e) => onChange({ brass: { tire: e.target.value.trim() } })} />
        : (['gold', 'silver', 'brass'] as const).map((k) => (
          <label className="dr" key={k}>
            {k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
            <NumberField variant="nu" label={k === 'gold' ? 'Couronnes d’or' : k === 'silver' ? 'Pistoles d’argent' : 'Sous de cuivre'} min={0} vide value={seuil.montant[k]} onChange={(n) => onChange({ ...seuil.montant, [k]: n ?? undefined })} />
          </label>
        ))}
    </span>
  );
}
