/**
 * COUCHE DISMISSIBLE côté React (#1476) — une surface s'empile tant qu'elle est à l'écran.
 *
 * `useDismissLayer({ kind, nature, plan, boite }, fermer)` : push au montage (ou dès que la couche
 * devient active), pop au démontage. L'`onDismiss` est lu au moment de l'appui (référence vivante) : l'ordre de la pile
 * ne dépend donc JAMAIS des re-rendus, seulement des ouvertures/fermetures.
 *
 * PORTE CLAVIER de la pile : ce module installe un écouteur `keydown` en CAPTURE sur `window` tant
 * qu'au moins une couche est montée, et le retire ensuite. Conséquences voulues :
 *  - la pile tranche AVANT tout écouteur local (elle est la couche du dessus par définition) ;
 *  - une surface dismissible répond à Échap quel que soit l'écran ouvert ;
 *  - pile vide = aucun écouteur, et l'échelle métier du registre reste exactement celle d'avant.
 *
 * @clavier-hors-registre l'annulation appartient à la COUCHE du dessus, pas à l'application : elle se
 * résout par la pile (`coucheDuDessus`), n'est pas remappable, et passe AVANT le registre (garde
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
  pushLayer, popLayer, subscribeDismissStack, resetDismissStack, dismissStackHandles, modaleDuDessus,
  type DismissHandle, type LayerNature, type LayerPlan, type OnDismiss,
} from '../state/dismissStack';
import { resoudreEchap, echapRelachee } from '../state/resoudreEchap';
import { posePartagee } from '../lib/posePartagee';

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

const PORTE = posePartagee(
  () => {
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
  },
  () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
  },
);

/** Remise à zéro de la pile ET de sa porte clavier (preneurs + écouteurs) — bancs de test seulement :
 *  un preneur survivant laisserait la porte branchée entre deux fichiers de test. */
export function resetDismissLayers(): void {
  resetDismissStack();
  PORTE.vider();
  echapRelachee();
}

/** SURFACE d'une couche, inscrite à son ouverture : sa boîte. Registre côté DOM : la pile
 *  (`src/state/dismissStack.ts`) ne porte aucun élément, elle dit seulement qui est au-dessus. */
export interface SurfaceDeCouche {
  readonly boite: RefObject<HTMLElement | null>;
}

/** DÉCLARATION d'une couche, lue à son ouverture : son identifiant STABLE, sa NATURE et son PLAN
 *  (`dismissStack`), et sa boîte. Tout est REQUIS : une couche neuve se classe à sa déclaration. */
export interface DeclarationDeCouche extends SurfaceDeCouche {
  readonly kind: string;
  readonly nature: LayerNature;
  readonly plan: LayerPlan;
}

const surfaces = new WeakMap<DismissHandle, SurfaceDeCouche>();

/** Boîte vivante de la couche `h`, ou `null` (boîte hors du document). */
function boiteDe(h: DismissHandle): HTMLElement | null {
  const el = surfaces.get(h)?.boite.current;
  return el?.isConnected ? el : null;
}

/** Une modale n'est jamais montée dans la boîte d'une autre : ouvertes au même commit, leurs effets
 *  courent de l'enfant au parent, et la pile mettrait le parent au-dessus. */
function inscrire(h: DismissHandle, surface: SurfaceDeCouche): void {
  const el = surface.boite.current;
  if (import.meta.env.DEV && h.nature === 'modale' && el) {
    for (const autre of dismissStackHandles()) {
      const b = autre === h || autre.nature !== 'modale' ? null : boiteDe(autre);
      if (b && (b.contains(el) || el.contains(b))) {
        console.error(`dialogue « ${h.kind} » monté dans la boîte du dialogue « ${autre.kind} » : la pile ne dit plus lequel est au-dessus`);
      }
    }
  }
  surfaces.set(h, surface);
}

/** Le DIALOGUE DU DESSUS : la boîte de la modale du dessus (`modaleDuDessus`), ou `null`. Lu par le
 *  focus (emprunt, sauvetage, restitution), le piège Tab et la manette ; les touches et la marche lisent
 *  la même couche dans la pile, et Échap (`resoudreEchap`) la même pile par `coucheDuDessus`. Une
 *  bulle, survolée ou épinglée, n'en est jamais un. */
export function dialogueDuDessus(): HTMLElement | null {
  const h = modaleDuDessus();
  return h ? boiteDe(h) : null;
}

/** Surface où la manette navigue : une surface peinte AU-DESSUS du dialogue du dessus qui détient le
 *  focus (bulle épinglée), sinon le dialogue du dessus. */
export function surfaceFocalisee(): HTMLElement | null {
  const peinte = dismissStackHandles();
  const ae = document.activeElement;
  for (let i = peinte.length - 1; i >= 0; i--) {
    if (peinte[i].nature === 'modale') return boiteDe(peinte[i]);
    const el = boiteDe(peinte[i]);
    if (el && ae && el.contains(ae)) return el;
  }
  return null;
}

/**
 * @param declaration identifiant STABLE, nature, plan et boîte de la couche (`DeclarationDeCouche`),
 *                    lus à l'OUVERTURE : l'ordre de la pile est celui des ouvertures, et une couche
 *                    vit le temps de son ouverture.
 * @param onDismiss `null` = couche BLOQUANTE (consomme l'appui sans rien faire) ; `false` en retour
 *                  = la couche RESTE à l'écran (refus, ou congédiement PARTIEL, #1752). Gratuit par
 *                  contrat : il annule, il ne commet rien.
 * @param actif la couche n'existe que quand elle est réellement à l'écran.
 * @param onCouvert appelé quand une couche s'ouvre et est peinte AU-DESSUS de celle-ci : une surface de
 *                  survol (infobulle) n'a plus rien à recouvrir et se retire d'elle-même. L'abonnement
 *                  est posé APRÈS le push de cette couche — elle ne se notifie donc jamais elle-même.
 */
export function useDismissLayer(
  declaration: DeclarationDeCouche,
  onDismiss: OnDismiss | null,
  actif = true,
  onCouvert?: () => void,
): void {
  const declarationRef = useRef(declaration);
  declarationRef.current = declaration;
  const dismissRef = useRef<OnDismiss | null>(onDismiss);
  dismissRef.current = onDismiss;
  const couvertRef = useRef(onCouvert);
  couvertRef.current = onCouvert;
  useEffect(() => {
    if (!actif) return;
    const rendrePorte = PORTE.prendre();
    const { kind, nature, plan, boite } = declarationRef.current;
    // Bloquante (`onDismiss: null`) → elle RESTE : l'appui est consommé, la pile ne bouge pas.
    const h = pushLayer({ kind, nature, plan, onDismiss: () => (dismissRef.current ? dismissRef.current() : false) });
    inscrire(h, { boite });
    const desabonner = subscribeDismissStack((e) => {
      if (e.type !== 'push' || e.handle === h) return;
      const peinte = dismissStackHandles();
      if (peinte.indexOf(e.handle) > peinte.indexOf(h)) couvertRef.current?.();
    });
    return () => {
      desabonner();
      popLayer(h);
      rendrePorte();
    };
  }, [actif]);
}
