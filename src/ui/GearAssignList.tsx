import { useGame, type LootGear } from '../state/store';
import { giveTrappingQualities } from '../engine/items';
import { appraiseRefus } from '../state/merchantFlow';
import { GatedAction, raisonSi } from './GatedAction';
import { PortraitPicker } from './console/PortraitPicker';
import { QualityChips } from './EntityChip';
import type { Combatant } from '../engine/types';
import { MINUTES_PER_DAY } from '../engine/clock';
import { Icon } from './Icon';

/**
 * Liste de butin ATTRIBUABLE — brique partagée écran de victoire / fenêtre de loot : chaque ligne
 * porte son nom (magique, qualités une fois révélées), ses actions de révélation — Évaluer
 * (LDB 09 l.241) / Détecter (Talent Détection d'artefact, LDB 10 l.336) —
 * et l'attribution par portrait (montrer, pas écrire).
 */
export function GearAssignList({ gear, assignable, onAssign, onAppraise }: {
  gear: LootGear[];
  assignable: Combatant[];
  onAssign: (index: number, heroId: string) => void;
  /** Absent = lecture seule (pas d'actions de révélation — ex. invité coop). */
  onAppraise?: (index: number, mode: 'evaluate' | 'detect') => void;
}) {
  const party = useGame((s) => s.party);
  const today = useGame((s) => Math.floor(s.gameTime / MINUTES_PER_DAY));
  const refusEval = appraiseRefus(party);
  const refusDetect = appraiseRefus(party, 'detect');
  return (
    <ul className="gear-list">
      {gear.map((g, i) => {
        const fx = g.effect;
        const unidentified = fx.identified === false;
        const aura = !!fx.magicKnown;
        // Qualités affichées = celles de l'objet REÇU (def du catalogue + magiques), pas seulement les
        // magiques portées par l'Effet — un objet catalogué (Bâton de combat : Assommante, Défensive)
        // porte ses qualités dans sa def. Masquées tant que non identifié (révélées par Évaluation).
        const quals = giveTrappingQualities(fx);
        return (
          <li key={`${g.label}-${i}`} className="gear-row">
            <span className="gear-name">
              {g.label}
              {(g.magic || aura) && (
                <span title={unidentified ? (aura ? 'Aura magique sentie — règles non identifiées' : 'Objet magique — qualités à révéler') : 'Objet magique'}> <Icon id="action/cast" size="sm" /></span>
              )}
              {unidentified
                ? <span className="gear-unid">{aura ? 'magique, non identifié' : 'non identifié'}</span>
                : quals.length
                  ? <>{' '}<QualityChips qualities={quals} /></>
                  : null}
            </span>
            {onAppraise && unidentified && (
              <span className="gear-acts">
                {fx.appraiseTriedDay !== today && (
                  <GatedAction
                    id={`gear-eval-${i}`}
                    label="Évaluer"
                    enabled={!refusEval}
                    {...raisonSi(refusEval)}
                    descOfferte="Évaluation (Int) : révèle les qualités cachées et estime le prix — un échec verrouille jusqu'à demain"
                    onClick={() => onAppraise(i, 'evaluate')}
                    primary={false}
                    btnClassName="gear-act"
                  />
                )}
                {!fx.detectTried && (
                  <GatedAction
                    id={`gear-detect-${i}`}
                    label="Détecter"
                    enabled={!refusDetect}
                    {...raisonSi(refusDetect)}
                    descOfferte="Détection d'artefact (Intuition, au toucher) : sentir l'aura — une seule tentative par objet"
                    onClick={() => onAppraise(i, 'detect')}
                    primary={false}
                    btnClassName="gear-act"
                  />
                )}
              </span>
            )}
            <span className="gear-assign">
              {/* Attribution par portrait → picker mutualisé (cf. PortraitPicker, partagé avec le
                  choix du lanceur d'un Test et la cible montée) — clic = donner à ce héros. */}
              <PortraitPicker
                choices={assignable.map((h) => ({ c: h, title: `Donner « ${g.label} » à ${h.label}` }))}
                onPick={(id) => onAssign(i, id)}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
