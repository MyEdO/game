import { useState } from 'react';
import { NarratedSegments } from './NarratedLine';
import { Icon } from './Icon';
import type { CombatEvent } from '../state/combatLog';
import { Prose } from './Prose';

/** Forme minimale acceptée pour les combattants (suffit à `narrateEvent` — id/label/kind). */
interface ComLite { id: string; label: string; kind: string; }

/**
 * Journal en TIROIR (bas-droite, replié par défaut — façon BG3, mobile-first).
 * Deux contenus, un composant : en combat les événements structurés `battle.log` rendus par
 * `narrateEvent` (icône par kind + noms colorés par camp) ; en exploration le journal du groupe.
 * `initialOpen` = aide de test (SSR sans interaction). Pur à props.
 */
export function LogDrawer({ battle, journal, initialOpen = false, onOpenHistory }: {
  battle: { log: CombatEvent[]; combatants: ComLite[] } | null;
  journal: string[];
  initialOpen?: boolean;
  /** Accès à la relecture des conversations (#718 dernier lot) — bouton rendu SEULEMENT si fourni. */
  onOpenHistory?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className={`log-drawer ${open ? 'open' : ''}`}>
      {open && (
        <div className="ld-panel halo-champ">
          <div className="mini-title">{battle ? 'Journal de combat' : 'Journal'}</div>
          {onOpenHistory && (
            <button type="button" className="btn small" onClick={onOpenHistory}>
              <Icon id="journal/dialogue" size="sm" /> Conversations
            </button>
          )}
          {battle
            ? battle.log.slice(-30).map((l, i) => (
                <div key={i} className="jr-line">
                  <NarratedSegments event={l} combatants={battle.combatants} />
                </div>
              ))
            : journal.slice(-30).map((l, i) => (
                <div key={i} className="jr-line"><div className="jr-tx"><Prose md={l} compact /></div></div>
              ))}
          {!battle && journal.length === 0 && <p className="empty">— rien à signaler —</p>}
        </div>
      )}
      <button type="button" className="ld-btn skin-tole" data-ton="sombre" onClick={() => setOpen(!open)} title={open ? 'Fermer le journal' : 'Ouvrir le journal'}>
        <Icon id="nav/compendium" size="lg" />
      </button>
    </div>
  );
}
