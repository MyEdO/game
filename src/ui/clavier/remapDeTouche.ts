/**
 * REMAP D'UN RACCOURCI — une fois armé sur un raccourci du registre, la PROCHAINE touche pressée en
 * devient la touche (`setKeyBinding`), lue par sa POSITION (`event.code`) et ses modificateurs
 * (`formatCombo`). En CAPTURE sur la fenêtre (`ecouterClavier('remap')`) avec arrêt immédiat : aucun
 * raccourci ne part pendant la saisie. Le hook n'admet aucun gestionnaire : la touche capturée ne
 * fait qu'écrire le registre.
 *
 * Tant qu'il attend, le remap est une couche `popover` de la pile (`useDismissLayer`) : Échap l'annule
 * SEUL, comme il ferme la liste d'un `MediaSelect`, et la surface dessous reste ouverte. Un
 * modificateur tenu seul ne désigne aucune touche : le remap attend la touche qu'il qualifie. Une
 * touche sans position (`code` vide, clavier virtuel) n'en désigne aucune non plus : le remap attend.
 */
import { useEffect, useState, type RefObject } from 'react';
import { useGame } from '../../state/store';
import { eventMods, formatCombo } from '../../state/clavier/keybindings';
import { useDismissLayer } from '../useDismissLayer';
import { ecouterClavier } from './interne/ecouterClavier';

const CODES_MODIFICATEUR = /^(Control|Alt|Shift|Meta)(Left|Right)$/;

export interface RemapDeTouche {
  /** L'id du raccourci qui attend sa touche, ou `null`. */
  readonly enCours: string | null;
  /** Arme le remap du raccourci `id` (un id de `KEYBINDINGS`). */
  readonly armer: (id: string) => void;
}

/** @param boite la surface du remap. */
export function useRemapDeTouche(boite: RefObject<HTMLElement | null>): RemapDeTouche {
  const [enCours, setEnCours] = useState<string | null>(null);
  const setKeyBinding = useGame((s) => s.setKeyBinding);
  useDismissLayer({ kind: 'remap-de-touche', nature: 'popover', plan: 'application', boite }, () => setEnCours(null), enCours !== null);
  useEffect(() => {
    if (enCours === null) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.code || CODES_MODIFICATEUR.test(e.code)) return;
      setKeyBinding(enCours, formatCombo(e.code, eventMods(e)));
      setEnCours(null);
    };
    return ecouterClavier('remap', { keydown: onKey });
  }, [enCours, setKeyBinding]);
  return { enCours, armer: setEnCours };
}
