/**
 * COUCHE DISMISSIBLE côté React (#1476) — une surface s'empile tant qu'elle est à l'écran.
 *
 * `useDismissLayer('popover', fermer)` : push au montage (ou dès que la couche devient active), pop
 * au démontage. L'`onDismiss` est lu au moment de l'appui (référence vivante) : l'ordre de la pile
 * ne dépend donc JAMAIS des re-rendus, seulement des ouvertures/fermetures.
 *
 * PORTE CLAVIER de la pile : ce module installe un écouteur `keydown` en CAPTURE sur `window` tant
 * qu'au moins une couche est montée, et le retire ensuite. Conséquences voulues :
 *  - la pile tranche AVANT tout écouteur local (elle est la couche du dessus par définition) ;
 *  - une surface dismissible répond à Échap quel que soit l'écran ouvert ;
 *  - pile vide = aucun écouteur, et l'échelle métier du registre reste exactement celle d'avant.
 *
 * @clavier-hors-registre l'annulation appartient à la COUCHE du dessus, pas à l'application : elle se
 * résout par la pile (LIFO), n'est pas remappable, et passe AVANT le registre (garde
 * `ui/raccourcis-registre.test.ts`).
 *
 * FAIT sur cette porte : elle ne consulte PAS l'état de saisie (champ focalisé). Échap dans un champ
 * de texte porté par un dialogue congédie donc ce dialogue — patron des `<dialog>` natifs. Aucun
 * consommateur sous couche n'attend aujourd'hui qu'un champ garde Échap pour lui (mesuré : les seuls
 * sites qui consomment la touche chez eux sont hors pile, cf. la baseline d'`echap-couture-unique`).
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useGame } from '../state/store';
import { CODE_ECHAP } from '../state/keybindings';
import {
  pushLayer, popLayer, subscribeDismissStack, resetDismissStack, dismissStackHandles, type DismissHandle, type OnDismiss,
} from '../state/dismissStack';
import { resoudreEchap, echapRelachee } from '../state/resoudreEchap';

let montees = 0;

const onKeyDown = (e: KeyboardEvent) => {
  // `code` (position physique) ou `key` : la manette virtuelle et les bancs de test émettent l'un ou
  // l'autre, et une couche ouverte doit répondre aux deux.
  if (e.code !== CODE_ECHAP && e.key !== CODE_ECHAP) return;
  const pris = resoudreEchap(useGame.getState, { repeat: e.repeat });
  if (pris === null) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
};
const onKeyUp = (e: KeyboardEvent) => {
  if (e.code === CODE_ECHAP || e.key === CODE_ECHAP) echapRelachee();
};

function brancherPorte(): void {
  if (montees++ > 0) return;
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
}
function debrancherPorte(): void {
  if (--montees > 0) return;
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('keyup', onKeyUp, true);
}

/** Remise à zéro de la pile ET de sa porte clavier (refcount + écouteurs) — bancs de test seulement :
 *  un refcount survivant laisserait la porte branchée entre deux fichiers de test. */
export function resetDismissLayers(): void {
  resetDismissStack();
  if (montees > 0) {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
  }
  montees = 0;
  echapRelachee();
}

/** SURFACE d'une couche, inscrite à son ouverture : sa boîte, et sa nature — `dialogue`, une surface
 *  qui SUSPEND le jeu tant qu'elle est au-dessus (registre clavier et manette muets, piège de focus
 *  de `useModalA11y` : modales, écrans, conversation PNJ), ou surface non modale (bulle épinglée).
 *  Registre côté DOM : la pile (`src/state/dismissStack.ts`) ne porte aucun élément, elle dit
 *  seulement qui est au-dessus. */
export interface SurfaceDeCouche {
  readonly boite: RefObject<HTMLElement>;
  readonly dialogue: boolean;
}
const surfaces = new WeakMap<DismissHandle, SurfaceDeCouche>();

/** Boîte vivante de la couche `h`, ou `null` (couche sans surface inscrite, boîte hors du document). */
function boiteDe(h: DismissHandle): { el: HTMLElement; dialogue: boolean } | null {
  const s = surfaces.get(h);
  const el = s?.boite.current;
  return s && el?.isConnected ? { el, dialogue: s.dialogue } : null;
}

/** Un dialogue n'est jamais monté dans la boîte d'un autre : ouverts au même commit, leurs effets
 *  courent de l'enfant au parent, et la pile mettrait le parent au-dessus. */
function inscrire(h: DismissHandle, surface: SurfaceDeCouche): void {
  const el = surface.boite.current;
  if (import.meta.env.DEV && surface.dialogue && el) {
    for (const autre of dismissStackHandles()) {
      const b = autre === h ? null : boiteDe(autre);
      if (b?.dialogue && (b.el.contains(el) || el.contains(b.el))) {
        console.error(`dialogue « ${h.kind} » monté dans la boîte du dialogue « ${autre.kind} » : la pile ne dit plus lequel est au-dessus`);
      }
    }
  }
  surfaces.set(h, surface);
}

/** Le DIALOGUE DU DESSUS : la plus haute couche de la pile dont la surface inscrite est un dialogue
 *  vivant. Source unique de « qui est au-dessus ? » pour le sauvetage du focus, le piège Tab, le
 *  clavier et la manette — comme Échap (`resoudreEchap`). Une bulle, survolée ou épinglée, n'en est
 *  jamais un. */
export function dialogueDuDessus(): HTMLElement | null {
  const pile = dismissStackHandles();
  for (let i = pile.length - 1; i >= 0; i--) {
    const b = boiteDe(pile[i]);
    if (b?.dialogue) return b.el;
  }
  return null;
}

/** Surface où la manette navigue : une surface inscrite AU-DESSUS du dialogue du dessus qui détient
 *  le focus (bulle épinglée), sinon le dialogue du dessus. */
export function surfaceFocalisee(): HTMLElement | null {
  const pile = dismissStackHandles();
  const ae = document.activeElement;
  for (let i = pile.length - 1; i >= 0; i--) {
    const b = boiteDe(pile[i]);
    if (!b) continue;
    if (b.dialogue || (ae && b.el.contains(ae))) return b.el;
  }
  return null;
}

/**
 * @param kind libellé de DIAGNOSTIC (journal, tests), lu à l'ouverture — il n'entre dans aucun rang :
 *             l'ordre de la pile est celui des ouvertures, et une couche vit le temps de son ouverture.
 * @param onDismiss `null` = couche BLOQUANTE (consomme l'appui sans rien faire) ; `false` en retour
 *                  = la couche RESTE à l'écran (refus, ou congédiement PARTIEL, #1752). Gratuit par
 *                  contrat : il annule, il ne commet rien.
 * @param actif la couche n'existe que quand elle est réellement à l'écran.
 * @param onCouvert appelé quand une couche s'ouvre AU-DESSUS de celle-ci : une surface de survol
 *                  (infobulle) n'a plus rien à recouvrir et se retire d'elle-même. L'abonnement est
 *                  posé APRÈS le push de cette couche — elle ne se notifie donc jamais elle-même.
 * @param surface la boîte de la couche, inscrite à son ouverture (`dialogueDuDessus`, `surfaceFocalisee`).
 */
export function useDismissLayer(
  kind: string,
  onDismiss: OnDismiss | null,
  actif = true,
  onCouvert?: () => void,
  surface?: SurfaceDeCouche,
): void {
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const dismissRef = useRef<OnDismiss | null>(onDismiss);
  dismissRef.current = onDismiss;
  const couvertRef = useRef(onCouvert);
  couvertRef.current = onCouvert;
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  useEffect(() => {
    if (!actif) return;
    brancherPorte();
    // Bloquante (`onDismiss: null`) → elle RESTE : l'appui est consommé, la pile ne bouge pas.
    const h = pushLayer({ kind: kindRef.current, onDismiss: () => (dismissRef.current ? dismissRef.current() : false) });
    if (surfaceRef.current) inscrire(h, surfaceRef.current);
    const desabonner = subscribeDismissStack((e) => { if (e.type === 'push' && e.handle !== h) couvertRef.current?.(); });
    return () => {
      desabonner();
      popLayer(h);
      debrancherPorte();
    };
  }, [actif]);
}
