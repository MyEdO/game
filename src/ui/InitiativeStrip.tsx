import { PortraitTile } from './PortraitTile';
import { ALLY_TINT, ENEMY_TINT } from '../gameIso/teamColors';
import { strikesLast } from '../engine/qualities/dispatch';
import { baseWithTraits } from '../engine/characteristics';
import { talentInitiativeBonus } from '../engine/combatFeatures/dispatch';
import { rule } from '../engine/policy';
import { useRef } from 'react';
import { useRamenerEnVue } from './useRamenerEnVue';
import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { Icon } from './Icon';
import { GatedAction, raisonSi } from './GatedAction';

/** LDB 13 l.40. */
function initiativeTitle(c: Combatant): string {
  const base = baseWithTraits(c, 'initiative');
  const talent = talentInitiativeBonus(c);
  const talentPart = talent ? ` + Instinctif(${talent})` : '';
  switch (rule('combat-init-method')) {
    case 'fixed-i':
      return `Init(${base})${talentPart} = ${c.initiative}`;
    case 'roll-bi':
      return `d10 + BonusInit + BonusAg${talentPart} = ${c.initiative} (détail du jet non conservé)`;
    default: // 'roll-i'
      return `d10 + Init(${base})${talentPart} = ${c.initiative} (détail du jet non conservé)`;
  }
}

export type InitiativePhase = 'past' | 'current' | 'future';

export function initiativePhase(index: number, turn: number, over: boolean): InitiativePhase {
  if (over || turn < 0) return 'future';
  if (index < turn) return 'past';
  return index === turn ? 'current' : 'future';
}

export interface InitiativeStripProps {
  order: string[];
  turn: number;
  round: number;
  combatants: Combatant[];
  /** battle.over != null → plus de marqueur actif. */
  over: boolean;
  /** Ids des combattants pouvant « agir en premier » (canActFirst, calculé par CampaignView). */
  canFirstIds: string[];
  /** LDB 62 l.298-300. */
  freeFirstIds?: string[];
  /** Action de CIBLAGE en cours (#21) : le clic sur une tuile CIBLE ce combattant (titre adapté). */
  targeting?: boolean;
  /** Clic d'un portrait = MÊME comportement que cliquer le token sur la carte (attaque/charge/cast,
   *  ou inspection si rien n'est actionnable). Toujours présent — la frise n'est jamais inerte. */
  onActivate: (id: string) => void;
  /** Survol d'un portrait (frise uniquement) : pilote le réticule sur la carte + le peek caméra.
   *  `null` au relâchement. Souris seulement (le tactile n'a pas de survol). */
  onHover?: (id: string | null) => void;
  /** Combattant actuellement survolé (token carte OU portrait) — surligne le portrait correspondant
   *  (réciprocité). Lu depuis store.hovered par CampaignView. */
  hoveredId?: string | null;
  onPromote: (id: string) => void;
  /** Ids des héros pouvant déclencher Tir rapide pendant la pause (canPreemptRanged + contrôle local). */
  canPreemptIds?: string[];
  /** Héros dont le Tir rapide est ARMÉ (en attente d'une cible) — badge surligné. */
  preemptArmedId?: string | null;
  /** LDB 10. */
  onPreempt?: (id: string) => void;
  /** INTERRUPTEUR de la demande de pause au prochain Round (entrée `raise-hand` du registre) : il vit
   *  ICI parce que c'est l'ENCHAÎNEMENT DES ROUNDS qu'il suspend, pas une action du tour. État
   *  RÉPLIQUÉ (`battle.handRaisedBy` voyage dans le snapshot) : chaque siège voit qui demande la
   *  pause, et chacun ne retire que la SIENNE (bascule gratuite). ABSENT = le siège n'est pas dessiné :
   *  la commande s'adresse aux AUTRES joueurs (non-pertinence de site en partie locale, comme la
   *  rangée de ready-check `ReadyRow`). `reason` = refus VISIBLE du registre quand le geste est
   *  dessiné mais non offert. */
  hand?: { label: ReactNode; ariaLabel: string; raised: boolean; reason?: string; onToggle: () => void };
}

export function InitiativeStrip(p: InitiativeStripProps) {
  // La frise DÉFILE — colonne bornée à l'espace au-dessus du pont, bande horizontale sous 700 : sans
  // recentrage, l'acteur AU TRAIT peut vivre hors champ et le joueur ne voit pas qui joue.
  const auTrait = p.over || p.turn < 0 ? null : p.order[p.turn] ?? null;
  const refAuTrait = useRef<HTMLDivElement>(null);
  useRamenerEnVue(refAuTrait, auTrait !== null, auTrait);
  return (
    <div className="initiative-strip">
      <div className="is-tiles">
        <div className="is-round">Round {p.round}</div>
        {p.order.map((id, i) => {
          const c = p.combatants.find((x) => x.id === id);
          if (!c) return null;
          const isHero = c.kind === 'hero';
          const phase = initiativePhase(i, p.turn, p.over);
          return (
            <div
              key={id}
              ref={phase === 'current' ? refAuTrait : undefined}
              className="is-cell"
              data-phase={phase}
              aria-current={phase === 'current' ? 'step' : undefined}
              onMouseEnter={() => p.onHover?.(id)}
              onMouseLeave={() => p.onHover?.(null)}
            >
              {p.turn === -1 && (
                <span className={`is-score${strikesLast(c.weapons) ? ' lente' : ''}`}
                  title={strikesLast(c.weapons) ? `${initiativeTitle(c)} — arme Lente : frappe en dernier` : initiativeTitle(c)}>
                  {c.initiative}{strikesLast(c.weapons) ? <> <Icon id="ui/wait" size={10} /></> : null}
                </span>
              )}
              {/* Entrée de frise = vignette + liseré de camp (spec §1c-bis) : ni PV, ni nom, ni
                  États — ils vivent au bandeau de groupe et à l'arche. D'où `identity`. */}
              <PortraitTile
                c={c}
                ring={isHero ? ALLY_TINT : ENEMY_TINT}
                team={isHero ? 'ally' : 'enemy'}
                variant="identity"
                size="sm"
                active={phase === 'current'}
                hovered={c.id === p.hoveredId}
                onClick={() => p.onActivate(id)}
                title={p.targeting ? `${c.label} — cibler` : c.label}
              />
              {p.canFirstIds.includes(id) && (
                <button
                  type="button"
                  className={`is-first${p.freeFirstIds?.includes(id) ? ' free' : ''}`}
                  onClick={() => p.onPromote(id)}
                  title={p.freeFirstIds?.includes(id)
                    ? `${c.label} agit en premier ce Round — gratuit (arme Rapide)`
                    : `Dépense 1 point de Chance pour qu'${c.label} agisse en premier ce Round`}
                >
                  <Icon id="ui/preempt" size="sm" />{p.freeFirstIds?.includes(id) ? null : c.fortune ?? 0}
                </button>
              )}
              {p.canPreemptIds?.includes(id) && (
                <button
                  type="button"
                  className={`is-preempt${p.preemptArmedId === id ? ' armed' : ''}`}
                  onClick={() => p.onPreempt?.(id)}
                  title={p.preemptArmedId === id
                    ? `${c.label} — choisissez une cible pour son Tir rapide (re-cliquez pour annuler)`
                    : `Tir rapide : ${c.label} tire hors de son tour (épuise son Action et son Mouvement)`}
                >
                  <Icon id="action/shoot" size="sm" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {/* PIED DE LA FRISE : l'interrupteur de pause de Round. `data-action` = son entrée du registre —
          c'est CE marqueur que lit la garde d'atteignabilité des actions (la frise est une surface au
          même titre que la console). */}
      {p.hand && (
        <span className="is-hand" data-action="raise-hand" data-raised={p.hand.raised ? '' : undefined}>
          <GatedAction
            id="raise-hand"
            label={p.hand.label}
            ariaLabel={p.hand.ariaLabel}
            enabled={!p.hand.reason}
            {...raisonSi(p.hand.reason)}
            primary={false}
            ariaPressed={p.hand.raised}
            dense
            onClick={p.hand.onToggle}
          />
        </span>
      )}
    </div>
  );
}
