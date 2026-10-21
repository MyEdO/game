import { useEffect, useState } from 'react';
import { entierDEntropie } from '../web/entropie';

/**
 * Roulis de dés — PRIMITIVE UNIQUE (#396, arbitrage user 2026-07-13/14 : « ça se lance, avec des
 * dés qui roulent » · « scène plus théâtrale » · « le chiffre appartient au dé, pas un texte posé
 * à côté » · « les faces défilent comme un dé qui tourne, décélère, se pose sur le VRAI score »).
 * Rendu par `useRollFrisson` dans `RollRow`/`RollShell` (`rolling`/`landed`) ET par `CreatorDice` —
 * un seul composant, deux présentations :
 *
 * - `scene` (défaut, cas MONO — bouton « Lancer » hissé du `RollShell`, `CreatorDice`) : les dés
 *   occupent le CENTRE de la modale/zone (voile sur le contenu, qui reste dessous et revient une
 *   fois l'atterrissage terminé) — `.rm-scene`, ancré sur le plus proche ancêtre positionné
 *   (`.modal`/`.rs-embedded`/`.zone-section`).
 * - inline (`scene={false}`, cas MULTI — une rangée `RollRow` par participant, et toute relance) :
 *   MÊME dé, plus petit, DANS la rangée — pas de scène (une scène par participant serait absurde).
 *
 * Chaque dé (`DieFace`, SVG — gemme rouge profond, liseré laiton, chiffre ivoire GRAVÉ SUR LA FACE,
 * jamais un texte posé à côté) fait DÉFILER son chiffre (`useTumbleDigit`, 0-9 aléatoire, cadence
 * qui s'allonge en ease-out) tant que `landed` est faux — jamais de translation latérale, seulement
 * un tremblement de rotation ±13° + pulsation d'échelle autour du centre. À `landed`, le défilement
 * s'arrête PILE sur la VRAIE face (`faces`, `d100Faces(roll)` côté appelant) — jamais un chiffre qui
 * contredirait le score. Un clic/Entrée SKIPPE (`onSkip`, cf. `useRollFrisson.skip`).
 * `prefers-reduced-motion` coupe le défilement EN AMONT (`useRollFrisson` résout sans délai) : ce
 * composant n'est alors jamais monté en train de rouler.
 */

/** Cadence de défilement du chiffre — ease-out (les intervalles s'allongent), somme ≈ 800 ms
 *  (spec : « ~60-80 ms » au départ → « 750-900 ms » total). Le dernier délai se répète en boucle
 *  jusqu'à `landed` (le tumble parent — `useRollFrisson.TUMBLE_MS` — pilote la durée réelle). */
const TICK_SCHEDULE_MS = [60, 60, 65, 75, 90, 110, 135, 165];

/** Chiffre d'UN dé : défile aléatoirement (0-9) tant que `landed` est faux, se fige sur `real` une
 *  fois `landed` vrai. Chaque dé a sa PROPRE instance (deux dés = deux séquences indépendantes, pas
 *  de synchronisation artificielle — un vrai jet de deux d10 ne tombe pas en même temps). `real`
 *  ABSENT à `landed` (score encore inconnu de l'appelant) → `null` : AUCUN chiffre ne s'affiche
 *  plutôt que de figer la dernière valeur ALÉATOIRE du tumble (qui contredirait le score réel). */
function useTumbleDigit(landed: boolean, real: number | null): number | null {
  const [digit, setDigit] = useState(() => entierDEntropie(10));
  useEffect(() => {
    if (landed) return;
    let cancelled = false;
    let timer: number;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      setDigit(entierDEntropie(10));
      const delay = TICK_SCHEDULE_MS[Math.min(i, TICK_SCHEDULE_MS.length - 1)];
      i += 1;
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, TICK_SCHEDULE_MS[0]);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [landed]);
  return landed ? real : digit;
}

/** UN dé physique (SVG, gemme d10 — même silhouette que l'icône `nav/dice`) : le chiffre est un
 *  `<text>` DANS le même SVG que la gemme — appartient au dé, jamais un overlay HTML à côté.
 *  `n=null` (score réel inconnu à l'atterrissage) → PAS de `<text>` (dé nu) plutôt qu'un chiffre inventé.
 *  EXPORTÉ (#393 P2) : les encriers « Aux dés » du créateur (Race/Carrière) le montent debout dans
 *  leur plateau (`.dicewell-die`) — idle (dé nu) ET rendu (vraie face gravée), jamais une icône
 *  générique recopiée à côté. */
export function DieFace({ n, landed, tone }: { n: number | null; landed: boolean; /** `'gold'` = matière laiton/bois de l'Atelier du scribe (créateur, galerie) — défaut = gemme rouge canon du combat. */ tone?: 'gold' }) {
  return (
    <svg viewBox="0 0 24 24" className={`rm-die-svg${landed ? ' rm-die-landed' : ' rm-die-rolling'}${tone === 'gold' ? ' rm-die-gold' : ''}`} aria-hidden="true">
      <path className="rm-die-gem" d="M12.1 3.1 L18.9 8.5 L17.1 16.7 L12 20.9 L6.9 16.7 L5.1 8.5 Z" />
      {n != null && <text x="12" y="13.6" textAnchor="middle" className="rm-die-num">{n}</text>}
    </svg>
  );
}

export function DiceRoll({ onSkip, landed = false, faces, scene = true, tone }: {
  onSkip?: () => void;
  /** Phase d'atterrissage : les dés sont FIGÉS sur `faces` (arrêt du défilement). */
  landed?: boolean;
  /** Les deux faces RÉELLES [dizaines, unités] du d100 tiré — connues seulement une fois `landed`. */
  faces?: readonly [number, number] | null;
  /** Présentation « scène » (grands dés centrés, voile sur le contenu) vs inline (petite rangée). */
  scene?: boolean;
  /** `'gold'` = matière laiton/bois de l'Atelier du scribe (créateur, galerie) — défaut = gemme rouge canon du combat. */
  tone?: 'gold';
}) {
  // Deux instances INDÉPENDANTES (règle des hooks : toujours appelées, jamais conditionnelles).
  const d0 = useTumbleDigit(landed, faces?.[0] ?? null);
  const d1 = useTumbleDigit(landed, faces?.[1] ?? null);
  return (
    <div
      className={scene ? 'rm-scene' : 'rm-rolling'}
      onClick={onSkip}
      role={onSkip ? 'button' : undefined}
      tabIndex={onSkip ? 0 : undefined}
      title={onSkip ? 'Cliquer pour passer le roulis' : undefined}
      onKeyDown={onSkip ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSkip(); } } : undefined}
    >
      <span className="rm-die"><DieFace n={d0} landed={landed} tone={tone} /></span>
      <span className="rm-die"><DieFace n={d1} landed={landed} tone={tone} /></span>
    </div>
  );
}
