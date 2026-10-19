/**
 * ÉDITEUR DE CONDITION — l'algèbre CLOSE de `Condition` (flag / créneau horaire / ET / OU / NON),
 * récursive. SOURCE UNIQUE de l'édition des conditions : le `when` d'un trigger / d'un choix de
 * dialogue / d'un lieu ou d'une route de la carte du monde (où « Toujours » = pas de condition →
 * `undefined`) ET le nœud `si` d'un Flow. La prop `kinds` BORNE l'offre au contexte d'évaluation du
 * porteur (ex. `CONDITION_KINDS_CARTE`) ; absente = toute l'algèbre. Remplace les
 * adaptateurs plats `whenFlag/whenWindow/buildWhen` (qui n'exprimaient que « flag ET créneau »).
 */
import type { Condition, ActorRef, ActorField, CompareOp, PartySelector } from '../../state/flow';
import type { NarratifBlock } from '../../state/campaignNarratif';
import type { TemporalCondition } from '../../state/scene';
import { HIT_LOCATION_LABELS, type HitLocation } from '../../engine/types';
import { libelleDeValeur, valeursDe } from '../../data/schemas/grammaire/meta';
import { etatsAdmettant, valeursDeclarees } from '../../data/schemas/defs-scenes/formes-d-etat';
import { actorFieldSchema, actorRefSchema, hasWhatSchema, partyWhoSchema, relationOrCampSchema, startleCauseSchema } from '../../data/schemas/grammaire/mecanique';
import type { Camp, Relation } from '../../engine/relations';
import { RefField } from '../compendium/refField/RefField';
import { NumberField } from '../NumberField';
import { ATTACK_KIND_LABELS } from './interne/resumeDeCondition';

/** Options `[valeur, libellé]` d'un nœud ÉNUMÉRÉ de la grammaire (`enumNomme`, #1694) — l'éditeur ne
 *  tient AUCUNE table de libellés : options ET noms viennent de la déclaration du nœud. */
const optionsDuNoeud = (noeud: unknown): [string, string][] => Object.entries(valeursDe(noeud) ?? {});

const ALWAYS: Condition = { kind: 'always' };

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

const KIND_OPTIONS: [Condition['kind'], string][] = [
  ['always', 'Toujours'],
  ['flag', 'Flag(s)'],
  ['etat', 'État de campagne'],
  ['time', 'Créneau horaire'],
  ['hasItem', 'Possède un objet'],
  ['money', 'Bourse ≥'],
  ['partyDead', 'Héros mort'],
  ['compare', 'État du porteur (comparaison)'],
  ['slThreshold', 'Marge (DR)'],
  ['location', 'Localisation touchée'],
  ['attackKind', 'Type d’attaque'],
  ['startleCause', 'Cause d’effarouchement'],
  ['woundsDealt', 'Blessures infligées'],
  ['engagedAdvantageGap', 'Écart d’Avantage (engagés)'],
  ['engagedAdvantageLead', 'Avance d’Avantage (sur tous les engagés)'],
  ['foeInLoS', 'Ennemi en Ligne de Vue'],
  ['hiddenFromFoes', 'Caché de l’ennemi (hors de vue)'],
  ['engaged', 'Engagé avec un ennemi'],
  ['crewTest', 'Au sein d’un Test d’équipage (à bord)'],
  ['nearestFoe', 'Distance à l’ennemi le plus proche'],
  ['capability', 'Capacité de combat'],
  ['visiblePassive', 'Atteinte VISIBLE (apparence)'],
  ['relation', 'Camp / relation'],
  ['has', 'Possède (Groupe/Talent/Trait)'],
  ['casterChaosDomain', 'Domaine du Chaos du lanceur'],
  ['skill', 'Compétence du groupe'],
  ['career', 'Carrière du groupe'],
  ['species', 'Espèce du groupe'],
  ['status', 'Statut du groupe ≥'],
  ['all', 'TOUS (ET)'],
  ['any', 'AU MOINS UN (OU)'],
  ['not', 'NON'],
];

/** Préserve le travail en CHANGEANT de type : composer (ET/OU/NON) ENVELOPPE la condition courante. */
export function recast(cond: Condition, kind: Condition['kind']): Condition {
  switch (kind) {
    case 'always': return ALWAYS;
    case 'flag': return { kind: 'flag', expr: cond.kind === 'flag' ? cond.expr : '' };
    case 'time': return { kind: 'time', window: cond.kind === 'time' ? cond.window : {} };
    case 'hasItem': return { kind: 'hasItem', trappingId: cond.kind === 'hasItem' ? cond.trappingId : '' };
    case 'money': return { kind: 'money', atLeast: cond.kind === 'money' ? cond.atLeast : { gold: 1 } };
    case 'partyDead': return { kind: 'partyDead', who: cond.kind === 'partyDead' ? cond.who : 'any' };
    case 'etat': return cond.kind === 'etat' ? cond : { kind: 'etat', etat: '' };
    case 'compare': return cond.kind === 'compare' ? cond : { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 };
    case 'slThreshold': return cond.kind === 'slThreshold' ? cond : { kind: 'slThreshold', op: '>=', value: 6 };
    case 'location': return { kind: 'location', is: cond.kind === 'location' ? cond.is : 'tete' };
    case 'attackKind': return { kind: 'attackKind', is: cond.kind === 'attackKind' ? cond.is : 'morsure' };
    case 'startleCause': return { kind: 'startleCause', is: cond.kind === 'startleCause' ? cond.is : 'noise' };
    case 'woundsDealt': return cond.kind === 'woundsDealt' ? cond : { kind: 'woundsDealt', op: '>', value: 0 };
    case 'engagedAdvantageGap': return cond.kind === 'engagedAdvantageGap' ? cond : { kind: 'engagedAdvantageGap', op: '>', value: 0 };
    case 'engagedAdvantageLead': return cond.kind === 'engagedAdvantageLead' ? cond : { kind: 'engagedAdvantageLead', op: '>', value: 0 };
    case 'foeInLoS': return { kind: 'foeInLoS' };
    case 'visiblePassive': return cond.kind === 'visiblePassive' ? cond : { kind: 'visiblePassive', who: 'target' };
    case 'hiddenFromFoes': return { kind: 'hiddenFromFoes' };
    case 'engaged': return { kind: 'engaged' };
    case 'crewTest': return { kind: 'crewTest' };
    case 'nearestFoe': return cond.kind === 'nearestFoe' ? cond : { kind: 'nearestFoe', op: '<=', value: 3 };
    case 'capability': return cond.kind === 'capability' ? cond : { kind: 'capability', who: 'target', id: 'braveheart', op: '>=', value: 1 };
    case 'relation': return cond.kind === 'relation' ? cond : { kind: 'relation', who: 'target', is: 'opponent' };
    case 'has': return cond.kind === 'has' ? cond : { kind: 'has', who: 'target', what: 'group', value: '' };
    case 'casterChaosDomain': return cond.kind === 'casterChaosDomain' ? cond : { kind: 'casterChaosDomain', is: 'nurgle' };
    case 'skill': return cond.kind === 'skill' ? cond : { kind: 'skill', id: '', who: 'any' };
    case 'career': return cond.kind === 'career' ? cond : { kind: 'career', id: '', who: 'any' };
    case 'species': return cond.kind === 'species' ? cond : { kind: 'species', id: '', who: 'any' };
    case 'status': return cond.kind === 'status' ? cond : { kind: 'status', atLeast: 'Bronze 1', who: 'any' };
    case 'all': return { kind: 'all', of: cond.kind === 'all' || cond.kind === 'any' ? cond.of : cond.kind === 'always' ? [] : [cond] };
    case 'any': return { kind: 'any', of: cond.kind === 'all' || cond.kind === 'any' ? cond.of : cond.kind === 'always' ? [] : [cond] };
    case 'not': return { kind: 'not', of: cond.kind === 'not' ? cond.of : cond };
  }
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

export function ConditionEditor({ cond, onChange, kinds, narratif }: {
  cond: Condition;
  onChange: (c: Condition) => void;
  /** Sous-ensemble de kinds offert (défaut : tous). Le porteur du `when` le fournit quand son
   *  contexte d'évaluation n'en couvre qu'une partie — ex. `CONDITION_KINDS_CARTE`. */
  kinds?: ReadonlySet<Condition['kind']>;
  /** Narratif du projet : ses états de campagne (Condition `etat`, sélecteur `{etat}`). Absent = racine de
   *  CATALOGUE, aucun état offert (`Ctx.narratif`). */
  narratif?: NarratifBlock;
}) {
  const options = kinds ? KIND_OPTIONS.filter(([k]) => kinds.has(k)) : KIND_OPTIONS;
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
      {cond.kind === 'money' && (
        <span className="cond-time">≥
          {(['gold', 'silver', 'brass'] as const).map((k) => (
            <label className="dr" key={k}>
              {k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
              <NumberField variant="nu" label={k === 'gold' ? 'Couronnes d’or' : k === 'silver' ? 'Pistoles d’argent' : 'Sous de cuivre'} min={0} vide value={cond.atLeast[k]} onChange={(n) => onChange({ kind: 'money', atLeast: { ...cond.atLeast, [k]: n ?? undefined } })} />
            </label>
          ))}
        </span>
      )}
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
              {(['self', 'ally', 'opponent'] as const).map((r) => <option key={r} value={r}>{libelleDeValeur(relationOrCampSchema, r)}</option>)}
            </optgroup>
            <optgroup label="camp absolu">
              {(['party', 'neutral', 'hostile'] as const).map((r) => <option key={r} value={r}>{libelleDeValeur(relationOrCampSchema, r)}</option>)}
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
          <select className="cond-kind" value={cond.what} onChange={(e) => onChange({ ...cond, what: e.target.value as 'group' | 'talent' | 'trait' | 'psych' })}>
            {optionsDuNoeud(hasWhatSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="cond-flag" value={cond.value} placeholder={cond.what === 'group' ? 'Groupe (ex. Morts-vivants)' : cond.what === 'talent' ? 'id Talent (ex. magie-des-arcanes)' : cond.what === 'psych' ? 'type psy (ex. frenesie)' : 'id Trait (ex. mort-vivant)'} onChange={(e) => onChange({ ...cond, value: e.target.value })} />
          {cond.what === 'talent' && (
            <input style={{ width: '6em' }} value={cond.spec ?? ''} placeholder="spéc. (Feu…)" onChange={(e) => onChange({ ...cond, spec: e.target.value || undefined })} />
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
            onChange={(v) => onChange({ ...cond, id: (v as string) ?? '' })}
          />
          <input style={{ width: '6em' }} value={cond.spec ?? ''} placeholder="spéc. (Serrures…)" onChange={(e) => onChange({ ...cond, spec: e.target.value || undefined })} />
          <label className="dr">≥ avances<NumberField variant="nu" label="Avances minimales" min={0} vide value={cond.advances} onChange={(n) => onChange({ ...cond, advances: n ?? undefined })} /></label>
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
              <ConditionEditor cond={c} kinds={kinds} narratif={narratif} onChange={(nc) => onChange({ ...cond, of: cond.of.map((x, j) => (j === i ? nc : x)) })} />
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
          <ConditionEditor cond={cond.of} kinds={kinds} narratif={narratif} onChange={(nc) => onChange({ kind: 'not', of: nc })} />
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
  return <ConditionEditor cond={when ?? ALWAYS} kinds={kinds} narratif={narratif} onChange={(c) => onChange(c.kind === 'always' ? undefined : c)} />;
}
