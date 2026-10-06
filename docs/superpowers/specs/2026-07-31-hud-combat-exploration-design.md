# Refonte du HUD de combat et d’exploration — design

**Date :** 2026-07-31
**Révision :** 2026-08-06
**Statut :** validé, prêt pour plan d’implémentation
**Périmètre :** HUD de jeu sur la carte isométrique, en combat et hors combat

## 1. Problème et critère de réussite

Le HUD expose les informations essentielles, mais leur rôle n’est pas identifiable au premier regard : la barre de groupe peut être confondue avec l’ordre des tours, l’initiative ne porte pas clairement le round, plusieurs signaux flottent sans rattachement stable et les commandes de caméra mêlent navigation et inspection.

Un joueur doit pouvoir répondre immédiatement à quatre questions :

1. Qui compose mon groupe ?
2. Quel est le round et qui joue maintenant ?
3. Que peut faire l’acteur courant et que lui reste-t-il ?
4. Quelle information contextuelle réclame mon attention maintenant ?

## 2. Responsabilité de chaque ancrage

| Zone | Responsabilité | Ne doit pas porter |
|---|---|---|
| Haut, centre | Identité et santé du groupe | Acteur courant, ordre des tours |
| Gauche | Temps du combat | Actions disponibles |
| Bas, centre | Décisions de l’acteur courant | État global du groupe |
| Haut, droite | Aucune plaque : la caméra se pilote au geste et au clavier (§6) | Actions de combat |
| Haut, gauche hors combat | Lieu, date et objectif courant | Initiative ou actions de tour |
| Centre de la carte | Situation tactique et contexte immédiat | Informations persistantes déjà présentes dans le HUD |

La carte reste la surface dominante. Une information persistante a un seul propriétaire ; une transition change sa donnée, pas la position de sa surface.

## 3. États couverts

| État | Question prioritaire | Informations persistantes | Informations contextuelles |
|---|---|---|---|
| Exploration | Où vais-je et pourquoi ? | Groupe, lieu, date, objectif | Interaction survolée ou engagée |
| Dialogue / précombat | Quel choix change la situation ? | Groupe, interlocuteur | Choix et conséquences connues |
| Pause de round | Quel round commence et qui pourra jouer ? | Round, initiative | Pré-emption existante |
| Tour joueur | Qui joue et que lui reste-t-il ? | Round, initiative, acteur, économie d’actions | Actions légales, états urgents |
| Déplacement | Où puis-je aller et à quel coût ? | Round, initiative, mouvement restant | Zone, trajet, coût, refus calculé |
| Ciblage / attaque | Qui attaque qui et avec quelles valeurs ? | Acteur, cible, action engagée | Contrat de jet Z0–Z15 |
| Résultat / influence | Que s’est-il passé et puis-je infléchir le résultat ? | Verdict, marge, ressources | Relance, DR, Pacte, résultat final |
| Tour ennemi | Qui agit contre qui ? | Round, acteur ennemi, initiative | Cible, action, résolution brève |
| Combat fini | Quel est le verdict ? | Round et ordre final sans acteur courant | Verdict de fin de combat |

## 4. Barre de groupe — `PartyDock`

`PartyDock` reste strictement identitaire et conserve les primitives existantes :

- `PortraitTile` en variante `full` ;
- la `LifeBar` rendue par `PortraitTile` ;
- les `StateChips` réservés et ancrés par `PortraitTile` ;
- le clic de fiche ou de ciblage et son libellé accessible.

`PartyDock` perd entièrement `activeId`, la prop `active` transmise à `PortraitTile`, le caret et tout style persistant d’acteur courant. Il ne porte jamais `JOUE`, `ACTIF`, `PRÊT`, `SUIT`, l’ordre d’initiative ni un marqueur persistant de sélection.

Les états `hover` et `focus-visible` restent transitoires. Une alerte est contenue par la carte du personnage concerné, utilise le registre d’icônes et possède un nom accessible.

## 5. Initiative et round — `InitiativeStrip`

`InitiativeStrip` reçoit explicitement `round: number`. Le round et la liste appartiennent au même panneau ; l’initiative disparaît intégralement hors combat.

La phase de chaque entrée est dérivée uniquement de son index courant dans `order`, de `turn` et de `over` :

- `turn === -1` : pause de début de round, toutes les entrées sont `future`, aucune n’est courante ;
- combat en cours : index `< turn` = `past`, index `=== turn` = `current`, index `> turn` = `future` ;
- combat fini : aucune entrée `current` ;
- un renfort prend la phase correspondant à son index dans l’`order` effectivement rendu, sans mémoire de sa position précédente.

Le courant porte `aria-current="step"`, la surbrillance existante et un marqueur non chromatique. Les passés sont atténués sans disparaître ; les futurs gardent le contraste normal. La couleur de camp reste secondaire. Si la liste déborde, elle reste défilable sans réduire les portraits jusqu’à l’illisible.

Le toggle d’inspection quitte `InitiativeStrip`.

## 6. Inspection et commandes de vue — des gestes, aucune plaque

Arbitrage du 2026-08-17 (`docs/plans/2026-08-16-spec-hud-combat.md`, « ARBITRAGE CAMÉRA ») : « gestes + clavier seuls — la plaque `ViewControls` QUITTE le jeu » ; l'éditeur la garde. Verrou : `src/ui/camera-sans-plaque.test.ts`.

L'inspection n'est pas un mode à basculer : c'est le GESTE SECONDAIRE d'une entité (#1822, 2026-10-05 : « le clique gauche déclenche l'attaque et le clique droit inspecte »), en combat comme hors combat :

- sur un PORTRAIT (`PortraitTile.onInspect`, frise `InitiativeStrip` et bandeau `PartyDock`) : clic droit, appui long (`useLongPress`), touche Menu ou Maj+F10 sur la tuile focalisée — le patron de l'alvéole `ConsoleCell`, annoncé dans le nom accessible ;
- sur un JETON du plateau (`useStagePointer`) : clic droit et appui long ; la fiche se résout par la case en combat, par l'entité de scène à fiche hors combat ;
- au clavier, la liaison `inspecter` (touche I) du registre `keybindings.ts` : la case du curseur, sinon le survolé ; à la manette, R3 sur la carte.

Le clic GAUCHE garde l'attaque, le ciblage et l'offre. `ViewControls` ne porte que l'orientation, la projection, le POV et le zoom ; projection et POV portent `aria-pressed`.

## 7. Flux de combat — `CombatBanner`

Pendant un combat non terminé, `CombatBanner` conserve une région persistante :

```tsx
role="status"
aria-live="polite"
aria-atomic="true"
```

La région reste montée lorsqu’aucun message n’est disponible. Elle ne porte aucune animation ni `key` de beat. Son unique enfant éventuel porte la `key` et l’animation du message courant. Il n’y a jamais plus d’un enfant annoncé.

Le bandeau ne porte jamais le round, ne remplace aucune information persistante et conserve les sources `narrateIntent` / `combatFeed` ainsi que leur cadence actuelle.

## 8. Dock de décision — `ActiveFrame` et `ActionBar`

Le dock répond à : « cet acteur dispose de ces ressources et peut accomplir ces actions ». Il conserve sans régression :

- le `PortraitTile`, sa vie et les `StateChips` ;
- les crans et leurs aperçus visuels existants ;
- l’identité courte de l’acteur ;
- le commutateur de loadout, ses contrôles, ses limites et ses handlers existants ;
- toutes les actions légales de `ActionBar`, dont `Fin du tour`.

Il ajoute une lecture textuelle nommée pour `Action`, `Mouvement` et `Avantage`. Il n’invente aucune ressource de réaction. Les valeurs courantes et maximales proviennent des props déjà calculées. Quand `previewResourceDelta` ou `hoverDelta` fournit un aperçu, le texte affiche l’avant et l’après (`1 → 0`, `4 → 2`, `2 → 3`) à partir de ces valeurs ; `ActiveFrame` ne relance aucun calcul de moteur.

Une ressource consommée est nommée comme telle, et pas seulement grisée. Le dock disparaît hors combat.

## 9. Déplacement — une résolution, trois consommateurs

Le moteur expose un résolveur de lecture pur, sans écriture de store :

```ts
export type MovementResolution =
  | { status: 'ok'; path: Pt[]; cost: number; kind: 'move' | 'run' }
  | { status: 'blocked'; reason: string };

export function resolveMovementAt(get: Get, pt: Pt): MovementResolution;
```

Ce résolveur devient la source canonique du survol, du premier tap et du commit. Un appel réussi produit le chemin, le coût et la nature du mouvement ensemble. Le premier tap conserve cette résolution dans l’aperçu ; le commit sur la même destination réutilise le chemin et le coût conservés. Aucun de ces consommateurs ne rappelle `pathTo`. La Course conserve le chemin dans `PendingRun` afin que l’application du résultat tronque ce même chemin sans second `pathTo`.

`MovementIntent` rend uniquement la résolution fournie et le mouvement restant déjà calculé :

- `ok` : nature, coût, avant → après et légalité ;
- `blocked` : `reason` verbatim ;
- `null` : aucun bandeau.

Il ne recalcule ni chemin, ni coût, ni refus et n’invente jamais une cause d’interdiction.

### Propriété des transitions de déplacement

| Transition | Producteur propriétaire | Donnée conservée | Consommateurs | Fin de propriété |
|---|---|---|---|---|
| Entrée sur une case au pointeur / curseur | `useHoverTargeting` appelle `resolveMovementAt` | `movementIntent` éphémère | tracé de carte, `MovementIntent`, aperçu de ressources | sortie de case, modale bloquante, changement de mode |
| Premier tap | `battleClickTile` appelle `resolveMovementAt` une fois | `battle.preview` + `movementIntent` | tracé, `MovementIntent`, `ActiveFrame` | annulation, autre destination, commit, changement de tour |
| Tap de confirmation | `battleClickTile` lit l’aperçu de la même destination | le même `path`/`cost` | placement, orientation, animation, franchissements | commit atomique puis purge |
| Confirmation directe sans aperçu | `battleClickTile` appelle `resolveMovementAt` une fois | résolution locale | commit | fin du commit |
| Course en attente | `battleRun` transfère le chemin résolu dans `PendingRun` | `PendingRun.path` | `runConfirm` | appliquer ou annuler le jet |
| Résolution bloquée | le producteur qui a demandé la résolution | `{ status: 'blocked', reason }` | `MovementIntent` seulement | nouvelle intention ou sortie du mode |

Les routes existantes de ciblage de case et de désengagement gardent leur propriétaire et précèdent ce résolveur ; ce chantier ne change aucune mécanique.

## 10. Attaque — conformité au contrat Z0–Z15

L’attaque ne possède aucun schéma local. Son rendu se conforme au tableau « Contrat d’affichage d’un jet (Z0–Z15) » de `docs/charte-ui.md` : `RollShell` possède les zones, `VsHeader` possède Z3, les lignes possèdent Z5, l’issue passe par Z12 et les verbes passent par Z15.

Le lot ajoute un verrou de rendu du flux réel `useAttackJetProps` dans `RollShell` et corrige seulement la projection de props si une zone est non conforme. La mécanique d’attaque, les transitions de `pendingAttack`, les calculs, `AttackModal` et toute nouvelle modale sont hors périmètre. Le HUD ne prescrit plus un ordre ad hoc concurrent de Z0–Z15.

## 11. Exploration

Hors combat, une même pile en haut à gauche contient, dans cet ordre :

1. le lieu courant ;
2. la date et l’heure par `GameDate` ;
3. l’objectif courant par `ObjectiveBanner`.

L’initiative, le round, `CombatBanner` et le dock de tour sont absents. `PartyDock` reste inchangé. Les interactions restent signalées directement sur la carte par les affordances existantes ; le HUD n’en crée aucune liste permanente.

## 12. Matrice responsive

Les seuls breakpoints de largeur sont 900, 700 et 560 px. La validation à 360 px appartient à la tranche `<=560` et n’ajoute aucun breakpoint.

| Largeur | Groupe | Initiative | Caméra (éditeur) | Dock et modales |
|---|---|---|---|---|
| `>900` | quatre cartes lisibles, nom et vie | colonne gauche, round intégré | groupes complets en haut droite | disposition de référence |
| `701–900` | cartes compactes, nom et vie conservés | colonne réduite, courant entier | icônes et infobulles | dock sur deux rangées au besoin |
| `561–700` | portraits compacts, vie superposée | bande horizontale défilable sous le groupe, round en premier | commandes secondaires compactées sans disparition | dock pleine largeur, actions sur deux colonnes |
| `<=560` | quatre portraits sur une ligne, défilement horizontal de secours | courant + deux suivants visibles, reste défilable | cibles de 44 px sous `pointer: coarse` | dock compact ; modales plein écran, corps défilable, actions finales fixes |

À 360 px, les quatre portraits restent sur une ligne, l’acteur courant est atteignable, le round reste visible, les commandes restent activables et aucune surface ne recouvre `Fin du tour`.

## 13. Primitives et contraintes

- `PortraitTile` / `CharFrame`, `LifeBar` et `StateChips` pour les personnages ;
- `RollShell`, `RollRow` et `VsHeader` pour les jets ;
- registre d’icônes existant, aucun emoji ni SVG local ;
- primitives et tokens globaux de `styles.css`, aucune couleur en dur ;
- aucune logique métier nouvelle dans l’UI ;
- ids stables pour toute logique, jamais les libellés ;
- textes visibles en français ;
- clavier, `focus-visible`, noms accessibles et information compréhensible sans couleur ;
- aucun breakpoint autre que 900, 700 et 560 px ;
- aucune nouvelle règle de jeu ni modification de référence RAW.

## 14. Critères d’acceptation testables

1. Le rendu de `PartyDock` ne reçoit plus `activeId`, ne transmet plus `active` et ne contient aucun caret, tout en gardant vie et états.
2. `InitiativeStrip` affiche `round`, rend toutes les entrées `future` pour `turn=-1`, dérive `past/current/future` par index, ne marque aucun courant si `over=true` et classe un renfort selon son index actuel.
3. Aucune surface ne porte de bascule d’inspection ; le clic droit, l’appui long et Menu/Maj+F10 d’un portrait, le clic droit et l’appui long d’un jeton, la touche `inspecter` ouvrent `InspectPanel` sur l’entité désignée.
4. En combat sans message, la région `CombatBanner` reste montée avec `role=status`, `aria-live=polite`, `aria-atomic=true` et aucun enfant ; avec message, un seul enfant est animé.
5. Le dock conserve le loadout et les contrôles existants, affiche Action, Mouvement et Avantage en texte et rend l’aperçu avant → après depuis les deltas existants.
6. Un test de store prouve que survol, premier tap et commit obtiennent la même résolution et que le commit ne contient aucun second appel à `pathTo` ; `MovementIntent` rend `reason` sans le fabriquer.
7. Hors combat, lieu, date et objectif forment la pile haut-gauche ; initiative, round, bandeau de combat et dock sont absents.
8. Le flux d’attaque réel est rendu dans `RollShell` et respecte les propriétaires Z0–Z15 sans modification de mécanique ni nouvelle modale.
9. Les tests CSS verrouillent les tranches `>900`, `701–900`, `561–700`, `<=560` et `pointer: coarse`, sans media query à 360 ou 420 px.
10. Les états pause de round, tour joueur, déplacement, attaque, résultat, tour ennemi, combat fini et exploration sont recettés à 1600×900, 900, 700, 560 et 360 px.
11. À 360 px, groupe, round, acteur courant, commandes et `Fin du tour` restent utilisables sans collision.
12. La recette clavier couvre groupe, initiative, commandes, dock et modale ; la console reste à zéro erreur.

## 15. Hors périmètre

- modification des règles d’initiative, de déplacement ou d’économie d’actions ;
- modification de la mécanique d’attaque ou création/refonte d’`AttackModal` ;
- refonte des sprites, de la carte ou de la projection isométrique ;
- nouveau journal de combat complet ;
- nouveaux raccourcis clavier ;
- refonte artistique définitive des matières et ornements.

La passe artistique finale vient après validation fonctionnelle dans le jeu réel.
