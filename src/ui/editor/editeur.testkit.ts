/**
 * Gestes de la barre de l'éditeur (`EditorToolbar`) joués comme l'auteur : boutons par leur nom
 * accessible (`title`), sélecteur « Scène active » par son `aria-label`.
 */
import { act } from 'react';

/** Le bouton de `racine` dont le `title` est `titre` ; lève s'il est absent. */
export function boutonParTitre(racine: ParentNode, titre: string): HTMLButtonElement {
  const el = racine.querySelector<HTMLButtonElement>(`button[title="${titre}"]`);
  if (!el) throw new Error(`bouton introuvable : « ${titre} »`);
  return el;
}

/** Le sélecteur « Scène active » de la barre. */
export function selecteurDeScene(racine: ParentNode): HTMLSelectElement {
  const el = racine.querySelector<HTMLSelectElement>('select[aria-label="Scène active"]');
  if (!el) throw new Error('sélecteur « Scène active » introuvable');
  return el;
}

/** Ids des scènes du projet, dans l'ordre du sélecteur. */
export function scenesDuSelecteur(racine: ParentNode): string[] {
  return Array.from(selecteurDeScene(racine).options).map((o) => o.value);
}

/** Bascule le sélecteur « Scène active » sur la scène `id`. */
export async function basculerSur(racine: ParentNode, id: string): Promise<void> {
  const select = selecteurDeScene(racine);
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(select, id);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
