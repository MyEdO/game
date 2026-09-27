import { useCallback, useEffect, useRef } from 'react';

/** Champ SAISISSABLE : ce qu'une frappe remplit (jamais un bouton, ni un champ désactivé ou en lecture seule). */
const CHAMP_SAISISSABLE = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled]):not([readonly])',
].join(', ');

/**
 * AJOUTER UNE RANGÉE — geste UNIQUE des éditeurs de liste : après « + Ajouter », le focus va au
 * PREMIER champ saisissable de la rangée NEUVE, pour qu'une frappe immédiate la remplisse.
 *
 * `refListe` se pose sur le conteneur des rangées ; `ajouter(ajout)` enveloppe le `onClick` du bouton.
 * La rangée neuve se reconnaît par DIFFÉRENCE : ses champs sont ceux que le conteneur ne portait pas
 * avant l'ajout — aucune convention de balisage n'est imposée à la rangée. Le relevé vaut pour le
 * rendu que le clic provoque, et s'éteint avec la tâche du clic : un rendu ultérieur ne vole jamais
 * le focus.
 */
export function useFocusRangeeNeuve<E extends HTMLElement = HTMLDivElement>() {
  const refListe = useRef<E>(null);
  const avant = useRef<Set<Element> | null>(null);

  const ajouter = useCallback((ajout: () => void) => {
    const releve = new Set(refListe.current?.querySelectorAll(CHAMP_SAISISSABLE) ?? []);
    avant.current = releve;
    ajout();
    queueMicrotask(() => { if (avant.current === releve) avant.current = null; });
  }, []);

  useEffect(() => {
    const deja = avant.current;
    if (!deja) return;
    avant.current = null;
    const neuf = [...(refListe.current?.querySelectorAll<HTMLElement>(CHAMP_SAISISSABLE) ?? [])].find((el) => !deja.has(el));
    neuf?.focus();
  });

  return { refListe, ajouter };
}
