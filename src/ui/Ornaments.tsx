import type { ReactNode } from 'react';
import type { VerrouDesMots } from '../noyau/fabriquesDuNoyau';

/* Ornements SVG maison (socle grimdark, 0.2) — 100 % dessinés main, trait légèrement
   irrégulier cohérent avec la direction du rendu iso (src/gameIso/sprites.ts). Les SVG
   consomment currentColor / les tokens :root ; les styles vivent dans styles/ornaments.css. */

/** Fleuron central « dessiné main » : losange impérial + volutes latérales (remplace le ⚜ texte).
 *  Aussi motif discret autonome (emplacement vide de l'écran d'équipe). */
export function Fleuron({ size = 20 }: { size?: number }) {
  return (
    <svg className="orn-fleuron" width={size * 2.9} height={size} viewBox="0 0 64 22" aria-hidden>
      <path d="M32 3.2 L38 11 L32 18.8 L26 11 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M32 7.6 L34.8 11 L32 14.4 L29.2 11 Z" fill="currentColor" />
      <path d="M24 11 C 19 8.4, 13.5 8.8, 8 11.4 C 13.5 13.6, 19 13.4, 24 11 Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M40 11 C 45 8.4, 50.5 8.8, 56 11.4 C 50.5 13.6, 45 13.4, 40 11 Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="4.6" cy="11.4" r="1.4" fill="currentColor" />
      <circle cx="59.4" cy="11.4" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Séparateur horizontal charté : filet or + fleuron central (ou libellé gothique). */
export function RuleDivider({ label, className = '' }: { label?: ReactNode; className?: string }) {
  return (
    <div className={`rule-divider ${className}`.trim()} aria-hidden={label == null || undefined}>
      {label != null ? <span className="rule-divider-label">{label}</span> : <Fleuron />}
    </div>
  );
}

/** Coin travaillé : double filet en équerre + feuille et rivet, orienté par la classe CSS. */
export function CornerFlourish({ corner = 'tl' }: { corner?: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg className={`orn-corner orn-corner-${corner}`} width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <path d="M2 24.5 L2 7 Q2 2 7 2 L24.5 2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 24 L6 9.5 Q6 6 9.5 6 L24 6" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <path d="M7.5 2.4 C 9.6 4.8, 9.6 7.4, 7 9.6 C 5.2 7.4, 5.4 4.6, 7.5 2.4 Z" fill="currentColor" opacity="0.9" />
      <circle cx="10.8" cy="10.8" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** Cadre ornementé : bord fer + filet or en retrait + quatre coins travaillés.
 *  `tone='or'` dore coins et filet (écrans de cérémonie) ; `fer` (défaut) reste sobre. */
export function OrnateFrame({ children, tone = 'fer', className = '' }: { children: ReactNode; tone?: 'or' | 'fer'; className?: string }) {
  return (
    <div className={`ornate-frame ornate-${tone} ${className}`.trim()}>
      <CornerFlourish corner="tl" />
      <CornerFlourish corner="tr" />
      <CornerFlourish corner="bl" />
      <CornerFlourish corner="br" />
      {children}
    </div>
  );
}

/** VERROU : le ton du cadre ne prend que des mots du lexique (#3977). */
const verrouDuTon: VerrouDesMots<NonNullable<Parameters<typeof OrnateFrame>[0]['tone']>> = true;
void verrouDuTon;
