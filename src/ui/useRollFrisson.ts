import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../noyau/bus';

/** Durée du tumble (arbitrage user 2026-07-13 « des dés qui roulent ») — geste COURT, pas un gadget. */
const TUMBLE_MS = 750;
/** Durée de l'atterrissage (arbitrage user 2026-07-14 : les faces RÉELLES doivent « rester assez
 *  longtemps affichées pour voir le résultat ») — jamais moins d'1 s. */
const LAND_MS = 1100;

/**
 * Frisson du jet — helper PARTAGÉ (source unique) : un beat visuel avant tout jet RÉEL (nouveau
 * tirage), consommé par la RANGÉE (`RollRow`, multi — jet initial ET relance de Chance/Sombre Pacte,
 * #396) ET par le bouton « Lancer » hissé dans la barre du `RollShell` (mono), ainsi que par
 * `CreatorDice` (« Aux dés » du créateur). Émet `EVT.DICE_ROLL`, puis — en `prefers-reduced-motion` —
 * résout immédiatement (aucun beat) ; sinon DEUX phases successives, toutes deux rendues par
 * `DiceRoll` :
 *
 *   `rolling` (~750 ms, faces INCONNUES, tumble générique — pas de spoil) → le résolveur s'exécute
 *   (RNG + commit store) → `landed` (~1100 ms, les VRAIES faces se figent et RESTENT affichées —
 *   jamais moins d'1 s, arbitrage user : « ne jamais avoir l'impression d'avoir raté ses dés ») →
 *   retour au contenu normal (résultat).
 *
 * `skip()` (clic/Entrée sur le roulis) : pendant `rolling`, atterrit IMMÉDIATEMENT sur les vraies
 * faces (saute l'attente du tumble, PAS le beat d'atterrissage — les faces réelles restent quand
 * même visibles) ; pendant `landed`, referme immédiatement (impatience assumée).
 *
 * Critère mécanique (arbitrage user 2026-07-13/14) : tout ce qui RE-TIRE les dés (jet initial,
 * relance de Chance, relance de Sombre Pacte — `rollFlowFactory.reroll`/`darkPact`, tous deux
 * `reresolveOf` = un nouveau jet RNG) roule ; tout ce qui AJUSTE un résultat déjà lancé sans le
 * relancer (Chance « +1 DR » = `bumpSL`, Résilience/Résistance/Détermination = dé CHOISI ou DR
 * imposé, jamais RNG) ne roule pas.
 *
 * Les VRAIES faces (#396 v3) ne sont PAS portées par ce hook (il ignore la sémantique du jet) : le
 * résolveur commet son résultat dans le store/l'état du composant AVANT `landed=true` (React 18
 * batch les deux transitions dans le même rendu) — l'appelant lit sa donnée fraîche (`row.d.roll`…)
 * et la traduit en faces (`d100Faces`) au moment où il rend `<DiceRoll landed faces=.../>`.
 *
 * @param onRoll  Résolveur du jet PAR DÉFAUT de `trigger()` (peut être absent → un appelant qui n'a
 *   qu'un résolveur choisi au clic passe `undefined` ici et fournit `fn` à chaque `trigger(fn)`,
 *   ex. relance de Chance vs relance de Sombre Pacte partageant UNE animation).
 * @param opts.frisson  Anime avant de résoudre (défaut : TRUE — #396, tout jet roule désormais ;
 *   un flux passe `false` pour un cas sans geste visuel, aucun aujourd'hui).
 */
/** Préférence système « réduire les animations » — SOURCE UNIQUE, partagée par le hook et les
 *  cérémonies custom qui séquencent leurs propres beats (ex. les dix 2d10 du créateur). */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useRollFrisson(onRoll?: () => void, opts?: { frisson?: boolean }): {
  rolling: boolean;
  landed: boolean;
  trigger: (fn?: () => void) => void;
  skip: () => void;
} {
  const frisson = opts?.frisson ?? true;
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState(false);
  const tumbleTimer = useRef<number | null>(null);
  const landTimer = useRef<number | null>(null);
  const fnRef = useRef<(() => void) | undefined>(onRoll);
  const reduceMotion = prefersReducedMotion();

  const clearTimers = () => {
    if (tumbleTimer.current != null) { window.clearTimeout(tumbleTimer.current); tumbleTimer.current = null; }
    if (landTimer.current != null) { window.clearTimeout(landTimer.current); landTimer.current = null; }
  };

  // Démonte en plein roulis (changement d'étape, fermeture de modale) : les timers ne doivent JAMAIS
  // tenter un `setState` après unmount (fuite + avertissement React).
  useEffect(() => clearTimers, []);

  /** Fin du tumble : exécute le résolveur puis fige sur les vraies faces (le résultat se montre au déblocage de `landed`). */
  const land = () => {
    tumbleTimer.current = null;
    setRolling(false);
    fnRef.current?.();
    setLanded(true);
    landTimer.current = window.setTimeout(() => { landTimer.current = null; setLanded(false); }, LAND_MS);
  };

  const trigger = (fn?: () => void) => {
    if (rolling) return; // garde de ré-entrance : un clic pendant le roulis ne relance pas un second jet
    bus.emit(EVT.DICE_ROLL);
    const resolver = fn ?? onRoll;
    if (!resolver) return;
    fnRef.current = resolver;
    if (!frisson || reduceMotion) { resolver(); return; }
    setRolling(true);
    tumbleTimer.current = window.setTimeout(land, TUMBLE_MS);
  };

  const skip = () => {
    if (rolling) { clearTimers(); land(); return; }
    if (landed) { clearTimers(); setLanded(false); }
  };

  return { rolling, landed, trigger, skip };
}
