/**
 * ÉCOUTE CLAVIER GLOBALE — seule pose d'un écouteur `keydown`/`keyup`, sur quelque receveur que ce soit
 * (mur `murs/clavier-global`, `oxlint.config.mjs`) ; un élément écoute par son `onKeyDown` JSX. INTERNE à
 * `src/ui/clavier/` (mur `murs/interne`) : hors de ce dossier, un geste clavier passe par un hook qui
 * nomme son geste et ne prend aucun gestionnaire — registre (`useGameKeyboard`), porte d'Échap
 * (`couches/porteEchap`), piège du dialogue (`couches/piegeDeDialogue`), remap d'un raccourci
 * (`remapDeTouche`).
 *
 * Ordre d'un appui : fenêtre en capture (`couche`, `remap`), la cible et ses `onKeyDown`, document en
 * bulle (`piege`), fenêtre en bulle (`registre`).
 */

/** Qui écoute le clavier global, et à quelle place de la propagation. */
export type ModeClavier =
  /** Lecteur du registre (`useGameKeyboard`) : en bulle sur la fenêtre, après tout le reste. */
  | 'registre'
  /** Porte de la pile de congédiement (`prendrePorteEchap`) : Échap à la couche du dessus, avant tout. */
  | 'couche'
  /** Remap d'un raccourci (`useRemapDeTouche`) : la touche est une donnée du registre, pas un geste. */
  | 'remap'
  /** Piège du dialogue ouvert (`usePiegeDeDialogue`) : Tab, Entrée et flèches restent dans sa boîte. */
  | 'piege';

interface Pose {
  readonly cible: 'fenetre' | 'document';
  readonly capture: boolean;
}

const POSES: Readonly<Record<ModeClavier, Pose>> = {
  registre: { cible: 'fenetre', capture: false },
  couche: { cible: 'fenetre', capture: true },
  remap: { cible: 'fenetre', capture: true },
  piege: { cible: 'document', capture: false },
};

export interface EcouteursClavier {
  readonly keydown?: (e: KeyboardEvent) => void;
  readonly keyup?: (e: KeyboardEvent) => void;
}

/** Pose les `ecouteurs` à la place de `mode` ; rend leur retrait. */
export function ecouterClavier(mode: ModeClavier, { keydown, keyup }: EcouteursClavier): () => void {
  const { cible: nom, capture } = POSES[mode];
  const cible: GlobalEventHandlers = nom === 'fenetre' ? window : document;
  if (keydown) cible.addEventListener('keydown', keydown, capture);
  if (keyup) cible.addEventListener('keyup', keyup, capture);
  return () => {
    if (keydown) cible.removeEventListener('keydown', keydown, capture);
    if (keyup) cible.removeEventListener('keyup', keyup, capture);
  };
}
