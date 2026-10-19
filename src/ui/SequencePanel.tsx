/**
 * TABLEAU DE MARQUE d'une séquence EN COURS (#1279 S1) — le score par camp, la manche et la phase,
 * montrés PENDANT les manches. Sans lui, une partie de Bras de fer de six manches est AVEUGLE : les
 * cumuls vivent dans l'état de séquence et n'apparaissaient nulle part (la fenêtre disait « Jet en
 * cours… »).
 *
 * Rien n'est DÉRIVÉ ici : la donnée vient du système lui-même (`SequenceDef.board`, lu par
 * `sequenceBoardOf`) — l'UI ne connaît ni jeu ni poursuite. Composé des primitives partagées :
 * `Band` (bande titrée de rubrique, compteur à droite) et `LifeBar` (barre LISSE — un cumul vers une
 * cible est une vraie jauge continue, jamais des paliers discrets, donc pas `NotchGauge`). Un camp
 * SANS cible (score nu) n'a pas de jauge : sa valeur seule est montrée.
 */
import { useGame } from '../state/store';
import { sequenceBoardOf } from '../state/sequenceCore';
import { Band } from './Band';
import { LifeBar } from './LifeBar';
import { t } from '../i18n';
import { stepFraction } from '../noyau/rollSeam';

export function SequencePanel() {
  // Re-rendu à chaque avance de séquence : le slot `sequence` est la source (cumuls + rang de manche).
  const seq = useGame((s) => s.sequence);
  const board = seq ? sequenceBoardOf(useGame.getState) : null;
  if (!board) return null;

  // Le compteur est le SEUL texte que ce panneau produit : deux patrons complets du catalogue (avec
  // et sans phase), le rang passant par la fabrique de fraction du seam.
  const compteur = board.rounds
    ? (board.phase
      ? t('seqPanel.manchePhase', { n: stepFraction(Math.min(board.round, board.rounds), board.rounds), phase: board.phase })
      : t('seqPanel.manche', { n: stepFraction(Math.min(board.round, board.rounds), board.rounds) }))
    : t('seqPanel.manche', { n: board.round });

  return (
    <Band title={board.title} right={compteur}>
      <div data-seq-board>
        {/* POT en jeu (famille 5) : déjà libellé par le système — l'UI ne convertit ni ne totalise. */}
        {board.pot && <p data-seq-pot><b>{board.pot}</b></p>}
        {board.camps.map((camp) => (
          <div key={camp.id}>
            {camp.target != null ? (
              <LifeBar
                stacked
                value={camp.score}
                max={camp.target}
                label={camp.label}
                tone={(v, m) => (v >= m ? 'ok' : 'neutral')}
                format={(v, m) => `${stepFraction(v, m)} ${board.unit ?? t('seqPanel.uniteDr')}`}
              />
            ) : (
              <p data-seq-score>
                <span>{camp.label}</span>
                <b>{camp.score}</b>
                {board.unit && <span className="muted"> {board.unit}</span>}
              </p>
            )}
            {camp.note && <p data-seq-note className="muted">{camp.note}</p>}
          </div>
        ))}
      </div>
    </Band>
  );
}
