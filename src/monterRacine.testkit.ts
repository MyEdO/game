/**
 * Montage de test d'une racine react-dom, et son démontage COLLECTIF.
 *
 * Un fichier qui monte plusieurs fois dans le même test (ou qui monte hors de son `mount()` local)
 * ne peut pas se contenter d'un porteur `root` unique : la réassignation perd la racine précédente,
 * qui reste inscrite au planificateur react-dom PARTAGÉ par le worker (`test.isolate: false`) et se
 * réveille hors `act()` pendant un fichier suivant — « Should not already be working » chez la
 * victime (#1724), rendu vide (#1619). Ici les montages sont RETENUS : `demonterRacines()` les rend
 * tous, dans l'ordre inverse du montage, et le fichier n'a plus de compte à tenir.
 *
 * Le démontage ne s'enregistre PAS tout seul : sous `isolate: false` le corps de ce module n'est
 * évalué qu'une fois par worker, un `afterEach` posé ici n'appartiendrait qu'au premier fichier
 * importateur. Chaque fichier appelle donc `demonterRacines()` dans SON `afterEach`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

/** Ce qu'un montage de test offre : son conteneur (attaché à `document.body`) et le re-rendu de SA
 *  racine — brut, pour que l'appelant garde la main sur l'`act()` qui l'enveloppe. */
export type MontageTest = { container: HTMLDivElement; rendre(node: ReactNode): void };

const montages: { root: Root; container: HTMLDivElement }[] = [];

function executerSousAct(action: () => void, erreurs: unknown[]): void {
  try {
    act(() => {
      try {
        action();
      } catch (erreur) {
        erreurs.push(erreur);
      }
    });
  } catch (erreur) {
    erreurs.push(erreur);
  }
}

function nettoyerMontage(root: Root | undefined, container: HTMLDivElement, erreurs: unknown[]): void {
  if (root) executerSousAct(() => { root.unmount(); }, erreurs);
  try {
    container.remove();
  } catch (erreur) {
    erreurs.push(erreur);
  }
}

function leverErreurs(erreurs: unknown[]): never {
  if (erreurs.length === 1) throw erreurs[0];
  throw new AggregateError(erreurs, 'Échec du nettoyage des racines React');
}

function annulerMontage(root: Root | undefined, container: HTMLDivElement, erreurs: unknown[]): never {
  const index = montages.findIndex((montage) => montage.container === container);
  if (index !== -1) montages.splice(index, 1);
  nettoyerMontage(root, container, erreurs);
  leverErreurs(erreurs);
}

/** Monte `node` dans un conteneur neuf attaché à `document.body`, sous `act()`. */
export function monterRacine(node: ReactNode): MontageTest {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  try {
    root = createRoot(container);
  } catch (erreur) {
    annulerMontage(undefined, container, [erreur]);
  }
  const montage = { root, container };
  montages.push(montage);
  const erreurs: unknown[] = [];
  executerSousAct(() => { root.render(node); }, erreurs);
  if (erreurs.length) annulerMontage(root, container, erreurs);
  return { container, rendre: (n) => root.render(n) };
}

/** Démonte TOUT ce que `monterRacine` a monté depuis le dernier appel, et retire les conteneurs. */
export function demonterRacines(): void {
  const erreurs: unknown[] = [];
  for (const { root, container } of montages.splice(0).reverse()) {
    nettoyerMontage(root, container, erreurs);
  }
  if (erreurs.length) leverErreurs(erreurs);
}
