/**
 * PIÈGE DU DIALOGUE (pattern WAI-ARIA) — en bulle sur le document (`ecouterClavier('piege')`), pour la
 * boîte du dialogue du DESSUS (`dialogueDuDessus`) : Entrée soumet par le primaire du pied, les flèches
 * roulent le focus sur les contrôles visibles, Tab et Maj+Tab bouclent dans la boîte. Ce sont des touches
 * NOMMÉES, lues par `e.key` : indépendantes de la disposition, et seules présentes sur un clavier
 * virtuel. Composé par `useModalA11y` (`Modal.tsx`).
 */
import { useEffect, type RefObject } from 'react';
import { estChamp, visibleFocusables } from '../../focus';
import { dialogueDuDessus } from '../../useDismissLayer';
import { PRIMAIRE_DU_PIED } from '../../Cadre';
import { ecouterClavier } from '../interne/ecouterClavier';

const FLECHE = /^Arrow(Up|Down|Left|Right)$/;

export function usePiegeDeDialogue(boxRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const box = boxRef.current;
      if (!box || dialogueDuDessus() !== box) return;
      // Un CONTRÔLE focalisé possède sa touche, OÙ QU'IL VIVE dans le document (`document.activeElement`
      // est global) : un contrôle rendu en PORTAL (`createPortal(document.body)` — popover de règle,
      // menu, infobulle actionnable) garde sa touche pendant qu'une modale est ouverte.
      const ae = document.activeElement;
      const activeButton = ae instanceof HTMLButtonElement && !ae.disabled;
      // Focus posé sur un ÉLÉMENT RÉEL hors de la boîte (portal) : il n'appartient pas à ce dialogue,
      // la boîte ne décide pas pour lui. `body` (focus nulle part) reste à la boîte, c'est son repli.
      const focusElsewhere = !!ae && ae !== document.body && !box.contains(ae);
      const els = visibleFocusables(box);
      if (e.key === 'Enter') {
        // Bouton focalisé → activation NATIVE (cocher une option de choix, cliquer Lancer/Terminer…).
        // Depuis un champ de saisie, Entrée SOUMET la boîte (nom de campagne → « Enregistrer », mise de
        // taverne → « Jouer », semaine en mer → « Valider la semaine ») : un champ qui doit garder son
        // Entrée la CONSOMME chez lui (`preventDefault` + `stopPropagation`, cf. le sélecteur de dé de
        // `ForcedRollPicker`), il ne se déclare pas ici.
        // Sinon (focus sur la boîte/aucun) → repli sur le bouton primaire.
        if (activeButton || focusElsewhere) return;
        const primary = box.querySelector<HTMLElement>(PRIMAIRE_DU_PIED);
        if (primary && primary.getClientRects().length) { e.preventDefault(); primary.click(); }
        return;
      }
      // Flèches = navigation de focus (roving) sur TOUS les contrôles visibles → options de choix, toggles
      // segmentés (Parade/Esquive) et boutons d'action navigables au clavier seul, sans chasser le Tab.
      if (FLECHE.test(e.key)) {
        // NE PAS voler les flèches d'un champ de formulaire (select/number/texte) → édition native préservée.
        if (estChamp(ae)) return;
        // MÊME frontière que pour Entrée : un contrôle porté par portal navigue chez lui (un popover a
        // ses propres flèches), la boîte ne rove pas par-dessus.
        if (focusElsewhere) return;
        if (!els.length) return;
        e.preventDefault();
        const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[i < 0 ? (dir === 1 ? 0 : els.length - 1) : (i + dir + els.length) % els.length].focus();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      const horsDesControles = active === box || !box.contains(active);
      if (e.shiftKey && (active === first || horsDesControles)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || horsDesControles)) {
        e.preventDefault();
        first.focus();
      }
    };
    return ecouterClavier('piege', { keydown: onKey });
  }, [boxRef]);
}
