import { useRef } from 'react';
import { Stack } from './Layout';
import { useRamenerEnVue } from './useRamenerEnVue';

/** Un refus RENDU : `message` en mots du joueur ou de l'auteur, `detail` = le rapport technique,
 *  replié sous le message quand le message ne le reprend pas. */
export type RefusRendu = { message: string; detail?: string };

/** Le message d'un REFUS ou d'un état perdu (donnée d'un autre format retirée, geste refusé), en
 *  `role="alert"` — `role="status"` pour l'état PERMANENT d'un champ (`fixe`) : le message en
 *  `.chip.tone-danger.chip-phrase` (pastille ajustée à son texte), le rapport replié derrière la primitive `.fold` (`components.css`), une ligne du rapport par bloc.
 *  `id` nomme le message, cible de l'`aria-describedby` du champ qu'il décrit.
 *
 *  La pastille se RAMÈNE EN VUE (`useRamenerEnVue`) au montage puis à chaque changement de son
 *  contenu (`message`, `detail`), jamais à un simple rendu de l'hôte. `cle` remplace ce déclencheur
 *  pour l'hôte dont chaque geste produit un refus neuf au texte identique ; `fixe` le coupe pour
 *  l'état PERMANENT d'un champ, rendu pendant que l'auteur le saisit, et l'annonce en `status`. */
export function ChipDeRefus({ refus, id, cle, fixe }: { refus: RefusRendu; id?: string; cle?: unknown; fixe?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useRamenerEnVue(ref, !fixe, cle ?? `${refus.message}\n${refus.detail ?? ''}`);
  return (
    <Stack role={fixe ? 'status' : 'alert'} id={id} ref={ref}>
      <p className="chip tone-danger chip-phrase">{refus.message}</p>
      {refus.detail && (
        <details className="fold">
          <summary><span className="fold-title">Détail technique</span></summary>
          <div className="fold-body">
            {refus.detail.split('\n').map((ligne, i) => <div key={i}>{ligne}</div>)}
          </div>
        </details>
      )}
    </Stack>
  );
}
