import type { FondDef } from '../types';

/** Port — quais du Vieux Monde au crépuscule : dernière lueur dorée basse sur l'horizon, entrepôts
 *  et grue de quai en silhouettes, cogue amarrée au premier plan (mât, vergue, voile ferlée,
 *  haubans, fanion), voilier au loin, reflets dorés cassés sur l'eau sombre, quai de planches avec
 *  caisses, tonneau, bitte d'amarrage et docker à contre-jour, lanterne de quai au halo chaud,
 *  mouettes. Aplats superposés (pas de filtre ni de dégradé), tiers bas voilé pour laisser le texte
 *  du panneau lisible. Tokens `var(--…)` seuls. */
export const fond: FondDef = {
  id: 'port',
  label: 'Port',
  svg: `
    <rect x="0" y="0" width="320" height="96" fill="var(--panel2)"/>
    <rect x="0" y="52" width="320" height="44" fill="var(--bg2)"/>
    <circle cx="104" cy="52" r="46" fill="var(--gold)" opacity="0.1"/>
    <circle cx="104" cy="53" r="26" fill="var(--gold)" opacity="0.13"/>
    <rect x="0" y="51" width="320" height="1.5" fill="var(--border)" opacity="0.4"/>
    <path d="M0 52 L0 36 L13 36 L13 29 L19 24 L25 29 L25 52 Z" fill="var(--ink)" opacity="0.85"/>
    <path d="M28 52 L28 40 L42 33 L56 40 L56 52 Z" fill="var(--ink)" opacity="0.85"/>
    <path d="M61 52 L61 34 L65 34 L65 39 L83 31 L84 34 L65 43 L65 52 Z" fill="var(--ink)" opacity="0.85"/>
    <path d="M79 33 L79 41" stroke="var(--ink)" stroke-width="1.2" opacity="0.85"/>
    <path d="M84 49 L118 49 Q115 52.5 110 52.5 L91 52.5 Q86 52.5 84 49 Z" fill="var(--ink)" opacity="0.9"/>
    <rect x="99" y="34" width="1.5" height="15" fill="var(--ink)" opacity="0.9"/>
    <rect x="92" y="58" width="20" height="2" fill="var(--gold)" opacity="0.3"/>
    <rect x="104" y="63" width="12" height="1.5" fill="var(--gold)" opacity="0.22"/>
    <rect x="84" y="68" width="14" height="1.5" fill="var(--gold)" opacity="0.16"/>
    <rect x="281" y="64" width="11" height="2" fill="var(--gold)" opacity="0.28"/>
    <path d="M197.5 8 L158 53 M197.5 8 L242 53" stroke="var(--ink)" stroke-width="1" opacity="0.8"/>
    <rect x="196" y="5" width="3" height="49" fill="var(--ink)"/>
    <path d="M196 5 L185 8.5 L196 12 Z" fill="var(--gold2)" opacity="0.9"/>
    <rect x="168" y="13" width="60" height="2.5" fill="var(--ink)"/>
    <rect x="173" y="15.5" width="50" height="5" rx="2.5" fill="var(--parchment)" opacity="0.5"/>
    <path d="M148 41 Q151 49 153 54 L248 54 L248 45 L257 43 L257 55 Q253 66 239 67 L166 67 Q153 63 149 55 Z" fill="var(--ink)"/>
    <rect x="158" y="54" width="86" height="1.5" fill="var(--gold)" opacity="0.25"/>
    <ellipse cx="200" cy="68" rx="44" ry="2.5" fill="var(--shadow-ink)" opacity="0.7"/>
    <rect x="0" y="70" width="320" height="4" fill="var(--ink)"/>
    <rect x="0" y="74" width="320" height="22" fill="var(--bg)"/>
    <rect x="0" y="80" width="320" height="1.5" fill="var(--border)" opacity="0.3"/>
    <path d="M142 62 Q158 70 166 65" fill="none" stroke="var(--ink)" stroke-width="1.5" opacity="0.9"/>
    <path d="M136 72 L137 62 Q136 58 140 58 Q144 58 143 62 L144 72 Z" fill="var(--ink)"/>
    <circle cx="112" cy="48" r="4.5" fill="var(--bg)"/>
    <path d="M106 72 L107 56 Q106 50 112 49 Q118 50 119 56 L118 72 Z" fill="var(--bg)"/>
    <ellipse cx="119" cy="47" rx="6" ry="4" fill="var(--bg)"/>
    <rect x="20" y="56" width="18" height="16" fill="var(--border)"/>
    <path d="M20 56 L38 72 M38 56 L20 72" stroke="var(--ink)" stroke-width="1.5" opacity="0.8"/>
    <rect x="24" y="46" width="12" height="10" fill="var(--border)"/>
    <rect x="24" y="46" width="12" height="2" fill="var(--ink)" opacity="0.8"/>
    <rect x="45" y="57" width="15" height="15" rx="4" fill="var(--border)"/>
    <ellipse cx="52.5" cy="57.5" rx="7" ry="2" fill="var(--bg)"/>
    <rect x="45" y="62" width="15" height="2" fill="var(--ink)" opacity="0.9"/>
    <circle cx="292" cy="36" r="14" fill="var(--gold)" opacity="0.18"/>
    <circle cx="292" cy="36" r="7" fill="var(--gold)" opacity="0.25"/>
    <rect x="290" y="40" width="3" height="32" fill="var(--ink)"/>
    <rect x="287" y="30" width="10" height="12" rx="1.5" fill="var(--ink)"/>
    <rect x="290" y="33" width="4" height="7" fill="var(--gold2)" opacity="0.9"/>
    <path d="M226 20 q4 -3.5 8 0 q4 -3.5 8 0" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
    <path d="M252 13 q3 -2.5 6 0" fill="none" stroke="var(--ink)" stroke-width="1.2"/>
    <rect x="0" y="74" width="320" height="22" fill="var(--bg)" opacity="0.35"/>
    <rect x="0" y="86" width="320" height="10" fill="var(--bg)" opacity="0.4"/>
  `,
};
