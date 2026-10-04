import type { JSX } from 'react';
/**
 * PEINTRE UNIQUE du chrome d'écran d'un jeton (#1176, P3-0f) : la barre de PV, la rangée d'icônes
 * d'états/buffs avec son report « +N », et la pastille d'état de FIN (#237).
 * L'unique surcouche des jetons le monte (`stage/TokenChromeOverlay`), au bord du disque d'un pion ou
 * au-dessus de la tête d'un billboard — et c'est structurel : deux peintres divergeraient d'un pixel,
 * d'une couleur de seuil ou d'un `<title>` d'accessibilité.
 *
 * Le repère est celui du JETON : origine au centre de son bloc d'empreinte, `badgeY` = l'ordonnée de
 * la TÊTE — le rayon du disque pour un pion, la hauteur du quad pour un billboard (`chromeHeadPx`).
 */
import { hpColor } from './teamColors';
import { CHROME_SLOTS } from './builders/tokenChrome';
import { IconG } from '../ui/Icon';
import type { IconId } from '../ui/icons';
import type { EndState } from '../engine/conditions';
import { END_STATE_VISUAL } from '../ui/endStateVisual';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Les places de la réserve sont FIXES : la place `i` est à la même abscisse quel que soit le nombre
 *  d'États portés, donc un État qui apparaît n'en pousse AUCUN autre (le rang se RECENTRAIT à chaque
 *  ajout : toutes les icônes se déplaçaient pour une seule qui arrive). Les places vides ne se peignent
 *  pas — un jeton du monde n'est pas un rack : elles sont réservées, pas dessinées. */
/** Pas d'une alvéole (px écran, repère du jeton). */
const SLOT_W = 11;
/** Abscisse du CENTRE de la place `i` — fonction de la RÉSERVE, jamais du contenu. */
const slotX = (i: number) => -(CHROME_SLOTS * SLOT_W) / 2 + SLOT_W / 2 + i * SLOT_W;

export interface TokenChromeMarksProps {
  /** Barre de PV au-dessus de la tête ; absente = aucune jauge (engin inerte, décor). */
  hp?: { current: number; max: number } | null;
  /** Icônes d'états/buffs (ids du registre `src/ui/icons`, déjà tronquées). */
  icons?: readonly IconId[];
  /** Surplus d'icônes non affichées (« +N »). */
  iconsMore?: number;
  /** État de FIN — pastille distincte au-dessus de la barre ; absent = combattant en état. */
  endState?: EndState | null;
  /** Ordonnée de la TÊTE dans le repère du jeton (négative : au-dessus des pieds). */
  badgeY: number;
}

export function TokenChromeMarks({ hp, icons, iconsMore = 0, endState, badgeY }: TokenChromeMarksProps): JSX.Element | null {
  const hpRatio = hp && hp.max > 0 ? clamp01(hp.current / hp.max) : null;
  const iconList = icons ?? [];
  const nIcons = iconList.length + (iconsMore > 0 ? 1 : 0);
  const endMark = endState ? END_STATE_VISUAL[endState] : null;
  if (hpRatio == null && nIcons === 0 && !endMark) return null;
  return (
    <>
      {(hpRatio != null || nIcons > 0) && (
        <g transform={`translate(0,${badgeY - 8})`} pointerEvents="none">
          {nIcons > 0 && (
            <g style={{ color: '#f2eef8' }}>
              {iconList.map((ic, i) => (
                <IconG key={i} id={ic} x={slotX(i) - 5} y={-13} size={10} />
              ))}
              {iconsMore > 0 && (
                <text x={slotX(iconList.length)} y={-4} fontSize={8} fill="#cdb8d8" textAnchor="middle">+{iconsMore}</text>
              )}
            </g>
          )}
          {hpRatio != null && (
            <>
              <rect x={-13} y={0} width={26} height={4} rx={2} fill="#000" opacity={0.65} />
              <rect x={-13} y={0} width={26 * hpRatio} height={4} rx={2} fill={hpColor(hpRatio)} />
            </>
          )}
        </g>
      )}
      {endMark && (
        <g className={`token-endmark ${endMark.className}`} transform={`translate(0,${badgeY - 22})`} pointerEvents="none">
          <title>{endMark.label}</title>
          <circle cx={0} cy={0} r={8.5} />
          <IconG id={endMark.icon} x={-6} y={-6} size={12} />
        </g>
      )}
    </>
  );
}
