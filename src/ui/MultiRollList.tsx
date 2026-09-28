import { Fragment } from 'react';
import { useGame } from '../state/store';
import { CharFrame } from './CharFrame';
import { RollRow } from './RollRow';
import { Icon } from './Icon';
import { Band } from './Band';
import { Stack } from './Layout';
import type { NightEntry } from '../state/restFlow';
import { resultLine, freeCons } from '../state/rollSeam';
import { StakeNote, StakeRule, stakeRuleOf } from './StakeNote';

/**
 * PROCÈS-VERBAL (brique multi-jets) : globalise en UN écran une CASCADE de jets de ROUTINE résolus en
 * lot — une ligne compacte par jet (tuile du concerné + rangée de jet CANONIQUE `RollRow`) ou par note.
 * L'anatomie du jet (valeur/cible/DR/issue) est celle du reste des modales (`RollRow` → `RollPanel` →
 * `RollLine`) : une SEULE anatomie de jet à l'écran. Lecture seule (recap de voyage, jets de PNJ, bilan
 * de nuit) ; né pour le bilan de nuit, pensé pour resservir (PV du jour de mer, #232).
 * Les lignes CONSÉCUTIVES d'une même rubrique (`entry.group` — les contributeurs d'un même Test
 * d'équipage) se rendent sous UNE bande titrée (primitive `Band`) : l'en-tête ne se répète plus.
 */
export function MultiRollList({ entries }: { entries: NightEntry[] }) {
  const party = useGame((s) => s.party);
  if (!entries.length) return <p className="rm-note">Une nuit sans histoire.</p>;
  // Regroupement par rubrique CONSÉCUTIVE (l'ordre du PV est celui de la journée — jamais retrié).
  const groups: { group?: string; items: NightEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.group != null && last.group === e.group) last.items.push(e);
    else groups.push({ group: e.group, items: [e] });
  }
  // L'ENJEU d'une rubrique est celui de l'ÉTAPE, pas de chaque contributeur : il se rend UNE fois par
  // bande (la première ligne qui en porte un fait foi), jamais répété par rangée.
  const stakeOf = (items: NightEntry[]) => items.find((x) => x.stake)?.stake;
  const row = (e: NightEntry, i: number) => {
    const actor = e.actorId ? party.find((h) => h.id === e.actorId) : undefined;
    return (
      <div key={e.id ?? i} className={`mrl-row ${e.tone ?? ''}`}>
        <span className="mrl-port">{actor && <CharFrame c={actor} variant="identity" size="xs" />}</span>
        <div className="mrl-roll">
          {/* Libellé (provenance du jet : rôle tenu, catégorie) AU-DESSUS de la rangée. */}
          <span className="mrl-label">{e.icon && <Icon id={e.icon} size="sm" />} {e.label}</span>
          {e.d
            ? <RollRow actor={actor} row={{ d: e.d, note: e.text ? resultLine(freeCons([e.text])) : e.text }} rolled interactive={false} />
            : (e.text ? <span className="mrl-text">{resultLine(freeCons([e.text]))}</span> : null)}
        </div>
      </div>
    );
  };
  return (
    <div className="mrl">
      {groups.map((g, gi) => {
        const stake = stakeOf(g.items);
        const body = <Stack gap="sm">{stake && <StakeNote stake={stake} />}{g.items.map(row)}</Stack>;
        return g.group
          // Le RENVOI de règle est accolé au titre de la bande (même affordance que le titre d'étape
          // d'une cascade), l'enjeu se lit dessous — une seule fois pour toute la rubrique.
          ? <Band key={`g-${gi}`} title={<>{g.group} <StakeRule rule={stake ? stakeRuleOf(stake) : undefined} /></>}>{body}</Band>
          : <Fragment key={`g-${gi}`}>{body}</Fragment>;
      })}
    </div>
  );
}
