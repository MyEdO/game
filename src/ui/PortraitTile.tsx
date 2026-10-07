import type { CSSProperties } from 'react';
import { RigPortrait } from './RigPortrait';
import { hpColor } from '../gameIso/teamColors';
import { StateChips } from './StateChips';
import { Icon } from './Icon';
import { endState } from '../engine/conditions';
import { END_STATE_VISUAL } from './endStateVisual';
import { LifeBar } from './LifeBar';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { useLongPress } from './useLongPress';

/**
 * Tuile-portrait compacte et UNIFIÉE — la SEULE façon d'afficher un personnage (HUD, modales,
 * pickers, écrans). L'API est volontairement fermée : 3 variantes × 5 tailles, AUCUN booléen
 * d'affichage (la soupe showPv/showGauge/hideStates est ce qui avait fait diverger les écrans).
 *  - `full`     : portrait + jauge + pastilles d'États (HUD, médecin, inspection) ;
 *  - `vital`    : portrait + jauge, sans États (sujet de modale, cibles) ;
 *  - `identity` : portrait seul (butin, ready-check, lignes de jet, marchand).
 * Règles dérivées (arbitrées 2026-06-12) :
 *  - PV chiffrés : HÉROS uniquement (ennemi/PNJ = jauge seule, les PB exacts restent à
 *    l'Inspection) et à partir de `md` (illisible en dessous) ;
 *  - la TUILE ne rend jamais le nom (API fermée) : elle le porte en `title`/`aria-label` (a11y) ;
 *    un appelant qui veut le nom VISIBLE le compose à l'EXTÉRIEUR, dans son propre markup ;
 *  - cadre = couleur d'identité/équipe (`ring`), fond d'équipe (`team`), KO grisé ✕,
 *    unité ACTIVE grossie à l'œil + liseré or + caret ▼, `selected` = tuile-radio des pickers.
 * Pur à props (testable en SSR), aucune lecture du store — voir CharFrame pour le wrapper connecté.
 */
export type CharVariant = 'full' | 'vital' | 'identity';
export type CharSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Côté de la vignette en px par taille (xs = lignes de jet, sm = frise, md = dock/modales,
 *  lg = cadre actif/inspection, xl = fiche). */
export const CHAR_SIZE_PX: Record<CharSize, number> = { xs: 28, sm: 44, md: 56, lg: 72, xl: 112 };

export interface PortraitTileProps {
  c: Combatant;
  /** Couleur du cadre : teinte d'équipe (frise) ou couleur d'identité du héros (dock). */
  ring: string;
  variant?: CharVariant;
  size?: CharSize;
  /** Unité active (HUD) : portrait grossi à l'ŒIL (`transform`, portrait-tile.css — la boîte de mise
   *  en page ne bouge pas) + liseré or + caret ▼. */
  active?: boolean;
  /** Tuile-radio d'un picker : accentuée comme choix courant. */
  selected?: boolean;
  /** Survolé (token sur la carte OU ce portrait) → léger halo de focus NEUTRE, distinct de l'actif
   *  (or) et du picker (sel). Réciprocité frise↔carte. */
  hovered?: boolean;
  /** Fond d'équipe derrière le portrait (vert allié / rouge ennemi). */
  team?: 'ally' | 'enemy';
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

export function PortraitTile({ c, ring, variant = 'full', size = 'md', active, selected, hovered, team, maxStates = 4, reserveStates = false, onClick, onInspect, title, decoratif = false }: PortraitTileProps) {
  const px = CHAR_SIZE_PX[size];
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  // État de FIN (#237) : SOURCE UNIQUE (endState) — distingue mort / inconscient / rendu / hors-combat
  // (une croix ✕ générique les confondait). null = en état (un héros à 0 PB reste À Terre, pas une fin).
  const es = endState(c);
  const endMark = es ? END_STATE_VISUAL[es] : null;
  const showGauge = variant !== 'identity' && !c.inert;
  const showPv = showGauge && c.kind === 'hero' && px >= CHAR_SIZE_PX.md;
  const Boite = decoratif ? 'span' : 'button';
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
    <div className="ptile-wrap" style={{ '--ptile-px': `${px}px` } as CSSProperties}>
      {/* Le chevron est porté par la GRAPPE : dans la tuile, le `transform` de l'unité au trait le
          grossirait et le remonterait avec elle (portrait-tile.css). */}
      {active && <i className="ptile-caret">▼</i>}
      <Boite
        {...(decoratif
          ? { 'aria-hidden': true }
          : {
              type: 'button' as const,
              onClick: () => { if (appuiLong.consomme()) return; onClick?.(); },
              title: nom,
              'aria-label': inspecter ? `${nom} — ${t('ptile.geste2eInspecter')}` : nom,
              ...geste2e,
            })}
        className={`ptile ${active ? 'active' : ''} ${selected ? 'sel' : ''} ${hovered ? 'hov' : ''} ${endMark ? `ko ${endMark.className}` : ''} ${team ? `team-${team}` : ''}`}
      >
        <span className="ptile-face">
          <RigPortrait combatant={c} size={px} ring={ring} />
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
      </Boite>
      {variant === 'full' && <StateChips c={c} max={maxStates} reserve={reserveStates} />}
    </div>
  );
}
