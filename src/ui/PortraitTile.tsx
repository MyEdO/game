import type { CSSProperties } from 'react';
import { hpColor } from '../gameIso/teamColors';
import { teamRingDecor } from '../gameIso/builders/dynamicMarks';
import { StateChips } from './StateChips';
import { Icon } from './Icon';
import { endState } from '../engine/conditions';
import { END_STATE_VISUAL } from './endStateVisual';
import { END_STATE_APPEARANCE, endStateFilter } from '../gameIso/endStateAppearance';
import { LifeBar } from './LifeBar';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { useLongPress } from './useLongPress';

/**
 * Identité compacte partagée : repère de sol, nom visible et état de fin (`END_STATE_VISUAL`).
 * `full` ajoute jauge et États ; `vital` ajoute la jauge ; `identity` garde l'identité seule.
 * Une tuile `decoratif` laisse le nom et le geste au contrôle qui l'englobe.
 * API fermée : 3 variantes × 5 tailles, aucun booléen d'affichage. PV chiffrés : héros seulement, à
 * partir de `md` (arbitrage 2026-06-12).
 * Pure à props ; CharFrame fournit la décoration du combattant dans la population courante.
 */
export type CharVariant = 'full' | 'vital' | 'identity';
export type CharSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Côté de la vignette en px par taille (xs = lignes de jet, sm = frise, md = dock/modales,
 *  lg = cadre actif/inspection, xl = fiche). */
export const CHAR_SIZE_PX: Record<CharSize, number> = { xs: 28, sm: 44, md: 56, lg: 72, xl: 112 };

export interface PortraitTileProps {
  c: Combatant;
  variant?: CharVariant;
  size?: CharSize;
  /** Unité active (HUD) : liseré or, halo et caret ▼ à taille nominale. */
  active?: boolean;
  /** Tuile-radio d'un picker : accentuée comme choix courant. */
  selected?: boolean;
  /** Survolé (token sur la carte OU ce portrait) → léger halo de focus NEUTRE, distinct de l'actif
   *  (or) et du picker (sel). Réciprocité frise↔carte. */
  hovered?: boolean;
  /** Fond d'équipe derrière le portrait (vert allié / rouge ennemi). */
  team?: 'ally' | 'enemy';
  ring?: ReturnType<typeof teamRingDecor>;
  maxStates?: number;
  /** Cellule d'États à EMPREINTE STABLE (arbitrage user 2026-07-11) : rendue vide sans État pour que
   *  les rangées-personnages d'une LISTE gardent leurs colonnes alignées. Défaut `false` (HUD/dock). */
  reserveStates?: boolean;
  onClick?: () => void;
  /** GESTE SECONDAIRE de la tuile : INSPECTER ce personnage. TROIS surfaces pour un chemin, le patron de
   *  l'alvéole (`CombatConsole:ConsoleCell`) — clic droit, appui long (`useLongPress`), touche Menu ou
   *  Maj+F10 sur la tuile focalisée —, annoncées dans le nom accessible. */
  onInspect?: () => void;
  title?: string;
  /** Tuile DÉCORATIVE : rendue en `<span>` muet (`aria-hidden`) au lieu d'un `<button>` — pour une
   *  tuile posée DANS un contrôle qui porte déjà le geste et le nom (un candidat de panneau-paramètre
   *  est un bouton : y imbriquer un bouton est du HTML invalide, et le clic devient ambigu). */
  decoratif?: boolean;
}

export function PortraitTile({ c, variant = 'full', size = 'md', active, selected, hovered, team, ring = teamRingDecor(c), maxStates = 4, reserveStates = false, onClick, onInspect, title, decoratif = false }: PortraitTileProps) {
  const px = CHAR_SIZE_PX[size];
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  const es = endState(c);
  const endMark = es ? END_STATE_VISUAL[es] : null;
  const showGauge = variant !== 'identity' && !c.inert;
  const showPv = showGauge && c.kind === 'hero' && px >= CHAR_SIZE_PX.md;
  const interactif = !decoratif && !!(onClick || onInspect);
  const Boite = interactif ? 'button' : 'span';
  const inspecter = decoratif ? undefined : onInspect;
  // L'appui long AVALE la salve qu'il précède (`consomme`, lu par `click` ET `contextmenu`) : sans quoi
  // le doigt ouvrirait la fiche PUIS jouerait le clic primaire de la tuile.
  const appuiLong = useLongPress(inspecter);
  const nom = title ?? c.label;
  const geste2e = inspecter
    ? {
        onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (appuiLong.consomme()) return; inspecter(); },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return;
          e.preventDefault();
          inspecter();
        },
        ...appuiLong.handlers,
      }
    : null;
  return (
    <div className="ptile-wrap" data-fin={es ?? undefined} style={{ '--ptile-px': `${px}px`, '--ptile-ring': ring.color, '--ptile-end-opacity': es ? END_STATE_APPEARANCE[es].opacity : undefined, '--ptile-end-filter': es ? endStateFilter(es) : undefined } as CSSProperties}>
      {active && <i className="ptile-caret">▼</i>}
      <Boite
        {...(decoratif
          ? { 'aria-hidden': true }
          : {
              ...(interactif ? { type: 'button' as const } : {}),
              onClick: () => { if (appuiLong.consomme()) return; onClick?.(); },
              title: nom,
              'aria-label': inspecter ? `${nom} — ${t('ptile.geste2eInspecter')}` : nom,
              ...geste2e,
            })}
        className={`ptile ${active ? 'active' : ''} ${selected ? 'sel' : ''} ${hovered ? 'hov' : ''} ${team ? `team-${team}` : ''}`}
      >
        <span className="ptile-face">
          <svg className="ptile-ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="18" fill="none" stroke="var(--ptile-ring)" strokeWidth="4" strokeDasharray={ring.dash} />
          </svg>
          {endMark && (
            <span className={`end-mark ${endMark.className}`} title={endMark.label} aria-label={endMark.label}>
              <Icon id={endMark.icon} size="sm" />
            </span>
          )}
        </span>
        {showGauge && (
          <LifeBar
            value={c.wounds.current}
            max={c.wounds.max}
            color={hpColor(ratio)}
            overlay
            className="ptile-gauge"
            title={showPv ? `Blessures : ${c.wounds.current}/${c.wounds.max}` : 'Blessures'}
            format={() => (showPv ? (c.dead ? <Icon id="journal/death" size="sm" /> : `${c.wounds.current}/${c.wounds.max}`) : null)}
          />
        )}
        {!decoratif && <span className="ptile-name clamp">{c.label}</span>}
      </Boite>
      {variant === 'full' && <StateChips c={c} max={maxStates} reserve={reserveStates} />}
    </div>
  );
}
