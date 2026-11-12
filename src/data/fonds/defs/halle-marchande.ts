import type { FondDef } from '../types';

/** Halle marchande — halle de marché d'Empire au matin : charpente basse à poteaux et écharpes en
 *  chevron, étal de gauche sous auvent de toile rayée (poteries et fruits au comptoir), jambons et
 *  pichet suspendus à la poutre, tonneau, cageots et sac au pied des étals, étoffes pendues sous
 *  l'auvent de droite, chalands en silhouettes, lumière de matinée entrant par le fond de la halle.
 *  Aplats superposés (pas de filtre ni de dégradé), tiers bas voilé pour laisser le texte du panneau
 *  lisible. Tokens `var(--…)` seuls. */
export const fond: FondDef = {
  id: 'halle-marchande',
  label: 'Halle marchande',
  svg: `
    <rect x="0" y="0" width="320" height="96" fill="var(--panel2)"/>
    <rect x="0" y="66" width="320" height="30" fill="var(--bg2)"/>
    <circle cx="278" cy="34" r="48" fill="var(--gold)" opacity="0.1"/>
    <circle cx="281" cy="38" r="27" fill="var(--gold)" opacity="0.13"/>
    <ellipse cx="264" cy="80" rx="48" ry="7" fill="var(--gold)" opacity="0.12"/>
    <rect x="0" y="0" width="320" height="10" fill="var(--ink)"/>
    <rect x="0" y="10" width="320" height="2" fill="var(--border)" opacity="0.5"/>
    <rect x="18" y="10" width="8" height="58" fill="var(--ink)"/>
    <rect x="196" y="10" width="8" height="58" fill="var(--ink)"/>
    <path d="M26 13 L58 33 L58 39 L26 20 Z" fill="var(--ink)" opacity="0.85"/>
    <path d="M196 13 L164 33 L164 39 L196 20 Z" fill="var(--ink)" opacity="0.85"/>
    <path d="M6 14 L90 14 L82 31 L14 31 Z" fill="var(--parchment)" opacity="0.55"/>
    <path d="M26 14 L38 14 L33 31 L21 31 Z" fill="var(--accent)" opacity="0.45"/>
    <path d="M58 14 L70 14 L65 31 L53 31 Z" fill="var(--accent)" opacity="0.45"/>
    <rect x="13" y="30" width="70" height="2.5" fill="var(--ink)"/>
    <rect x="12" y="46" width="68" height="6" rx="1.5" fill="var(--border)"/>
    <rect x="12" y="52" width="68" height="2" fill="var(--ink)" opacity="0.8"/>
    <path d="M22 54 L18 70 L24 70 L28 54 Z" fill="var(--ink)"/>
    <path d="M70 54 L66 70 L72 70 L76 54 Z" fill="var(--ink)"/>
    <rect x="20" y="37" width="8" height="9" rx="1" fill="var(--bg)"/>
    <rect x="32" y="35" width="9" height="11" rx="1" fill="var(--bg)"/>
    <path d="M48 42 q6 6 12 0 l0 4 l-12 0 Z" fill="var(--bg)"/>
    <circle cx="68" cy="44" r="2.2" fill="var(--accent)" opacity="0.9"/>
    <circle cx="72.5" cy="44.5" r="2" fill="var(--accent)" opacity="0.75"/>
    <circle cx="70" cy="41.5" r="2" fill="var(--gold)" opacity="0.5"/>
    <rect x="99" y="10" width="2" height="8" fill="var(--ink)"/>
    <path d="M96 18 Q92 26 97 31 Q100 34 103 31 Q107 25 102 18 Z" fill="var(--accent)"/>
    <path d="M97 20 Q95 26 98 30" fill="none" stroke="var(--gold)" stroke-width="1" opacity="0.35"/>
    <rect x="115" y="10" width="2" height="12" fill="var(--ink)"/>
    <path d="M112 22 Q108 31 113 36 Q116 39 119 35 Q123 29 118 22 Z" fill="var(--accent)"/>
    <rect x="133" y="10" width="2" height="7" fill="var(--ink)"/>
    <rect x="130" y="17" width="9" height="11" rx="1.5" fill="var(--bg)"/>
    <rect x="131" y="17" width="7" height="2" fill="var(--parchment)" opacity="0.6"/>
    <rect x="98" y="50" width="17" height="20" rx="4.5" fill="var(--border)"/>
    <ellipse cx="106.5" cy="50.5" rx="8" ry="2.5" fill="var(--bg)"/>
    <rect x="98" y="56" width="17" height="2.5" fill="var(--ink)" opacity="0.9"/>
    <rect x="98" y="64" width="17" height="2.5" fill="var(--ink)" opacity="0.9"/>
    <rect x="121" y="56" width="17" height="14" fill="var(--border)"/>
    <path d="M121 56 L138 70 M138 56 L121 70" stroke="var(--ink)" stroke-width="1.4" opacity="0.8"/>
    <rect x="124" y="47" width="12" height="9" fill="var(--border)"/>
    <rect x="124" y="47" width="12" height="2" fill="var(--ink)" opacity="0.8"/>
    <path d="M85 70 Q83 56 92 54 Q101 56 99 70 Z" fill="var(--parchment)" opacity="0.6"/>
    <rect x="89" y="53" width="6" height="2.5" rx="1" fill="var(--ink)" opacity="0.8"/>
    <circle cx="152" cy="38" r="5" fill="var(--bg)"/>
    <path d="M145 74 L146 51 Q145 43 152 42 Q159 43 160 51 L159 74 Z" fill="var(--bg)"/>
    <rect x="159" y="55" width="9" height="7" rx="2" fill="var(--bg)"/>
    <path d="M160 55 q3.5 -4 7 0" fill="none" stroke="var(--bg)" stroke-width="1.5"/>
    <path d="M212 16 L308 16 L300 32 L220 32 Z" fill="var(--parchment)" opacity="0.5"/>
    <path d="M238 16 L250 16 L246 32 L234 32 Z" fill="var(--gold)" opacity="0.3"/>
    <path d="M272 16 L284 16 L280 32 L268 32 Z" fill="var(--gold)" opacity="0.3"/>
    <rect x="219" y="31" width="82" height="2.5" fill="var(--ink)"/>
    <path d="M226 33 L240 33 L239 57 Q233 61 227 57 Z" fill="var(--accent)" opacity="0.75"/>
    <path d="M246 33 L258 33 L257 51 Q252 55 247 51 Z" fill="var(--gold)" opacity="0.45"/>
    <path d="M264 33 L278 33 L277 59 Q271 63 265 59 Z" fill="var(--parchment)" opacity="0.75"/>
    <rect x="270" y="34" width="1.5" height="26" fill="var(--ink)" opacity="0.25"/>
    <circle cx="291" cy="45" r="4" fill="var(--bg)"/>
    <path d="M286 72 L287 54 Q286 48 291 47 Q296 48 297 54 L296 72 Z" fill="var(--bg)"/>
    <circle cx="304" cy="46" r="3.5" fill="var(--bg)"/>
    <path d="M300 72 L300 54 Q300 49 304 48.5 Q308 49 308 54 L308 72 Z" fill="var(--bg)"/>
    <ellipse cx="44" cy="70" rx="7" ry="1.6" fill="var(--ink)" opacity="0.3"/>
    <ellipse cx="172" cy="72" rx="8" ry="1.6" fill="var(--ink)" opacity="0.3"/>
    <ellipse cx="232" cy="69" rx="6" ry="1.4" fill="var(--ink)" opacity="0.25"/>
    <rect x="0" y="74" width="320" height="22" fill="var(--bg)" opacity="0.35"/>
    <rect x="0" y="86" width="320" height="10" fill="var(--bg)" opacity="0.4"/>
  `,
};
