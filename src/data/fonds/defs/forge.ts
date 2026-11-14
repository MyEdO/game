import type { FondDef } from '../types';

/** Forge — atelier de forgeron du Vieux Monde au travail : gueule rougeoyante du foyer à gauche
 *  (braises, halos --accent/--gold superposés), enclume sur billot au centre avec pièce chauffée
 *  à blanc et gerbe d'étincelles, forgeron de dos marteau levé, râtelier de lames et d'outils à
 *  droite, baquet de trempe fumant. Aplats superposés (pas de filtre ni de dégradé), tiers bas
 *  voilé pour laisser le texte du panneau lisible. Tokens `var(--…)` seuls. */
export const fond: FondDef = {
  id: 'forge',
  label: 'Forge',
  svg: `
    <rect x="0" y="0" width="320" height="96" fill="var(--panel2)"/>
    <rect x="0" y="68" width="320" height="28" fill="var(--bg2)"/>
    <circle cx="56" cy="58" r="54" fill="var(--accent)" opacity="0.2"/>
    <circle cx="56" cy="60" r="36" fill="var(--gold)" opacity="0.14"/>
    <ellipse cx="78" cy="82" rx="52" ry="7" fill="var(--gold)" opacity="0.12"/>
    <rect x="0" y="0" width="320" height="10" fill="var(--ink)"/>
    <rect x="0" y="10" width="320" height="2" fill="var(--border)" opacity="0.5"/>
    <rect x="222" y="10" width="8" height="60" fill="var(--ink)"/>
    <path d="M22 0 L90 0 L98 24 L14 24 Z" fill="var(--ink)"/>
    <rect x="12" y="24" width="88" height="54" fill="var(--bg2)"/>
    <rect x="12" y="40" width="88" height="1.5" fill="var(--border)" opacity="0.3"/>
    <rect x="12" y="58" width="88" height="1.5" fill="var(--border)" opacity="0.3"/>
    <path d="M26 78 L26 46 Q56 30 86 46 L86 78 Z" fill="var(--shadow-ink)"/>
    <circle cx="56" cy="62" r="17" fill="var(--accent)" opacity="0.55"/>
    <path d="M46 74 Q44 58 56 48 Q54 61 62 53 Q69 63 64 74 Z" fill="var(--accent)"/>
    <path d="M51 74 Q50 62 57 55 Q63 65 59 74 Z" fill="var(--gold)"/>
    <path d="M54 74 Q54 66 58 62 Q61 69 58 74 Z" fill="var(--gold2)"/>
    <rect x="32" y="72" width="48" height="5" rx="2" fill="var(--ink)"/>
    <rect x="36" y="71" width="40" height="2" fill="var(--gold)" opacity="0.55"/>
    <circle cx="42" cy="70.5" r="1.4" fill="var(--gold2)"/>
    <circle cx="68" cy="70.5" r="1.2" fill="var(--gold2)" opacity="0.8"/>
    <rect x="146" y="60" width="26" height="20" fill="var(--border)"/>
    <rect x="146" y="60" width="26" height="2.5" fill="var(--ink)" opacity="0.8"/>
    <path d="M142 46 L128 49 Q125.5 50.5 128 52 L142 54 Z" fill="var(--ink)"/>
    <rect x="142" y="46" width="36" height="8" fill="var(--ink)"/>
    <rect x="152" y="54" width="13" height="7" fill="var(--ink)"/>
    <rect x="146" y="60" width="26" height="3" fill="var(--ink)"/>
    <rect x="143" y="46" width="34" height="1.5" fill="var(--gold)" opacity="0.35"/>
    <circle cx="166" cy="44" r="9" fill="var(--gold)" opacity="0.3"/>
    <rect x="156" y="43" width="22" height="3" rx="1.5" fill="var(--gold2)"/>
    <circle cx="181" cy="38" r="1.3" fill="var(--gold2)"/>
    <circle cx="186" cy="44" r="1" fill="var(--gold2)" opacity="0.8"/>
    <circle cx="176" cy="33" r="1" fill="var(--gold)" opacity="0.9"/>
    <circle cx="199" cy="27" r="6" fill="var(--bg)"/>
    <path d="M188 78 L189 44 Q188 33 199 32 Q210 33 211 44 L212 78 Z" fill="var(--bg)"/>
    <path d="M191 36 Q189 34 191 33 L191 76 L189 76 Z" fill="var(--gold)" opacity="0.3"/>
    <path d="M208 38 L219 22 L223 25 L212 42 Z" fill="var(--bg)"/>
    <path d="M220 24 L228 10" stroke="var(--ink)" stroke-width="2.5"/>
    <rect x="221" y="5" width="13" height="7" rx="1" fill="var(--ink)"/>
    <rect x="238" y="17" width="74" height="4" fill="var(--ink)"/>
    <path d="M248 21 L248 52 L251 58 L254 52 L254 21 Z" fill="var(--border)"/>
    <rect x="244" y="22" width="14" height="3" rx="1.5" fill="var(--ink)"/>
    <rect x="249" y="21" width="1.5" height="32" fill="var(--parchment)" opacity="0.5"/>
    <path d="M268 21 L268 46 L270 50 L272 46 L272 21 Z" fill="var(--parchment)" opacity="0.75"/>
    <rect x="265" y="22" width="10" height="2.5" rx="1" fill="var(--ink)"/>
    <path d="M286 21 Q283 34 287 44 M290 21 Q293 34 289 44" fill="none" stroke="var(--ink)" stroke-width="2"/>
    <path d="M302 21 L302 38" stroke="var(--ink)" stroke-width="2.5"/>
    <rect x="297" y="36" width="11" height="6" rx="1" fill="var(--ink)"/>
    <rect x="281" y="54" width="30" height="26" rx="6" fill="var(--border)"/>
    <ellipse cx="296" cy="55" rx="14" ry="4" fill="var(--bg)"/>
    <rect x="281" y="62" width="30" height="3" fill="var(--ink)" opacity="0.9"/>
    <rect x="281" y="73" width="30" height="3" fill="var(--ink)" opacity="0.9"/>
    <ellipse cx="292" cy="46" rx="4" ry="2.5" fill="var(--parchment)" opacity="0.16"/>
    <ellipse cx="299" cy="40" rx="3" ry="2" fill="var(--parchment)" opacity="0.12"/>
    <rect x="0" y="74" width="320" height="22" fill="var(--bg)" opacity="0.35"/>
    <rect x="0" y="86" width="320" height="10" fill="var(--bg)" opacity="0.4"/>
  `,
};
