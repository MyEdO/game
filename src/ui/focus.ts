import { useEffect, useRef, type RefObject } from 'react';
import { dialogueDuDessus } from './useDismissLayer';

/**
 * Coutures de FOCUS partagées par toute surface qui déplace le focus DOM : dialogues (`Modal`,
 * `ScreenShell`, `EmbeddedShell`), couche d'infobulle (`Infobulle`), manette (`useGamepad`). Ce qui
 * n'appartient qu'aux cadres (ordre du focus initial, `focusTarget`) vit avec eux, dans `Modal.tsx`.
 */
const FOCUSABLE = 'button, [href], input, select, textarea';

/** SURFACE qui emprunte le focus : un dialogue ou une infobulle (rôle ARIA de sa boîte). */
export const SURFACE = '[role="dialog"],[role="tooltip"]';

/** Chaîne d'ORIGINES de chaque boîte ouverte : son origine, puis celles de la surface qui la contenait.
 *  Écrite et lue par `useFocusEmprunte` seul. */
const originesDeBoite = new WeakMap<Element, HTMLElement[]>();

/** Origines d'un emprunt ouvert depuis `o` : `o`, puis la chaîne de la surface qui contient `o`. */
const chaineDOrigines = (o: HTMLElement): HTMLElement[] => {
  const surface = o.closest(SURFACE);
  return [o, ...((surface && originesDeBoite.get(surface)) || [])];
};

/** Un contrôle ATTEIGNABLE : non `disabled`, effectivement rendu, hors d'un sous-arbre `inert`. */
export const atteignable = (el: HTMLElement): boolean =>
  !el.hasAttribute('disabled') && el.getClientRects().length > 0 && !el.closest('[inert]');

/** Focusables VISIBLES d'un conteneur (`atteignable`) — source UNIQUE du calcul partagé par le piège
 *  Tab et tout consommateur clavier. */
export function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(atteignable);
}

/** Focus posé par une SURFACE (ouverture, sauvetage, retour à l'invocateur), jamais par le joueur :
 *  levé le temps de l'appel `focus()`, dont les événements `focus`/`focusin` partent de façon synchrone. */
let sansIntention = false;
export function poserFocus(el: HTMLElement): void {
  sansIntention = true;
  try { el.focus(); } finally { sansIntention = false; }
}

/** Le focus en cours de pose est-il SANS INTENTION du joueur (posé par `poserFocus`) ? Lu par un
 *  `onFocus` qui ne doit répondre qu'à une intention (Tab, flèches, clic) : `:focus-visible` ne les
 *  distingue pas, un `focus()` appelé après une frappe clavier y répond comme la navigation. */
export const focusSansIntention = (): boolean => sansIntention;

/** FOCUS EMPRUNTÉ par une surface (WAI-ARIA APG, Dialog (Modal) Pattern : « When a dialog closes, focus
 *  returns to the element that invoked the dialog unless either: The invoking element no longer
 *  exists. […] ») : dès que la surface est `actif`, le focus entre sur `cible(box)` ; à sa fermeture, il
 *  revient à son ORIGINE, s'il est encore dans le document et qu'aucun dialogue du dessus ne le couvre
 *  (`dialogueDuDessus` absent, ou qui le contient) — sauf si le focus est déjà posé sur un élément
 *  vivant hors d'elle (ni sa boîte, ni son entrée), qu'il ne lui vole pas. « Son entrée » : celle de
 *  l'ouverture ET celle de la dernière étape.
 *  `origine` : l'invocateur de la surface. Défaut : le nœud qui avait le focus à cette ouverture (un
 *  dialogue) ; une infobulle passe le contrôle de son ancrage. Une origine sortie du document cède
 *  la place à l'origine de la surface qui la contenait (`chaineDOrigines`).
 *  `cible` rend `null` : la surface n'emprunte rien (ni entrée, ni retour).
 *  `etape` : l'entrée à l'étape, au-delà de l'invocateur de l'APG. Quand elle change pendant que la
 *  surface reste `actif`, le focus entre sur `cible(box)` sans passer par l'invocateur, sous la même
 *  règle : un élément vivant hors d'elle (ni sa boîte, ni son entrée) garde le focus.
 *  `actif` fait partie des DÉPENDANCES : une boîte qui n'existe qu'à l'ouverture (`{actif && <div
 *  ref=…>}`) n'a pas d'élément au premier rendu, et l'objet `ref` ne change jamais d'identité — sans
 *  cette dépendance l'effet sortirait à vide une fois pour toutes (#1752). */
export function useFocusEmprunte(
  boxRef: RefObject<HTMLElement | null>,
  actif: boolean,
  cible: (box: HTMLElement) => HTMLElement | null,
  etape?: string | number,
  origine?: () => HTMLElement | null,
) {
  // L'invocateur appartient à UNE ouverture. Il survit à un effet REJOUÉ pendant qu'elle dure
  // (StrictMode, dépendance qui change : `actif` reste vrai) — rejoué, l'effet trouve le focus déjà sur
  // l'entrée, et un invocateur masqué le temps de l'emprunt (`inert`) n'a pas pu le reprendre. Il tombe
  // une fois le focus rendu, son nœud disparu, ou l'ouverture close.
  const invocateur = useRef<HTMLElement[] | null>(null);
  const entreePosee = useRef<HTMLElement | null>(null);
  const origineRef = useRef(origine);
  origineRef.current = origine;
  useEffect(() => {
    const box = boxRef.current;
    if (!actif || !box) { invocateur.current = null; return; }
    const entree = cible(box);
    if (!entree) return;
    if (!invocateur.current) {
      const o = origineRef.current ? origineRef.current() : document.activeElement;
      invocateur.current = o instanceof HTMLElement ? chaineDOrigines(o) : [];
    }
    originesDeBoite.set(box, invocateur.current);
    poserFocus(entree);
    entreePosee.current = entree;
    return () => {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement && ae !== document.body && ae !== entree && ae !== entreePosee.current && !box.contains(ae)) return;
      const o = invocateur.current?.find((n) => n.isConnected);
      // Un dialogue reste au-dessus (`dialogueDuDessus`) et l'origine n'est pas dans sa boîte : le
      // focus lui revient, pas à l'origine peinte dessous — il le reprend par son repli (`Modal.tsx`).
      const dessus = dialogueDuDessus();
      if (o && (!dessus || dessus.contains(o))) poserFocus(o);
      else if (dessus && ae instanceof HTMLElement && box.contains(ae)) ae.blur();
      if (!o || document.activeElement === o) invocateur.current = null;
    };
  }, [boxRef, actif, cible]);
  // L'étape VUE de l'ouverture courante : `null` hors ouverture, la première valeur ne déplace rien
  // (l'emprunt vient d'entrer), seule une valeur DIFFÉRENTE est un changement d'étape.
  const etapeVue = useRef<{ etape: string | number | undefined } | null>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!actif || !box) { etapeVue.current = null; return; }
    if (!etapeVue.current) { etapeVue.current = { etape }; return; }
    if (Object.is(etapeVue.current.etape, etape)) return;
    etapeVue.current = { etape };
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && ae !== document.body && ae !== entreePosee.current && !box.contains(ae)) return;
    const t = cible(box);
    if (!t) return;
    poserFocus(t);
    entreePosee.current = t;
  }, [boxRef, actif, cible, etape]);
}
