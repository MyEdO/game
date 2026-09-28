/**
 * Geste du joueur sur un menu d'ajout (`AddMenu`) en test : ouvrir le menu par son bouton, puis
 * activer une entrée de SA boîte. Menu fermé = aucune boîte : ses entrées n'existent qu'ouvert, dans
 * la `BoiteAncree` rendue en portail sur `document.body`, hors du conteneur de l'écran.
 *
 * jsdom émet `toggle` d'un `<details>` en tâche différée : l'ouverture l'attend sous `act()`.
 */
import { act } from 'react';

/** Le menu d'ajout de `racine` dont le bouton porte `libelle` (texte exact, ou motif). */
export function menuDe(racine: ParentNode, libelle: string | RegExp): HTMLDetailsElement {
  const vise = (t: string) => (typeof libelle === 'string' ? t === libelle : libelle.test(t));
  const menu = [...racine.querySelectorAll<HTMLDetailsElement>('details.eff-add')]
    .find((d) => vise(d.querySelector('summary')?.textContent?.trim() ?? ''));
  if (!menu) throw new Error(`menu d'ajout « ${String(libelle)} » introuvable`);
  return menu;
}

/** Ouvre `menu` par un clic sur son bouton et rend la boîte née de cette ouverture. */
export async function ouvrirMenu(menu: HTMLDetailsElement): Promise<HTMLElement> {
  const avant = new Set(document.querySelectorAll('.eff-add-menu'));
  await act(async () => {
    const bascule = new Promise((fin) => menu.addEventListener('toggle', fin, { once: true }));
    menu.querySelector('summary')!.click();
    await bascule;
  });
  const boite = [...document.querySelectorAll<HTMLElement>('.eff-add-menu')].find((b) => !avant.has(b));
  if (!boite) throw new Error('menu ouvert sans boîte');
  return boite;
}

/** L'entrée de `boite` dont le libellé est `libelle`, ou `undefined`. */
export const entreeDe = (boite: HTMLElement, libelle: string): HTMLButtonElement | undefined =>
  [...boite.querySelectorAll<HTMLButtonElement>('.listrow')].find((b) => b.textContent?.trim() === libelle);

/** Ouvre `menu` et active son entrée `libelle`. */
export async function choisirDansMenu(menu: HTMLDetailsElement, libelle: string): Promise<void> {
  const entree = entreeDe(await ouvrirMenu(menu), libelle);
  if (!entree) throw new Error(`entrée « ${libelle} » absente du menu`);
  await act(async () => { entree.click(); });
}
