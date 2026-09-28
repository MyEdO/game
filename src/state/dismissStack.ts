/**
 * PILE DES COUCHES DISMISSIBLES — socle du congédiement (Échap, B de la manette, #1476).
 *
 * Modèle STANDARD (celui des `<dialog>`/popover natifs) : chaque surface qui peut être congédiée
 * s'empile à son ouverture, se dépile à sa fermeture, et un appui congédie LA COUCHE DU DESSUS.
 * Le `kind` est l'identifiant STABLE de la surface : il n'entre dans aucun rang.
 *
 * PLAN d'une couche, déclaré à l'empilement (REQUIS) — où elle est PEINTE :
 *  - `scene` : dans la scène de jeu, sous toute surface d'application (la fenêtre de conversation,
 *    sans `z-index` dans `.stage-flot`, `styles/components.css`) ;
 *  - `application` : au-dessus de la scène (modales, écrans, menus, bulles — voiles `fixed`).
 * LA COUCHE DU DESSUS est celle du plan le plus haut, puis la dernière ouverte dans ce plan
 * (`coucheDuDessus`) : c'est ce qui est peint au-dessus, et c'est elle que l'appui congédie.
 *
 * NATURE d'une couche, déclarée à l'empilement (REQUISE) — le modèle natif :
 *  - `modale` (un `<dialog>` ouvert par `showModal()`) : elle PIÈGE le focus (`useModalA11y`) — ce qui
 *    est dessous n'est plus jouable, ni au clavier ni à la marche, qu'un voile le couvre ou non ;
 *  - `popover` : il ne piège rien — au-dessus, il se congédie en premier, mais il ne prend ni les touches
 *    ni la page.
 * Le congédiement ignore la nature ; `modaleDuDessus` la lit pour dire quelle surface MODALE est
 * au-dessus sur l'écran de CE siège (la pile est locale au client).
 *
 * Deux façons pour une couche de RESTER à l'écran :
 *  - `onDismiss: null` — couche BLOQUANTE : elle CONSOMME l'appui sans rien faire (l'équivalent du
 *    `closedBy="none"` natif : dialogue PNJ en cours, jet posé qui doit être résolu) ;
 *  - `onDismiss()` qui rend `false` — la couche RESTE : refus pur, ou congédiement PARTIEL (#1752)
 *    — une surface à SOUS-ÉCRANS descend d'un échelon interne (sous-écran → racine) et GARDE sa
 *    couche, sans quoi elle serait à l'écran sans couche et l'appui suivant filerait au registre.
 * Dans les deux cas la résolution s'arrête là : UN APPUI = AU PLUS UNE FERMETURE, jamais de cascade
 * vers la couche suivante.
 *
 * CONTRAT DES COUCHES : `onDismiss` est GRATUIT — il annule, il ne commet rien (aucune ressource
 * dépensée, aucune action engagée). Une sortie qui COMMET se clique.
 *
 * Module FEUILLE (patron `combatants.ts`) : zéro import runtime — ni store, ni React, ni DOM.
 */

/** Ce qu'une couche fait quand on la congédie. `void` = fermée (dépilée) ; `false` = elle RESTE à
 *  l'écran, l'appui consommé — refus pur, ou congédiement PARTIEL (un échelon interne de moins). */
export type OnDismiss = () => void | boolean;

/** Ce que la couche fait de ce qui est dessous (cf. en-tête) : `modale` le retire au clavier et à la
 *  marche, `popover` n'en retire rien. */
export type LayerNature = 'modale' | 'popover';

/** Où la couche est PEINTE (cf. en-tête) : `scene` sous `application`. */
export type LayerPlan = 'scene' | 'application';

const RANG_DU_PLAN: Readonly<Record<LayerPlan, number>> = { scene: 0, application: 1 };

/** Jeton opaque rendu par `pushLayer` : la seule façon de désigner SA couche pour la retirer. */
export interface DismissHandle {
  readonly kind: string;
  readonly nature: LayerNature;
  readonly plan: LayerPlan;
}

interface Couche extends DismissHandle {
  readonly onDismiss: OnDismiss | null;
}

/** Résultat d'un appui : la couche du dessus s'est fermée, est RESTÉE (bloquante, refus ou
 *  congédiement partiel), ou il n'y avait aucune couche. */
export type DismissResult = 'ferme' | 'reste' | 'vide';

/** Mouvement de la pile, notifié aux abonnés (une surface de SURVOL se retire quand une couche
 *  s'ouvre AU-DESSUS d'elle : elle n'est plus la couche du dessus, elle n'a plus rien à recouvrir). */
export interface DismissEvent {
  readonly type: 'push' | 'pop';
  readonly handle: DismissHandle;
  readonly taille: number;
}

let pile: Couche[] = [];
let abonnes: ((e: DismissEvent) => void)[] = [];

function notifier(e: DismissEvent): void {
  for (const fn of [...abonnes]) fn(e);
}

export function pushLayer(couche: { kind: string; nature: LayerNature; plan: LayerPlan; onDismiss: OnDismiss | null }): DismissHandle {
  const c: Couche = { kind: couche.kind, nature: couche.nature, plan: couche.plan, onDismiss: couche.onDismiss };
  pile.push(c);
  notifier({ type: 'push', handle: c, taille: pile.length });
  return c;
}

/** Retrait HORS-ORDRE : une couche démontée par le rendu (pas par un appui) retire LA SIENNE, où
 *  qu'elle soit dans la pile — l'ordre des autres est préservé. Idempotent. */
export function popLayer(handle: DismissHandle): void {
  const i = pile.lastIndexOf(handle as Couche);
  if (i < 0) return;
  pile.splice(i, 1);
  notifier({ type: 'pop', handle, taille: pile.length });
}

/** Couches de la pile dans l'ordre PEINT, du bas vers le haut : par plan, puis par ouverture. */
export const dismissStackHandles = (): readonly DismissHandle[] =>
  pile.map((c, i) => [c, i] as const)
    .sort(([a, i], [b, j]) => RANG_DU_PLAN[a.plan] - RANG_DU_PLAN[b.plan] || i - j)
    .map(([c]) => c);

/** LA COUCHE DU DESSUS (parmi celles que `filtre` retient) : plan le plus haut, puis la dernière
 *  ouverte dans ce plan. SOURCE UNIQUE de « qui est au-dessus ? » — congédiement, touches, marche,
 *  focus. */
export function coucheDuDessus(filtre?: (c: DismissHandle) => boolean): DismissHandle | undefined {
  const peinte = dismissStackHandles();
  for (let i = peinte.length - 1; i >= 0; i--) if (!filtre || filtre(peinte[i])) return peinte[i];
  return undefined;
}

/** La couche MODALE du dessus sur l'écran de CE siège (le focus y est piégé), ou `undefined`. */
export const modaleDuDessus = (): DismissHandle | undefined => coucheDuDessus((c) => c.nature === 'modale');

export function dismissTop(): DismissResult {
  const top = coucheDuDessus() as Couche | undefined;
  if (!top) return 'vide';
  if (!top.onDismiss) return 'reste';
  if (top.onDismiss() === false) return 'reste';
  popLayer(top);
  return 'ferme';
}

export const dismissStackSize = (): number => pile.length;

/** `kind` de toutes les couches, dans l'ordre PEINT, du bas vers le haut — lecture de DIAGNOSTIC :
 *  seuls les tests la lisent. */
export const dismissStackKinds = (): readonly string[] => dismissStackHandles().map((c) => c.kind);

export function subscribeDismissStack(fn: (e: DismissEvent) => void): () => void {
  abonnes.push(fn);
  return () => { abonnes = abonnes.filter((f) => f !== fn); };
}

/** Remise à zéro de l'ÉTAT de la pile — couches ET abonnés (un abonné survivant d'un test précédent
 *  rappellerait le `unpin` d'un composant démonté). Bancs de test uniquement, aucun appelant runtime ;
 *  la PORTE clavier, elle, se remet par `resetDismissLayers` (`src/ui/useDismissLayer.ts`, DOM). */
export function resetDismissStack(): void {
  pile = [];
  abonnes = [];
}
