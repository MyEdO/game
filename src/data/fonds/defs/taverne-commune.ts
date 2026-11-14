import type { FondDef } from '../types';

/** Taverne commune — salle de taverne du Vieux Monde au soir : colombage sombre, âtre rougeoyant
 *  à droite, table aux chopes et chandelle au centre, tonneau et étagère à pichets à gauche,
 *  silhouette d'un client levant sa chope devant le feu. Aplats superposés (pas de filtre ni de
 *  dégradé), tiers bas voilé pour laisser le texte du panneau lisible. Tokens `var(--…)` seuls. */
export const fond: FondDef = {
  id: 'taverne-commune',
  label: 'Taverne commune',
  svg: `
    <rect x="0" y="0" width="320" height="96" fill="var(--panel2)"/>
    <rect x="0" y="68" width="320" height="28" fill="var(--bg2)"/>
    <circle cx="268" cy="58" r="52" fill="var(--gold)" opacity="0.1"/>
    <circle cx="268" cy="62" r="34" fill="var(--gold)" opacity="0.14"/>
    <ellipse cx="262" cy="82" rx="42" ry="7" fill="var(--gold)" opacity="0.12"/>
    <rect x="0" y="0" width="320" height="11" fill="var(--ink)"/>
    <rect x="0" y="11" width="320" height="2" fill="var(--border)" opacity="0.5"/>
    <rect x="26" y="11" width="9" height="60" fill="var(--ink)"/>
    <rect x="148" y="11" width="9" height="60" fill="var(--ink)"/>
    <path d="M35 14 L92 46 L92 53 L35 22 Z" fill="var(--ink)" opacity="0.85"/>
    <path d="M148 14 L92 46 L92 53 L148 22 Z" fill="var(--ink)" opacity="0.85"/>
    <rect x="4" y="28" width="44" height="4" fill="var(--ink)"/>
    <rect x="10" y="18" width="8" height="10" rx="1" fill="var(--bg)"/>
    <rect x="24" y="16" width="9" height="12" rx="1" fill="var(--bg)"/>
    <rect x="6" y="46" width="30" height="34" rx="7" fill="var(--border)"/>
    <ellipse cx="21" cy="47" rx="14" ry="4" fill="var(--bg)"/>
    <rect x="6" y="54" width="30" height="3" fill="var(--ink)" opacity="0.9"/>
    <rect x="6" y="70" width="30" height="3" fill="var(--ink)" opacity="0.9"/>
    <rect x="11" y="50" width="3" height="28" fill="var(--gold)" opacity="0.15"/>
    <rect x="177" y="11" width="2" height="13" fill="var(--ink)"/>
    <circle cx="178" cy="30" r="10" fill="var(--gold)" opacity="0.2"/>
    <rect x="173" y="24" width="10" height="12" rx="1.5" fill="var(--ink)"/>
    <rect x="176" y="27" width="4" height="7" fill="var(--gold2)" opacity="0.9"/>
    <rect x="232" y="16" width="80" height="62" fill="var(--bg2)"/>
    <rect x="232" y="34" width="80" height="1.5" fill="var(--border)" opacity="0.3"/>
    <rect x="232" y="52" width="80" height="1.5" fill="var(--border)" opacity="0.3"/>
    <rect x="228" y="14" width="88" height="8" rx="2" fill="var(--ink)"/>
    <path d="M244 78 L244 42 Q270 27 296 42 L296 78 Z" fill="var(--shadow-ink)"/>
    <circle cx="270" cy="65" r="17" fill="var(--gold)" opacity="0.35"/>
    <path d="M261 74 Q259 60 270 51 Q268 62 275 55 Q281 64 277 74 Z" fill="var(--gold)"/>
    <path d="M266 74 Q265 63 271 58 Q276 66 273 74 Z" fill="var(--gold2)"/>
    <rect x="255" y="72" width="30" height="5" rx="2.5" fill="var(--ink)"/>
    <rect x="259" y="76" width="24" height="4" rx="2" fill="var(--bg)"/>
    <circle cx="217" cy="35" r="5.5" fill="var(--bg)"/>
    <path d="M209 78 L210 50 Q209 41 217 40 Q225 41 226 50 L226 58 L233 53 L236 58 L228 64 L227 78 Z" fill="var(--bg)"/>
    <rect x="231" y="46" width="6" height="7" rx="1" fill="var(--bg)"/>
    <circle cx="99" cy="45" r="9" fill="var(--gold)" opacity="0.22"/>
    <rect x="97" y="48" width="4" height="9" fill="var(--parchment)"/>
    <ellipse cx="99" cy="44.5" rx="2" ry="3.5" fill="var(--gold2)"/>
    <rect x="68" y="46" width="10" height="11" rx="1.5" fill="var(--ink)"/>
    <path d="M78 48 q5 0 5 4 q0 4 -5 4" fill="none" stroke="var(--ink)" stroke-width="2"/>
    <rect x="69" y="46" width="8" height="2" fill="var(--parchment)" opacity="0.7"/>
    <rect x="118" y="47" width="10" height="10" rx="1.5" fill="var(--ink)"/>
    <path d="M118 49 q-5 0 -5 3.5 q0 3.5 5 3.5" fill="none" stroke="var(--ink)" stroke-width="2"/>
    <rect x="119" y="48" width="1.5" height="8" fill="var(--gold)" opacity="0.35"/>
    <rect x="50" y="57" width="98" height="7" rx="2" fill="var(--border)"/>
    <rect x="50" y="64" width="98" height="2" fill="var(--ink)" opacity="0.8"/>
    <path d="M60 66 L56 82 L62 82 L66 66 Z" fill="var(--ink)"/>
    <path d="M136 66 L132 82 L138 82 L142 66 Z" fill="var(--ink)"/>
    <rect x="0" y="74" width="320" height="22" fill="var(--bg)" opacity="0.35"/>
    <rect x="0" y="86" width="320" height="10" fill="var(--bg)" opacity="0.4"/>
  `,
};
