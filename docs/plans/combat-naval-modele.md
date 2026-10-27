# Modèle de combat naval tactique (MDG ch.12-14)

Ticket: #3002

> **Plan encore OUVERT** — les jalons ⏳ restent à faire ; suivre le découpage §7 pour l'état courant.

> Spec d'architecture du combat naval. But : qu'on construise **la bonne chose une fois** — postes/équipage/
> tir/manœuvre cohérents, zéro système parallèle, zéro contenu en dur. Toute règle est RAW citable
> (`MDG ch.N l.X`). **Modèle à DEUX échelles** (§1bis) : couche **Mer** opérationnelle (jetons-navires,
> bordées, manœuvre) ⇄ couche **Pont** tactique (abordage = combat terrestre normal). ⚠ MDG n'a **aucun
> mini-jeu d'abordage** (grappins/traversée ABSENTS du RAW) → on ne l'invente pas ; **la collision** est le
> pont entre les couches.

## 1. Objectif & invariants

Le groupe manœuvre un navire, **oriente le cap pour aligner une bordée**, lâche des batteries, éperonne,
aborde. **Deux échelles** (§1bis) : sur la **Mer**, le navire est un jeton-coque qui agit en unité (Tests
d'équipage) ; à l'**abordage**, on descend au **Pont** person-scale (combat terrestre normal). Invariants
(non négociables) :

- **Navire = Combattant-coque** (`bodyShape:'vehicule'`), jamais un type `Ship` parallèle → hérite
  dégâts/Critiques/États/footprint/cap(`Dir8`)/ciblage du moteur existant.
- Tout EFFET = `GameOp[]`/`applyOps` ; toute table = `findTableEntry` ; tout jet = fabrique `rollFlow` ;
  **toute attaque ciblable = `availableAttacks` + clic unifié**. On ÉTEND ces vocabulaires, on n'ajoute pas
  de machinerie qui nomme une entité.
- Moteur `engine/` pur+testé (maths : `collision`, `shipNavigation`, Test d'équipage) ; `state/` pour ce qui
  dépend du cap/de la grille (`fireArc`, postes-sur-coque, extension d'`availableAttacks`) ; `ui/` pour
  l'authoring & les modales.
- **Tout authorable** : une pièce servie, son arme, son côté, son équipage s'éditent à l'Inspector via `RefField`.
- **Généralité avant naval** : une pièce SERVIE (*Arme d'équipe*) est un concept **sol + navire** ; le naval =
  la spécialisation « montée sur une coque ». La machinerie d'arme servie ne nomme rien de naval — c'est le
  SUPPORT (coque vs affût au sol) qui paramètre position+cap.

## 1bis. Deux échelles (Mer opérationnelle ⇄ Pont tactique) — modèle RAW-fidèle

Une bataille réaliste = ~5 navires de toutes tailles, certains pilonnant à ~150 m pendant qu'un abordage a
lieu ailleurs, les PJ étant 4 **parmi ~50 marins**. Le RAW (MDG) gère ça à **deux échelles**, jamais une seule :

- **Couche MER (opérationnelle)** — spatialisation des **valeurs métriques RAW** (M en m/Round `ch.13 l.41` ;
  portées canon 50/75/150 m `ch.12 l.401` ; 1 pt de Distance = 10 m `ch.13 l.362`). Chaque navire = **un
  jeton-coque** (cap `Dir8`, footprint) qui **agit en unité** via des **Tests d'équipage** (manœuvre/batterie/
  éperonnage). L'équipage est **abstrait** : les PJ tiennent des **rôles** et « la performance des Personnages
  représente celle de tout l'équipage » (`ch.14 l.39`) — jamais 50 tokens, juste un Moral + un % d'effectif.
- **Couche PONT (tactique)** — **combat terrestre NORMAL** (`ch.13 l.612` : « gérée comme une attaque entre
  personnages »), person-scale. C'est ce que le scénario 25 exerce déjà.
- **Pont entre les couches = la COLLISION.** ⚠ MDG n'a **AUCUN** mini-jeu d'abordage (grappins, traversée,
  capture = **absents du RAW**) → **ne rien inventer**. La poursuite réduit la Distance ; à **Distance 0 →
  collision** (`resolveCollision`) → coques adjacentes → mêlée normale. Réutilise `engage` (verrou de coques)
  et `pathTo` (traversée = déplacement normal). La canonnade **continue** pendant l'abordage (`ch.14 l.126`) →
  une bordée pleut sur le pont actif (éclats = Indice × 9 Dégâts, `ch.13 l.668`).

### Bateau-prefab : le PONT est une facette du TYPE de navire

Chaque type a son **pont propre**, authoré **une fois**, instancié dans un scénario **sans recréer** de scène :
facette `deck` sur `VehicleData` (`vehicles.json`) — plan ASCII (`parseWalledAscii`) + emplacements de
postes/équipage + arêtes de passerelle. Un scénario **pose des jetons-navires** (réf → type) ; le pont suit le
type. À l'abordage, le Pont est **cousu à la volée** depuis les `deck` des navires engagés.

> ✅ **Fondation posée** : le TYPE `ShipDeck`/`DeckPosteSlot` (PUR, `engine/types.ts`) + la facette `deck?`
> sur `VehicleData` ; lecture en tuiles/murs par `parseDeck` (`state/shipDeck.ts`, réutilise `parseWalledAscii`,
> aucun parseur parallèle) ; **deck de la cogue authoré** (pont 5×9 en planches, bastingage périmétrique, 3
> emplacements de postes proue/tribord/bâbord) ; tests `state/ship-deck.test.ts`. ⚠ RAW : les `deck.postes` sont
> des hints de RENDU (où dessiner pièce + servant), **pas** des slots fixes — le placement reste LIBRE (par bord +
> poids vs Contenance, cf. `shipPostes.ts`). ⏳ Reste : arêtes de passerelle + couture du Pont à l'abordage (Phase 8).

### Améliorations (MDG ch.12) — modifient PHYSIQUEMENT le navire et son pont

Distinction RAW (`ch.12 l.81,169`) : **Traits** (construction, fixes) vs **Améliorations** (ajout/retrait). Un
navire-instance = **type + améliorations** (comme un `ItemInstance` + qualités). Le **pont effectif** = gabarit
de base **+ résolveur d'améliorations** — même patron que le rig et `applyOps` : **Sabord** → poste `sabord`
(couvert total `ch.12 l.356`) ; **Bélier** → proue (+ `resolveCollision`) ; **Nid-de-pie** → poste de Vigie ;
**Clinfoc** → +10 % de longueur ; **Blindage** → PA de coque ; **Lissage** → M +1. **Mécanique = RAW** (couvert,
PA, longueur, Perception) ; **placement sur le pont = authoré** (couche rig, comme l'apparence d'une mutation).
Accroches existantes : `ship.traits`/`hull.traits`, `ShipPoste.sabord`.

> ✅ **DATA-DRIVEN** : Traits & Améliorations sont un CATALOGUE éditable au Codex — `src/data/naval-traits.json`
> (`id`, `label`, `kind` trait/amélioration, `source`, **`desc` verbatim** + champs d'effet `hullAP`/`moveBonus`/
> `maneuverDR`/`ramIC`/`ramAP`/`deckCover`). `engine/navalTraits.ts` ne fait que LIRE ce catalogue (`findNavalTrait`
> + `navalEffectSum`/`hullArmourBonus`/`belierRam`) — **aucune valeur d'effet codée en dur**. Modifier un effet
> ou une description = éditer le JSON, sans toucher au code. Anti-double-compte : Renforcé/Solide n'ont PAS de
> champ d'effet runtime (déjà bakés dans E/B des navires nommés) — `desc` seule.

> ✅ **Premiers effets mécanisés** (`engine/navalTraits.ts`, lecture des libellés VERBATIM via `navalTraitLevel`/
> `shipHasNavalTrait`) — on ne mécanise que les effets ABSENTS des colonnes du type (anti-double-compte : E/B
> sont déjà finaux ; Man et « Peu maniable » sont des **colonnes DISTINCTES** de la table → se cumulent) :
> **Bélier** dans `resolveCollision` (`l.221` : éperonnage de proue → +5 IC à la victime + 5 PA frontaux au
> Bélier ; collision frontale → la proue de la victime profite aussi de SON Bélier) ; **Sabord** dans
> `effectiveDeckPostes` (`l.362-364` : une coque à Sabord couvre TOUS ses emplacements → couvert total au
> servant) ; **Peu maniable (Indice)** dans `maneuverShip` (`l.173` : −1 DR/niveau sur le Test de Voile/Ramer,
> via l'`extraDR` de `resolveShipManeuver`, cumulé au Man). Tests `engine/naval-traits.test.ts` +
> `state/ship-maneuver.test.ts`.
>
> ✅ **Améliorations d'INSTANCE** (`Combatant.upgrades` / `SceneEntity.upgrades`, réfs par id `NavalTraitRef =
> { id, value? }`, JAMAIS un libellé — l'Indice vit dans `value`) — un navire-instance = type + `upgrades[]`,
> copiées au spawn (`spawn.ts`, point d'injection `combatSlice.ts`). La liste navale effective = `ship.traits`
> (TYPE) + `upgrades` (INSTANCE), lue par `navalTraits.ts`. **Effet = `GameOp[]`** (`passive` du catalogue,
> langue unique : Blindage→`ap`, Lissage→`moveMod`, Peu maniable→`skillDRBonus`) ; `ram`/`deckCover` restent en
> champ de domaine (sous-systèmes navire). Branchées :
> **Blindage** (`l.234/236` : bronze 1 PA / fer 2 PA → `armour.corps` au spawn, mitigé par les dégâts navals
> existants) ; **Lissage** (`l.293` : M +1 → `+1` au Mouvement de manœuvre). Tests `state/ship-upgrades.test.ts`.
> ⏳ Reste : Clinfoc (longueur), Nid-de-pie (Perception), Figure de proue (Moral si 2 Atouts *Raffiné*),
> Robuste (+2 DR Affaler les voiles), Propulsion à vapeur ; catalogue DATA éditable au Codex (desc verbatim) ;
> authoring `upgrades` dans l'éditeur de scène.

## 2. Pièce SERVIE = concept GÉNÉRAL (sol + navire) ; le poste naval en est un cas

Une arme de siège (Arme d'équipe) se sert **aussi au sol**, pas seulement sur un bateau (RAW : « Sur le champ
de bataille… lors des sièges » `ch.12 l.391` ; AA / *Up in Arms*). On modélise donc le **concept général
d'abord** — le naval n'en est qu'une spécialisation. Trois cas, par richesse croissante :

1. **Arme de siège = arme à distance ÉQUIPÉE d'un héros** (déjà livré, commit `de595ce8`) — un seul porteur,
   tire/recharge par le chemin d'arme normal. **INCHANGÉ** (un héros pose un pierrier au sol et tire).
2. **Pièce SERVIE emplacée** (général, sol OU navire) — `CrewedWeapon` ci-dessous : équipage assigné,
   « servir la pièce » comme attaque, support = un **emplacement au sol** (affût/pivot, cap propre).
3. **Poste naval** = une `CrewedWeapon` dont le SUPPORT est une **coque** (cap = celui du navire → l'arc se
   re-mappe quand le navire vire).

❌ **Faux propriétaire (rejeté)** : « la pièce est l'arme perso d'UN servant ». Une pièce SERVIE appartient à
son **SUPPORT** (la coque, ou l'affût au sol), **pas au servant** — sinon elle meurt avec lui et n'est pas
**re-servable**, or l'*Arme d'équipe* exige plusieurs servants interchangeables (« compenser les pertes ») et
le Critique **« Canon perdu/détaché »** (`ch.13 l.760-766`) l'arrache au navire, pas au tireur.

```ts
// GÉNÉRAL — une pièce d'artillerie SERVIE (sol + navire)
CrewedWeapon = {
  item: ItemInstance        // base + qualités/enchants par instance (Indice de `arme-d-equipe` = équipage REQUIS — LU, pas redéclaré)
  crewIds: string[]         // équipage ASSIGNÉ ; [0] = chef de pièce (nominé pour le Test de Projectiles)
  arc?: { side: FireArc }   // secteur de tir relatif au CAP du support (ABSENT = 360° / pivot libre — fréquent au sol)
  sabord?: boolean          // couvert TOTAL aux servants (Sabord naval ; au sol : gabion/muret équivalent)
}
// Le SUPPORT fournit (position, cap) : NAVAL = la Coque (cap = facing[hullId], re-mappé au virage) ;
// SOL = un emplacement/affût (cap propre, fixe ou pivotable). « Poste naval » = CrewedWeapon montée sur coque.
```

L'**Étape 1 déjà commitée reste valable** (`mountSide` sur `Weapon`/`ItemInstance`, propagation
`recomputeLoadout`) : quand un servant sert une pièce, on construit l'arme transitoire portant son `mountSide`
(= `arc.side`). Ce qui **change** vs mon esquisse : la pièce vit sur le **support** (coque ou affût), pas
l'inventaire du servant ; le tir passe par une attaque **« servir la pièce »** (source d'`availableAttacks`),
pas par l'arme équipée du héros. Le cas 1 (héros qui tire un pierrier au sol) **continue** de marcher tel quel.

## 3. Arme d'équipe — plusieurs servants (MDG ch.12 l.440-464)

Une pièce *Arme d'équipe (Indice)* « ne fonctionne bien que gérée par une équipe » de 2/3/4 ; les membres
**nomment l'un d'eux** pour le Test de Projectiles (le chef de pièce). La qualité existe déjà
(`qualities.json` → `arme-d-equipe`, `capabilities.crewedTeam`). **Ce sous-système (équipage requis,
sous-effectif, Soutien à la recharge) est GÉNÉRAL** : il sert les **sièges au sol** (AA) autant que le naval.

- **Sous-effectif** (table l.448-458, CUMULATIF) selon (équipage présent vs Indice) :
  recharge **doublée** → Défaut **Imprécise** → Défaut **Dangereuse**. Un Défaut déjà présent qu'on re-reçoit
  → **−10** de plus aux Tests de Projectiles (l.460).
- **Recharge = effort d'équipage** : « l'un des membres peut apporter son **Soutien** sur tous les Tests de
  recharge » (l.462) → on branche la primitive de **Soutien LDB** (`assistBonus`/`partyAssisted`, déjà au
  moteur) sur le **Test étendu de recharge existant** (`FLOWS.reload`, `pendingReload`). Plusieurs servants
  dépensent donc des Actions pour accélérer la recharge.
- **Incident de tir** (*Dangereuse*) → **tous les servants** sont affectés (l.464).

→ Conséquence de modèle : un poste expose `requiredCrew` (= Indice) et `crewIds` (assignés) ; une fonction PURE
`crewedPenalty(present, indice)` (engine) calcule la dégradation (recharge ×2 / Imprécise / Dangereuse). Les
servants au-delà de l'Indice **n'améliorent pas** le tir mais **compensent les pertes**.

## 4. Tir d'un poste — l'arc & la portée sont INTRINSÈQUES à `availableAttacks`

Pour un membre d'équipage, `availableAttacks` inclut **les postes de son navire qu'il sert**, déjà **filtrés
par arc + portée** :

- arc : `inFireArc(arc.side, capDuSupport, posSupport, posCible)` — le **SUPPORT** résout (cap, pos) : naval =
  la coque dont les `crewIds` contiennent le servant (cap = `facing[hullId]`, résolution **support-depuis-servant**) ;
  sol = l'affût/pivot (cap propre). Pas d'`arc` → **360°** (pivot libre). `inFireArc` est déjà général (il
  prend N'IMPORTE quel cap) → aucune logique naval-only ;
- portée : bandes existantes (`rangeBandModifier`) ; LdV : `losClear`.

Ainsi **réticule, clic et IA** lisent tous la même liste → l'arc n'est **branché qu'à UN endroit** (la
construction d'`availableAttacks`), pas en garde `mountedArcBlocks` triplée. Le jet = la CT/Projectiles du chef
de pièce + les stats de l'arme du poste + `crewedPenalty`. **Sabord** → couvert total aux servants *en défense*
(quand l'ennemi leur tire dessus), via le `coverModifier` existant.

## 5. Comment tout COMPOSE (déverrouillé par « postes sur la coque »)

| Dalle | Mécanique | Pourquoi ça tombe juste avec ce modèle |
|---|---|---|
| **D3b** Manœuvre & cap | Test de Manœuvre (`resolveShipManeuver`, fait) change le `Dir8` du navire | Tourner le cap re-mappe TOUS les arcs des postes d'un coup → « aligner sa bordée » |
| **D3c** Postes | `hull.postes` + servir-un-poste + `placementPenalty` (fait) | Poids/côté vs Contenance → −M/Man/DR ; l'arc filtre l'attaque |
| **D3e** Tir de batterie (ch.14 l.126-130) | **un** Test d'équipage (`resolveCrewTestByRoles 'batterie'`, Artilleur essentiel, fait) → DR appliqué à **tous les postes** d'une bordée (même `side`, en arc+portée) | Naturel : les postes sont au **niveau navire**, donc adressables en GROUPE |
| **D3f** Éperonnage (fait) | `resolveCollision` ; coups → Coque | Indépendant des postes |
| **D3g** Abordage + distribution | Verrou des coques (`engage`) + traversée (`pathTo`) + mêlée ; assigner l'équipage aux postes/rôles | « Répartir aux postes » = éditer `poste.crewIds` ; re-servir une pièce après pertes |
| Critiques navire | « Canon perdu/détaché » opèrent sur `hull.postes` | La pièce est à la coque, pas au servant |

## 6. Authoring (rien en dur)

Sur l'entité navire (Inspector quand un Combattant-coque est sélectionné) : liste `postes[]` éditable —
arme via `RefField{ds:'trappings'}` (liste catalogue + custom Codex), `side` via picker `FireArc`, `sabord`
booléen, `crewIds` par sélection des Combattants d'équipage. `requiredCrew` est **dérivé** (Indice de la
qualité), pas saisi. Aucun champ JSON brut (garde `no-json-fields`). Le navire + ses postes restent éditables
dans l'éditeur, jouables via le menu 🧪.

## 7. Découpage d'exécution révisé (ce modèle)

État au fil de l'eau (✅ fait · ⏳ à faire) :

1. ✅ **Poste sur un SUPPORT** : le spawn pose les pièces sur la coque (`hull.postes` → `applyShipPostes`) ;
   le cas héros-équipé `de595ce8` reste intact.
2. ✅ **`crewedPenalty(present, indice)`** (engine, pur, TDD).
3. ✅ **Servir un poste** : `availableAttacks` expose « Servir <arme> » (`weaponUid` ÉPINGLÉ, le servant garde
   son arme de mêlée), arc+portée intrinsèques ; `firedAttackBlock` honore le `weaponUid` (réticule/clic/IA,
   symétrie avec `firedWeapon`). Scénario 25 sans triche (pierriers = postes de la barge amie).
4. ⏳ **Recharge d'équipage** : brancher `assistBonus`/Soutien sur `FLOWS.reload`.
5. ⏳ **Batterie** (D3e) : action navire → `resolveCrewTestByRoles('batterie')` → DR sur tous les postes d'une bordée.
6. ⏳ **Manœuvre** (D3b) : `maneuverShip` → vire le `Dir8` (Phase 2b) **et avance la coque + l'équipage à bord**
   le long du cap (`shipAdvance`, Phase 2c, MDG ch.13 l.66-75 — déplacement INCONDITIONNEL, M÷2 plancher ; seul
   le virage dépend de la réussite) ; re-mappe les arcs. ⏳ Reste (UI = navigateur) : **modale `RollFlowShell`** du
   Test + **commande HUD « Manœuvrer »** + **init du cap au spawn** (`facing` depuis l'entité authorée) pour que
   l'arc soit réel en jeu.
7. ⏳ **Fondation bateau-prefab + Améliorations** (§1bis) : ✅ facette `deck` sur `VehicleData` (TYPE pur +
   `parseDeck` + deck de la cogue authoré + tests) ; ✅ premiers effets de Traits/Améliorations (`navalTraits.ts` :
   **Bélier**→`resolveCollision`, **Sabord**→`effectiveDeckPostes`) ; ⏳ reste des améliorations (Blindage/Lissage/
   Clinfoc/Nid-de-pie/Figure de proue/Vapeur) + catalogue DATA éditable au Codex + `upgrades[]` par instance.
8. ⏳ **Composition du Pont + abordage** (collision → `engage` → coudre les ponts). **Critiques canon** :
   ✅ « Canon perdu » (`ch.13 l.765`) mécanisé — l'op `removeShipPoste` (`engine/ops.ts`) retire un poste de
   `hull.postes`, appliquée via `applyHullCritical` (`engine/shipCritical.ts`) ; ✅ « Canon détaché »
   (`l.763-764`) mécanisé — `applyCrewHit` (même fichier, `crewTarget:'poste'`) : l'équipage du poste teste
   l'Athlétisme Intermédiaire (+0) sous peine de 12 Dégâts (le canon reste à bord).
9. ⏳ **Scène Mer + dispatch de tour à vue commutée** (navire acteur d'initiative ; vue Mer⇄Pont selon l'acteur).

Recette navigateur à chaque étape jouable (`__wfrp`, combat manuel) : servir un poste → aligner une bordée →
batterie → éperonner → aborder ; 0 erreur console ; scénario 🧪 dédié `combat-naval` (`src/scenes/test-scenarios/combat-naval.ts`).
