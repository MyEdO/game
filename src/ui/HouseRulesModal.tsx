import { useMemo, useState } from 'react';
import { rule, type OptionalRule, type RuleValue } from '../engine/policy';
import { setHouseRule, resetHouseRule, houseRulesMutability } from '../state/houseRules';
import { useGame } from '../state/store';
import { Icon } from './Icon';
import { NumberField } from './NumberField';
import { Tabs } from './Tabs';
import { GatedAction } from './GatedAction';
import { houseRuleTabs } from './houseRuleTabs';

const LOCK_NOTE_ID = 'hr-lock-note';

/**
 * Panneau « Règles maison » — GÉNÉRÉ depuis le registre `OPTIONAL_RULES`. Il ne connaît aucune règle
 * en dur : il itère le registre, le découpe en ONGLETS dérivés (`houseRuleTabs`, aucun groupe codé)
 * et rend un contrôle par entrée selon `kind`. Ajouter une règle optionnelle = ajouter une entrée au
 * registre, elle apparaît ICI automatiquement — dans son groupe, ou dans un onglet neuf dès que ce
 * groupe atteint le seuil. Les surcharges sont persistées immédiatement et lues en direct par le
 * moteur (`rule(id)`).
 *
 * Coquille BORNÉE : la barre d'onglets tient en tête et seul `.hr-body` défile, quelle que soit la
 * longueur du registre (77 règles, 15 sections).
 *
 * Verrou de combat : la mutabilité vient de `houseRulesMutability` (contrat unique, `state/houseRules`).
 * Le verrou étant de CLASSE, sa raison est écrite UNE fois en tête du panneau (`LOCK_NOTE_ID`) : les
 * contrôles et les boutons de remise au défaut s'y LIENT par `aria-describedby` (`GatedAction
 * reasonId=…`), aucune rangée ne la répète.
 *
 * CORPS UNIQUE de l'onglet « Règles maison » de l'écran Options (`OptionsSubScreen`) — donc rendu à
 * l'identique dans ses DEUX foyers : le menu principal hors partie et le menu système en jeu.
 */
export function HouseRulesPanel() {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const inBattle = useGame((s) => !!s.battle && !s.battle.over);
  const tabs = useMemo(() => houseRuleTabs(), []);
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? '');
  const active = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  const { mutable, reason: lockReason } = useMemo(() => houseRulesMutability(), [inBattle]);

  const change = (id: string, v: RuleValue) => { setHouseRule(id, v); rerender(); };
  const reset = (id: string) => { resetHouseRule(id); rerender(); };

  return (
    <div className="house-rules">
      <Tabs
        label="Règles maison — sous-systèmes"
        active={tabKey}
        onChange={setTabKey}
        tabs={tabs.map((t) => ({ key: t.key, label: t.label, count: t.rules.length }))}
      />
      {lockReason && <p className="hint" id={LOCK_NOTE_ID}>{lockReason}</p>}
      <div className="hr-body">
        {active?.groups.map((g) => (
          <section key={g} className="hr-group">
            {active.groups.length > 1 && <h4 className="mini-title">{g}</h4>}
            {active.rules.filter((r) => r.group === g).map((r) => (
              <HouseRuleRow key={r.id} regle={r} mutable={mutable} onChange={change} onReset={reset} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Résout sur le store le nom d'action DÉCLARÉ par une entrée du registre (`RuleAction.run`). Ce nom
 * traverse une frontière de couches — le moteur, pur, ne peut pas typer les clés du store — d'où la
 * lecture indexée. En DEV, un nom qui ne désigne pas une fonction LÈVE : un renommage du store se
 * voit à la recette au lieu de faire disparaître le bouton en silence (garde statique de la liaison :
 * `rule-action-wiring.test.ts`).
 */
function storeAction(store: object, name: string | undefined): (() => void) | undefined {
  if (!name) return undefined;
  const fn = (store as Record<string, unknown>)[name];
  if (typeof fn === 'function') return fn as () => void;
  if (import.meta.env?.DEV) {
    throw new Error(`Action de règle inconnue : « ${name} » — aucune fonction de ce nom sur le store (voir RuleAction.run, engine/policy.ts).`);
  }
  return undefined;
}

function HouseRuleRow({
  regle, mutable, onChange, onReset,
}: {
  regle: OptionalRule;
  /** Verrou de CLASSE (identique pour toutes les rangées) — sa raison est rendue en tête du panneau. */
  mutable: boolean;
  onChange: (id: string, v: RuleValue) => void;
  onReset: (id: string) => void;
}) {
  const val = rule(regle.id);
  const dirty = val !== regle.default;
  const tip = regle.hint ? `${regle.ref} — ${regle.hint}` : regle.ref;
  const describedBy = mutable ? undefined : LOCK_NOTE_ID;
  // Action DÉCLARÉE par l'entrée (`regle.action`), rendue quand la règle vaut sa valeur `when` : la
  // rangée ne connaît aucune règle, elle résout sur le store le nom d'action que l'entrée porte.
  const act = regle.action && val === regle.action.when ? regle.action : undefined;
  const run = useGame((s) => storeAction(s, act?.run));
  return (
    <>
      <div className="hr-row" title={tip}>
        <span className="hr-label">
          {regle.label}
          {dirty && (
            <GatedAction
              id={`${regle.id}-reset`}
              label="↺"
              ariaLabel="Revenir au défaut (RAW)"
              enabled={mutable}
              reasonId={LOCK_NOTE_ID}
              primary={false}
              btnClassName="small"
              onClick={() => onReset(regle.id)}
            />
          )}
        </span>
        <span className="hr-control">
          {regle.kind === 'flag' && (
            <input
              type="checkbox" aria-label={regle.label} checked={val === true} disabled={!mutable}
              aria-describedby={describedBy} onChange={(e) => onChange(regle.id, e.target.checked)}
            />
          )}
          {regle.kind === 'mode' && (
            <select
              aria-label={regle.label} value={String(val)} disabled={!mutable}
              aria-describedby={describedBy} onChange={(e) => onChange(regle.id, e.target.value)}
            >
              {(regle.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {regle.kind === 'param' && (
            <NumberField
              variant="nu" label={regle.label} value={Number(val)} min={regle.min} max={regle.max} step={regle.step ?? 1}
              disabled={!mutable} describedBy={describedBy}
              onChange={(n) => onChange(regle.id, n)}
            />
          )}
        </span>
        <span className="hr-ref">{regle.ref}</span>
      </div>
      {act && run && (
        <div className="hr-action">
          <button className="btn btn-resource" onClick={run}>
            <Icon id={act.icon} size="sm" /> {act.label}
          </button>
        </div>
      )}
    </>
  );
}
