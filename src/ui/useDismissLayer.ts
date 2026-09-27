/**
 * COUCHE DISMISSIBLE côté React (#1476) — une surface s'empile tant qu'elle est à l'écran.
 *
 * `useDismissLayer('popover', 'popover', fermer)` : push au montage (ou dès que la couche devient active), pop
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
import { useEffect, useRef } from 'react';
import { useGame } from '../state/store';
import { CODE_ECHAP } from '../state/keybindings';
import { pushLayer, popLayer, subscribeDismissStack, resetDismissStack, type LayerNature, type OnDismiss } from '../state/dismissStack';
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

/**
 * @param kind identifiant STABLE de la surface (`dismissStack`) — il n'entre dans aucun rang : l'ordre
 *             de la pile est celui des ouvertures.
 * @param nature `modale` (focus piégé : ce qui est dessous n'est plus jouable) ou `popover` (rien),
 *               `dismissStack`. REQUISE : une couche neuve se classe à sa déclaration.
 * @param onDismiss `null` = couche BLOQUANTE (consomme l'appui sans rien faire) ; `false` en retour
 *                  = la couche RESTE à l'écran (refus, ou congédiement PARTIEL, #1752). Gratuit par
 *                  contrat : il annule, il ne commet rien.
 * @param actif la couche n'existe que quand elle est réellement à l'écran.
 * @param onCouvert appelé quand une couche s'ouvre AU-DESSUS de celle-ci : une surface de survol
 *                  (infobulle) n'a plus rien à recouvrir et se retire d'elle-même. L'abonnement est
 *                  posé APRÈS le push de cette couche — elle ne se notifie donc jamais elle-même.
 */
export function useDismissLayer(kind: string, nature: LayerNature, onDismiss: OnDismiss | null, actif = true, onCouvert?: () => void): void {
  const dismissRef = useRef<OnDismiss | null>(onDismiss);
  dismissRef.current = onDismiss;
  const couvertRef = useRef(onCouvert);
  couvertRef.current = onCouvert;
  useEffect(() => {
    if (!actif) return;
    brancherPorte();
    // Bloquante (`onDismiss: null`) → elle RESTE : l'appui est consommé, la pile ne bouge pas.
    const h = pushLayer({ kind, nature, onDismiss: () => (dismissRef.current ? dismissRef.current() : false) });
    const desabonner = subscribeDismissStack((e) => { if (e.type === 'push' && e.handle !== h) couvertRef.current?.(); });
    return () => {
      desabonner();
      popLayer(h);
      debrancherPorte();
    };
  }, [kind, nature, actif]);
}
