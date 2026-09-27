import { useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { GatedAction } from './GatedAction';

/** Champ SAISISSABLE : ce qu'une frappe remplit (jamais un bouton, ni un champ désactivé ou en lecture seule). */
const CHAMP_SAISISSABLE = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled]):not([readonly])',
].join(', ');

/**
 * Exécute `ajout`, puis porte le focus au PREMIER champ saisissable que le rendu du clic a fait naître
 * dans le document, s'il en naît un et que le focus est encore au bouton (ou nulle part).
 *
 * La rangée neuve se reconnaît par DIFFÉRENCE des champs du document avant et après : ni conteneur ni
 * balisage imposé, donc une rangée rendue par un enfant seul abonné au store, ou rendue hors de la
 * liste (détail d'un master-detail), est trouvée. Le relevé se lit dans la micro-tâche qui suit
 * celle où React valide le rendu d'un clic ; un rendu d'une tâche ultérieure n'est jamais lu.
 *
 * Angle mort : une rangée dont TOUTES les sœurs sont re-montées par l'ajout (clé dérivée de la
 * longueur) fait naître tous les champs ; le focus va au premier d'entre eux. Aucun site ne le
 * présente (clés par index ou par id stable).
 */
export function ajouterRangee(bouton: HTMLElement, ajout: () => void) {
  const doc = bouton.ownerDocument;
  const avant = new Set(doc.querySelectorAll(CHAMP_SAISISSABLE));
  ajout();
  queueMicrotask(() => {
    const actif = doc.activeElement;
    if (actif && actif !== bouton && actif !== doc.body) return;
    const neuf = [...doc.querySelectorAll<HTMLElement>(CHAMP_SAISISSABLE)].find((el) => !avant.has(el));
    neuf?.focus();
  });
}

/**
 * AJOUTER UNE RANGÉE — geste UNIQUE des éditeurs de liste : `btn small`, icône `ui/add` suivie du
 * libellé de la rangée ; le clic exécute `onAjout` puis porte le focus à la rangée neuve
 * (`ajouterRangee`). `refus` : l'ajout est refusé pour cette raison, rendue par `GatedAction`.
 */
export function AjoutRangee({ libelle, onAjout, disabled, refus }: {
  libelle: ReactNode;
  onAjout: () => void;
  disabled?: boolean;
  refus?: string;
}) {
  const id = `ajout-${useId().replace(/[^\w-]/g, '')}`;
  const bouton = useRef<HTMLButtonElement>(null);
  const contenu = <><Icon id="ui/add" size="sm" /> {libelle}</>;
  if (refus) return <GatedAction id={id} label={contenu} primary={false} btnClassName="small" enabled={false} reason={refus} onClick={onAjout} />;
  return (
    <button type="button" ref={bouton} className="btn small" disabled={disabled} onClick={() => ajouterRangee(bouton.current!, onAjout)}>
      {contenu}
    </button>
  );
}

/** Conteneur des rangées d'une liste : groupe NOMMÉ par le libellé du champ (`role="group"`, `aria-label`). */
export function ListeRangees({ nom, className, children }: { nom: string; className?: string; children: ReactNode }) {
  return <div role="group" aria-label={nom} className={className}>{children}</div>;
}
