/**
 * LAYOUT PROTHÉSÉ POUR jsdom — source UNIQUE de la boîte non nulle attendue par `Modal`.
 *
 * jsdom n'a AUCUN moteur de layout : `getClientRects()` y rend une liste VIDE pour tout élément.
 * Or `visibleFocusables` (`src/ui/focus.ts`), `choiceOptions`/`focusTarget` (`src/ui/Modal.tsx`) filtrent dessus — sans
 * prothèse, tout focusable est jugé invisible et un banc clavier passe (ou échoue) pour la mauvaise
 * raison. La boîte est la seule chose que ce filtre mesure vraiment en navigateur.
 *
 * Deux portées, un seul rect :
 *  - `poserLayoutJsdom()` — TOUT le document attaché a une boîte (bancs où le vrai focus circule) ;
 *    rend la fonction de retrait, que l'appelant câble à SON `afterAll`/`finally`.
 *  - `rendreVisible(el)` — CET élément-ci seulement (bancs qui veulent choisir ce que la garde voit).
 *
 * Patron `monterRacine.testkit.ts` : aucun hook de vitest ici — sous `test.isolate: false`, un
 * `beforeAll` posé dans ce module n'appartiendrait qu'au premier fichier importateur.
 */
const RECT = { x: 0, y: 0, width: 80, height: 24, top: 0, left: 0, right: 80, bottom: 24, toJSON: () => ({}) } as DOMRect;

/** Prothèse GLOBALE : tout élément attaché au document a une boîte. Rend son retrait. */
export function poserLayoutJsdom(): () => void {
  const reel = HTMLElement.prototype.getClientRects;
  HTMLElement.prototype.getClientRects = function () {
    return (this.isConnected ? [RECT] : []) as unknown as DOMRectList;
  };
  return () => { HTMLElement.prototype.getClientRects = reel; };
}

/** Prothèse le temps d'un geste (pose + retrait garanti) — pour un banc qui ne veut pas du global. */
export function sousLayoutJsdom<T>(geste: () => T): T {
  const retirer = poserLayoutJsdom();
  try {
    return geste();
  } finally {
    retirer();
  }
}

/** Prothèse d'un SEUL élément : lui seul passe la garde de visibilité. */
export function rendreVisible(el: HTMLElement): void {
  el.getClientRects = (() => [RECT] as unknown as DOMRectList) as HTMLElement['getClientRects'];
}
