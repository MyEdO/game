import type { CSSProperties } from 'react';
import type { RevealEntry } from '../state/store';
import { ParchmentCard } from './ParchmentCard';
import { TableRollLine } from './RollLine';
import { VsHeader } from './VsHeader';
import { conditionMeta } from '../gameIso/effectIcons';
import { conditionLabel } from '../data';
import { Icon } from './Icon';
import type { Combatant } from '../engine/types';
import { Prose } from './Prose';

/** Nom de la table tirée pour la rangée d100 (présentation canonique `TableRollLine`). */
const TABLE_LABEL: Partial<Record<RevealEntry['kind'], string>> = {
  miscast: 'Table des Imparfaites',
  critical: 'Table des Critiques',
  mutation: 'Tableau des Corruptions',
};

/**
 * Corps riche d'un Coup Critique (qui inflige → arme → victime, le dé, la localisation FR, les Blessures
 * ignorant BE+PA, les États, et chaque effet AVEC son explication RAW). PARTAGÉ par l'étape d'affichage
 * ET l'étape de choix de déviation (même rendu — la déviation fusionne choix Dévier/Subir et révélation).
 */
export function CriticalBody({ entry, actor, subject }: { entry: RevealEntry; actor?: Combatant; subject?: Combatant }) {
  return (
    <>
      <VsHeader actor={actor} target={subject} label={entry.weapon ?? 'Mains nues'} />

      <TableRollLine table={TABLE_LABEL[entry.kind] ?? entry.title} roll={entry.dice} result={entry.lines[0] ?? ''} />

      {entry.crit && (
        <div className="crit-stats">
          <span className="crit-stat" title="Blessures du Coup Critique : elles ignorent l'Endurance ET l'Armure.">
            <Icon id="resource/wounds" size="sm" /> {entry.crit.woundsLost} Blessure{entry.crit.woundsLost > 1 ? 's' : ''}
          </span>
          {entry.crit.conditions?.map((c) => (
            <span key={c.id} className="crit-cond" title={`État ${conditionLabel(c.id)}`}>
              <Icon id={conditionMeta(c.id).icon} size="sm" /> {conditionLabel(c.id)}
              {c.value > 1 ? ` ×${c.value}` : ''}
            </span>
          ))}
        </div>
      )}

      {entry.details && entry.details.length > 0 ? (
        <div className="crit-effects">
          <div className="mini-title">Effets &amp; séquelles</div>
          {entry.details.map((d, i) => (
            <div key={i} className="crit-effect">
              <span className="ce-text">{d.text}</span>
              {d.note && <span className="ce-note">{d.note}</span>}
            </div>
          ))}
        </div>
      ) : (
        entry.lines.slice(1).map((l, i) => (
          <p key={i} className="modal-log">
            {l}
          </p>
        ))
      )}
    </>
  );
}

/**
 * CORPS d'une étape d'AFFICHAGE portant une charge riche (`CascadeStep.reveal`) — routé par `kind`,
 * SOURCE UNIQUE du rendu d'une révélation (le Coup Critique, l'entretien de Round, la mutation, l'effet
 * d'auteur, l'entrée de zone) : la fenêtre qui l'accueille est la coquille de cascade, jamais une
 * seconde modale. Trois rendus, tous préexistants :
 *  - COUP CRITIQUE : le panneau détaillé `CriticalBody` ;
 *  - ENTRÉE DE ZONE : la carte-parchemin narrative (`ParchmentCard`, primitive partagée) ;
 *  - le reste : la rangée de tirage canonique (`TableRollLine` — le dé, puis la ligne atteinte) suivie
 *    des lignes de détail.
 */
export function RevealBody({ entry, actor, subject }: { entry: RevealEntry; actor?: Combatant; subject?: Combatant }) {
  if (entry.kind === 'critical') return <CriticalBody entry={entry} actor={actor} subject={subject} />;
  if (entry.kind === 'sceneEntry') {
    return (
      <ParchmentCard>
        {entry.lines.map((l, i) => (
          <div key={i} className="modal-log"><Prose md={l} /></div>
        ))}
      </ParchmentCard>
    );
  }
  return (
    <>
      <TableRollLine table={TABLE_LABEL[entry.kind] ?? entry.title} roll={entry.dice} result={entry.lines[0] ?? ''} />
      {entry.lines.slice(1).map((l, i) => (
        <p key={i} className="modal-log">
          {l}
        </p>
      ))}
    </>
  );
}

/**
 * BARRE DE TEMPS de l'auto-fermeture, réservée aux révélations GRAVES (arbitrage 2026-06-11) : le
 * compte à rebours d'un Critique / d'une mutation se VOIT, l'informatif mineur disparaît sans
 * cérémonie. Pied de la révélation, rendu à côté de `RevealBody` dans la coquille de jet.
 * La durée passe en VARIABLE CSS consommée par `reveal-body.css` (arbitrage A2 du 2026-09-18).
 */
export function RevealTimer({ ms }: { ms: number }) {
  return <div className="reveal-timer"><i style={{ '--reveal-timer-duree': `${ms}ms` } as CSSProperties} /></div>;
}
