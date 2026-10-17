import { useEffect } from 'react';
import { useGame } from '../state/store';
import { combatFeed, narrateIntent, narrateRefus } from '../gameIso/combatNarration';
import { eteindreRefus, REFUS_MS } from '../state/refusVisible';
import { scheduleFlowTimer, clearTrackedTimer } from '../state/combatTimers';
import { Icon } from './Icon';
import { TeamSegments } from './TeamSegments';

/**
 * Bandeau haut : annonce le beat de combat COURANT — projection de sources existantes (zéro état
 * dédié), par ordre de PRIORITÉ :
 *  1. le REFUS du geste qu'on vient de tenter (`state/refusVisible`) — c'est une réponse DIRECTE au
 *     joueur, elle passe devant tout le reste : un télégraphe d'IA en cours ne doit pas l'avaler,
 *     sinon le clic reste sans réponse à l'écran (spec HUD § 2026-08-19, « refus VISIBLE ») ;
 *  2. l'INTENTION télégraphiée de l'IA (`actorAim` → « X charge / vise / lance un sort sur Y ») ;
 *  3. sinon le RÉSULTAT (dernière ligne importante du journal, héros comme ennemis).
 * Le `ton` (critique / mise à mort / Peur / refus) renforce l'entrée ; la `key` ré-anime à chaque
 * beat — pour un refus elle porte son `nonce`, sans quoi deux refus IDENTIQUES d'affilée (cliquer
 * deux fois la même case hors de portee) laisseraient la bannière parfaitement immobile.
 * La TENUE est portée par la cadence (`combatDirector.beatHold`), pas ici. Affichage seul — sauf
 * l'EXTINCTION du refus, qui lui appartient : personne d'autre ne sait quand il a été lu.
 */
export function CombatBanner() {
  const battle = useGame((s) => s.battle);
  const aim = useGame((s) => s.actorAim);
  const refus = useGame((s) => s.refus);
  const nonce = refus?.nonce ?? null;
  useEffect(() => {
    if (nonce == null) return;
    const id = scheduleFlowTimer(() => eteindreRefus(useGame.getState, useGame.setState, nonce), REFUS_MS);
    return () => clearTrackedTimer(id);
  }, [nonce]);
  if (!battle || battle.over) return null;
  const line = refus ? narrateRefus(refus, battle.combatants)
    : aim ? narrateIntent(aim, battle.combatants)
    : combatFeed(battle.log, battle.combatants, 1)[0];
  const key = !line ? null
    : refus ? `refus-${refus.nonce}`
    : aim ? `aim-${aim.fromId}-${aim.toId}-${aim.kind}`
    : line.raw;

  return (
    <div className="combat-feed" role="status" aria-live="polite" aria-atomic="true">
      {line && (
        <div key={key} className={`cb-ev cb-now cb-tone-${line.tone} halo-champ`}>
          <span className="cb-ic"><Icon id={line.icon} size={15} /></span>
          <div className="cb-tx">
            <TeamSegments segments={line.segments} />
          </div>
        </div>
      )}
    </div>
  );
}
