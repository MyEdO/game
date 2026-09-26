# Charte UI — référence vivante

> À lire avant de créer ou retoucher un écran (CSS, densité, responsive). Complète la règle
> stricte 4 du `CLAUDE.md` (responsive, breakpoints canon) et `docs/primitives.md`.

## L'anatomie d'un écran (#371)

Gabarit canonique de tout écran plein-champ — cite CETTE recette avant d'assembler un écran neuf,
ne pas la réinventer par fichier :

1. **`ScreenShell`** (`src/ui/ScreenShell.tsx`) — voile + en-tête (titre/méta date-bourse/actions/
   fermeture), a11y de dialogue câblée. Choisir la prop `body` dès la création : `'centered'` pour
   un écran de PANNEAUX (marché, dossier, hub — corps borné/centré `.screen-body`, ~960px, sinon le
   contenu colle à gauche avec un océan vide à droite en large) ; `'full'` pour un écran-canevas
   (carte, plan) qui doit remplir tout le cadre.
2. **Bande d'ambiance** — slot `backdrop` de `ScreenShell` (id du registre `src/ui/backdrops`),
   rendue sous l'en-tête/barre d'outils, au-dessus du corps ; repli élégant géré par `SceneBackdrop`
   (jamais un trou, même id absent/inconnu).
3. **`SpeakerBanner`** si l'écran porte un interlocuteur (aubergiste, marchand) — juste sous la bande
   d'ambiance, avant le contenu.
4. **Contenu** en primitives composées : `.panel`/`.panel-grid`, `MasterDetail` (liste+détail),
   tables (`.port-table`…) — jamais une liste/section maison recodée (cf. « Couche atomique » et
   `docs/primitives.md`).
5. **Pied d'action** — `.bar`/`.modal-actions` selon le contexte (barre d'écran vs modale imbriquée).

**Anti-patrons** : un écran nu sur fond noir (zéro `.panel`, zéro ambiance — famille « vide non
habité » du juge, #371) ; un centrage/bornage codé à la main par écran (traitement manuel ex-
`.city-hub-master`, remplacé par `body='centered'` de `ScreenShell`) au lieu de la prop partagée.

## Architecture CSS

- **Couleurs UNIQUEMENT dans les tokens `:root`** (`src/ui/styles/base.css`) — jamais de hex en
  dur dans une classe. Palette : `--bg`, `--accent`/`--accent2` (rouge sang, action primaire),
  `--gold`/`--gold2` (bordures/focus/accents dorés), `--ok`/`--ok-bright` (succès),
  `--danger`/`--danger-soft` (alerte), `--copper`/`--silver` (monnaie). Changer la palette =
  éditer `:root` seul. Seules exceptions tolérées : `rgba(0,0,0/255,255,255,…)` génériques
  (ombres/voiles). **Réflexe : à chaque couleur écrite, utiliser ou créer un token.**
- **Pas de monolithe CSS.** `src/ui/styles.css` est un orchestrateur d'`@import` ; le style vit
  dans des modules sous `src/ui/styles/` — couche PARTAGÉE : `base`, `components`, `tabs`
  (variantes de la primitive `Tabs`), `gauges` (jauges partagées) ; modules de DOMAINE : `creator`,
  `combat-ui`, `combat-modals`, `sheet`, `merchant`, `hud`, `world-meta`, `editor`, `compendium`,
  `codex-edit`, `house-rules`, `mass-battle`, `ornaments`, `tavern`.
- **Nouveau style : le réflexe est la couche PARTAGÉE, jamais la classe locale par défaut**
  (doctrine utilisateur 2026-07-12 : « classe mono-écran = excuse à la dérive » ; « si on ne sait
  pas faire, on ajoute de nouveaux génériques — on en a déjà pas mal, j'en doute »). Ordre :
  (1) composer une classe du catalogue ci-dessous ; (2) motif inexprimable → l'ajouter en
  GÉNÉRIQUE paramétrable à la couche partagée (cas attendu RARE) ; (3) une classe de domaine ne
  se crée que pour du vraiment spécifique (géométrie d'un canevas, skin d'un écran unique) et se
  justifie. Cliquets CI : (x) boutons nus, (xii) stock de classes par module de domaine —
  baselines gelées, décroissantes.
- **Primitives canoniques** (`src/ui/styles/components.css`) — **composer, ne pas recréer une
  surface ad-hoc** : `.panel` (surface ; variantes `.sunken`/`.gold`/`.flush`), `.fold` (section
  repliable `<details>`), `.field` (champ libellé-au-dessus), `.stat-chip` (cartouche
  label+valeur), `.listrow` (rangée nom+méta+action), `.chip`/`.count` (badges), `.stack`/
  `.row-flex`. Idem pour le cadre `<Modal>` partagé (jamais de `.modal-overlay`+`.modal`+
  `useModalA11y` recopiés à la main) et les layouts responsive `.layout-sidebar`/`.panel-grid`/
  `.bar` (règle stricte 4). **Avant d'écrire du CSS : chercher la primitive qui existe déjà.**
  Afficher une valeur avec son LABEL, jamais un format cryptique (« Destin 4·4 » → 4 cartouches
  nommés Destin/Chance/Résilience/Détermination).
- **Le contenu VARIABLE (États, longueurs de noms) ne décale JAMAIS les colonnes d'une liste.** Une
  liste de rangées-personnages est une GRILLE à colonnes fixes (portrait | identité+États | contenu |
  valeur) ; la zone des chips d'États est une **cellule à empreinte STABLE, réservée dans la primitive**
  (`StateChips reserve` / `PortraitTile reserveStates`, `src/ui/StateChips.tsx`) — rendue vide sans État,
  les chips s'empilent DEDANS. Un héros porteur d'un État ne pousse plus la rangée voisine (arbitrage
  user 2026-07-11). Idem : les fills/strokes SVG viennent des tokens `var(--…)`, jamais d'un hex/rgb en
  dur dans le JSX (cliquet `src/ui/ui-ratchets.test.ts` (viii) — sinon « texte noir sur noir » quand la
  surface change de fond).

## Couche atomique — catalogue

Classes CSS **canoniques** réellement définies dans `src/ui/styles/components.css` / `base.css`
(+ `.seg` en `sheet.css`, composé par la primitive React `OptionChooser`). Ne couvre que le
PARTAGÉ (utilisé par ≥2 domaines) — pas les classes propres à un seul écran (`.voyage-*`,
`.city-hub-*`, `.party-*`, `.char-card*`…). Pour la couche **React** (composants, pas classes),
voir `docs/primitives.md` — les deux se lisent ensemble : une
primitive React pose souvent ces classes pour toi (ex. `RollShell` pose `.modal`/`.modal-actions`).

### Actions

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.btn` | Bouton de base (fond charbon, bordure) | Tout `<button>` porte `.btn` ou `.chip` ou est rendu par une primitive (`ChoiceButtons`…) — un bouton nu hérite le noir UA (`buttontext`), illisible sur fond sombre (vécu #358bis/#373). |
| `.btn.small` | Variante compacte (padding/police réduits) | Barres d'actions denses, rangées de liste. |
| `.btn-primary` | Action primaire (dégradé rouge sang) | Une seule par barre d'actions/modale — jamais deux primaires côte à côte. |
| `.btn-ghost` | Action discrète (transparent, texte atténué) | Annuler/Subir dans `.modal-actions` (ancré à gauche automatiquement) ; pas pour une action engageante. |
| `.btn-test` | Bouton d'outil de test/QA (bordure pointillée verte) | Réservé aux écrans Atelier/dev — jamais un écran joueur. |
| `.btn.danger` | Variante destructive (bordure rouge alerte) | Suppression/abandon irréversible ; combiner avec `.btn-primary` si c'est l'action principale de l'écran. |
| `.btn.btn-resource` | Petit bouton normé de ressource (Chance/Pacte/Résilience/Détermination) | Toujours DANS `.rm-influence` (`InfluenceRow`), jamais isolé. |
| `.btn.btn-nu` | Variante NUE : le contrôle n'apporte AUCUNE boîte (padding, hauteur mini, rayon, ombre annulés) | Posée par la primitive `GatedAction` (prop `bare`) quand l'hôte porte DÉJÀ sa géométrie (pastille d'État de la console, alvéole) — jamais une neutralisation de `.btn` recodée depuis le conteneur d'un écran. |
| `.btn.btn-tactile` | Variante TACTILE : cible ≥ 40 px (canon « RESPONSIVE » de `base.css`) tenue à TOUT pointeur, contenu en ligne (icône + libellé + coût) | Posée par la primitive `GatedAction` (prop `tactile`) pour un contrôle posé DANS le monde (pastille d'entité du champ, `src/gameIso/stage/PastilleEntite.tsx`), où aucune densité de panneau ne garantit la cible — jamais un `min-height` recopié depuis la feuille d'un écran. |
| `.chip` | Badge/pastille compacte (fond `--bg2`, texte atténué) | Alias moderne de `.tag` (historique, encore présent) ; toute nouvelle pastille utilise `.chip`. |
| `button.chip` (+ `[aria-pressed='true']`) | Chip-INTERRUPTEUR (bascule booléenne) — état pressé = pastille dorée élue | `<button className="chip" aria-pressed={on}>` ; remplace toute case à cocher native collée à son libellé (correctif créateur Carrière, 2026-07-14) — `aria-pressed` sur un simple bouton, jamais un rôle composite (garde ARIA muette). |
| `.chip.tone-warn` / `.chip.tone-danger` / `.chip.tone-ok` | Variantes de TON du chip (or / rouge alerte / vert bénéfique) | Bande d'alarmes de la colonne moniteur (#492) — un chip qui SIGNALE (pas un badge neutre) prend le ton de sa gravité ; composer, jamais un `style={{color}}` inline. `.tone-ok` = buff de sort (registre État, #492 tableau de bord). |
| `.count` | Pastille numérique (compteur) | À l'intérieur d'un `.chip`/`.tab-btn`, jamais seule dans le flux de texte. |
| `.rm-note` | Note secondaire d'une modale de jet (acte de soin en cours, cadence d'un Test étendu, opposition annulée) | Rangée flex à alignement HAUT : accepte une icône + une `<Prose>` de bloc (dont les paragraphes perdent leur marge propre). Partagée par 6 modales — jamais redéfinie dans un module de domaine. |
| `.rm-stake` | Zone Z3b — l'ENJEU d'un jet et le renvoi vers sa règle | Classe PROPRIÉTAIRE de la zone, écrite par la SEULE primitive `StakeNote` (`src/ui/StakeNote.tsx`, composée par la prop `stake` de `RollShell`). Ton NEUTRE (liseré, pas de fond d'alerte) : un enjeu ANNONCE — la menace SUBIE reste à `.rm-threat`. Icône flottante, prose de bloc sans marges propres. |
| `.entity-chip` (+ `.entity-badge`, `.entity-choice`) | Chip d'ENTITÉ unifié (compétence/talent/sort/objet) avec déclencheur popover CodexRef | Source unique = `EntityChip.tsx` — remplace `.tag`/`.codex-chip` pour toute entité de règle ; ne pas recréer un badge ad hoc pour un nom de sort/talent. Un « A ou B » se rend en chips INDIVIDUELLES cliquables séparées d'un `ou` (`EntityChoice`, `src/ui/EntityChip.tsx:50-56`), jamais en une chaîne fusionnée non cliquable — un talent tiré au hasard porte la même affordance codex. |
| `.tag` (+ `.tag.talent`) | Badge historique (alias de `.chip`) | Ne pas en créer de nouveaux usages — préférer `.chip` ou `.entity-chip` selon le contenu (texte libre vs entité de règle). |
| `.gated-action` (+ `.gated-action-reason`, variante `.gated-action.dense`) | Action GATÉE : bouton d'engagement dont la RAISON d'indisponibilité se lit au SURVOL/FOCUS (voir « Raison d'un refus » ci-dessous), sa copie hors écran (`.hors-ecran`) servant l'`aria-describedby` ; `.gated-action-reason` = la même raison RENDUE EN CLAIR, par l'opt-in `raisonInline` (attente d'un invité en coop, diagnostic d'authoring, activité refusée) ; `dense` = graduation réduite pour une COLONNE étroite (pied de la frise d'initiative) | Composée par la primitive `GatedAction` (`src/ui/GatedAction.tsx`, CLAUDE.md) — tout bouton principal désactivé pour un motif intelligible (hub de ville « Entrer », écran d'équipe « Commencer ») la COMPOSE au lieu d'un `<button disabled title=…>` muet ; la densité se demande par la prop, jamais en redéfinition de `.btn` chez l'appelant. |
| `.hors-ecran` | Texte destiné au SEUL lecteur d'écran (nom d'un emplacement vide, raison d'un refus) : hors flux, clippé, JAMAIS `display:none` — l'arbre a11y le perdrait | Définition UNIQUE dans `src/ui/styles/base.css` — aucune recopie du clip par module de domaine. |

### Conteneurs / surfaces

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.panel` | Surface de base (carte/cadre, fond `--panel`, bordure, radius 12px) | Toute carte de contenu — jamais un `<div>` avec fond/bordure recopiés à la main. |
| `.panel.sunken` | Variante « creuse » (fond `--bg2`, plus sombre que la surface) | Zone en retrait dans un panel (ex. sous-section). |
| `.panel.gold` | Variante liseré or (bordure haute épaisse `--gold`) | Marque un panel « mis en avant » (résultat, section clé). |
| `.panel.flush` | Variante sans padding | Le panel contient déjà un composant qui gère son propre espacement (ex. `MasterDetail`, image pleine largeur). |
| `.main-head` + onglets internes (`TabbedEntry`) | Fiche d'entité RICHE : en-tête (figurine + titre + accroche) puis onglets qui répartissent le contenu | Coquille UNIQUE `src/ui/TabbedEntry.tsx` (`EntryTab[]`, onglet actif mémorisé par id STABLE, barre masquée si ≤ 1 onglet) — jamais un état d'onglet local doublé d'un `main-head` manuscrit ; le contenu d'une fiche de race se PROJETTE depuis `src/ui/compendium/registry.ts` (`raceFicheTabs`, l.554), consommé par le Codex ET le créateur, jamais réimplémenté par écran. |
| `.fold` (+ `.fold-title`, `.fold-body`) | Section repliable (`<details>`) | `<details class=fold><summary><span class=fold-title>…</span></summary><div class=fold-body>…</div></details>` — toute section optionnelle/secondaire dépliable. |
| `.parchment-card` (+ `.parchment-seal`, `.parchment-seal-roll`, `.parchment-seal-label`, `.parchment-card-body`, `.parchment-card-title`, tons `.ok`/`.bad`) | Carte-parchemin narrative : texture `.tx-parchment` + sceau de cire optionnel (tirage d100) + titre en font-display | Composée par la primitive `ParchmentCard` (`src/ui/ParchmentCard.tsx`, CLAUDE.md) — tout récit ponctuel adossé à un tirage (événement d'interlude, événement de bord en mer, révélation de scène) plutôt qu'un `.tx-parchment` recodé à la main. |
| `.stat-chip` (+ `.sc-label`, `.sc-value`) | Cartouche « label + valeur » (PV, carac, ressource) | Afficher une valeur nommée — jamais un format cryptique (« 4·4 » sans libellé, cf. règle charte ci-dessus). |
| `.listrow` (+ `.lr-name`) | Rangée de liste : nom (flex:1) + méta + action | Toute liste d'entités cliquables/actionnables (inventaire, roster…) plutôt qu'un `<li>` stylé à la main. |
| `.stack` | Empilement vertical (flex column, gap 8px) | Toute pile de blocs verticale simple — pas de `display:flex;flex-direction:column` recopié. |
| `.row-flex` | Rangée horizontale qui s'enroule (flex-wrap) | Toute rangée d'éléments qui doit passer à la ligne sur petit écran plutôt qu'un `overflow` caché. |
| `.wounds-badge` / `.char-value` (+ tailles `.char-value-sm`/`.char-value-md`/`.char-value-lg`) / `.game-date` / `.fx-chip-label` | Composants de donnée unifiés (LOT 5) — respectivement PB/carac+avancées/date de jeu/étiquette d'effet | Rendus par leurs composants (`WoundsBadge`, `CharValue`, `GameDate`, `FxChip`) — ne pas reformater ces données à la main ailleurs ; `CharValue` prend l'échelle NOMMÉE (`size`, défaut `sm`, #418) au lieu d'hériter du contexte. |
| `.swatch` | Pastille/bande peinte à une couleur de DONNÉE (style inline), forme réglée par variables au contexte (`--swatch-display`/`--swatch-w`/`--swatch-h`/`--swatch-gap`/`--swatch-border`/`--swatch-radius`) | Toute couleur MONTRÉE (rangée `couleur` d'une fiche du Codex, bande de jeton de la galerie) — DÉCORATIVE (`aria-hidden`), le hex ou le nom du jeton restant écrit à côté ; jamais un carré peint recodé par écran. |
| `.icon` | Cadrage de l'icône SVG maison | Posée par la primitive `<Icon>` (`src/ui/Icon.tsx`) — cale l'icône sur la ligne de base du texte adjacent ; jamais un `<svg>` brut à côté de texte. |
| `.charprev` (+ `.charprev-svg`, tailles `.charprev-xs`/`.charprev-sm`/`.charprev-md`/`.charprev-lg`, `.charprev-fill`, ambiances `.charprev-amb-panel`/`.charprev-amb-parchment`/`.charprev-amb-spotlight`) | Cadre d'aperçu « perso en pied » (`CharacterPreview`) | Toute vignette de personnage EN PIED — les tailles/ambiances sont des modificateurs, jamais un `<img>`/SVG dimensionné à la main. |
| `.activity-pane` (+ `.activity-pane-head`, `.activity-pane-body`, `.activity-pane-desc`, `.activity-pane-blocked`, `.activity-pane-foot`, `.activity-pane-terms`, `.activity-pane-detail`, `.activity-pane-actions`) | Panneau d'Activité/Service : en-tête (icône + titre), corps DÉFILABLE, pied FIXE (pré-jet + coût `<Coins>` + action jamais cachés par le scroll) | Composé par la primitive `ActivityPane` (`src/ui/ActivityPane.tsx`, CLAUDE.md) — tout volet d'Activité (interlude) ou détail de service (hub de ville) la COMPOSE au lieu d'un markup en-tête/corps/pied recodé à la main. |
| `.sans-webgl` (+ variante `.sans-webgl.compact`) | Message « le monde ne peut pas être affiché » : ce que le joueur voit quand la machine refuse le contexte WebGL 2, le monde volumique étant le seul peintre du jeu (#1176 C5a) | Posé par la primitive `SansWebgl` (`src/gameIso/stage/SansWebgl.tsx`) sur `.panel` — tout hôte de monde (stage de jeu, plan de station) le monte À LA PLACE de son canevas ; `compact` = posé DANS un panneau borné. Jamais un écran nu et muet, jamais un second peintre de secours. |
| `.plaque-nom` | Boîte du NOM d'un utilisable révélé (Alt maintenu) ou survolé, posée au-dessus de lui dans le SVG du plateau (#1687) : centrage et ombrage de lisibilité sur le monde nu, jamais une cible (`pointer-events: none` de bout en bout) | Posée par la primitive `PlaquesDeNom` (`src/gameIso/stage/PlaquesDeNom.tsx`) autour de `CodexTitre` — le TEXTE reste celui du chrome de nom du Codex, une seule matière de nom à l'écran ; jamais un second peintre de nom, jamais une boîte qui mangerait une bande du champ au-dessus de chaque décor. |
| `.menu-card` (+ `.game-menu-overlay` menu système plein écran, `.game-menu-card`/`.game-menu-sub-wide`/`.menu-sub-head`/`.menu-sub-body`, `.menu-card-head`/`.menu-card-title`/`.menu-card-sub`/`.menu-card-meta`, `.menu-btn`, `.menu-toggle`, `.menu-buttons`) | Carte de menu : en-tête + sections de grands boutons pleine largeur (icône + libellé) séparées par un filet titré ; `.game-menu-overlay` = voile plein écran du menu système (pause) en jeu, ses sous-écrans Coopération/Options composant la même carte | Composée par la primitive `MenuCard`/`MenuSection`/`MenuButton`/`MenuToggle` (`src/ui/MenuCard.tsx`, CLAUDE.md) — le menu principal (`MainMenu`) ET le menu système plein écran en jeu (`GameMenu`) la COMPOSENT ; jamais un `.menu-card` recodé ni un `<button className="btn">` de menu à la main. |

### Atelier du scribe (#412)

Primitives SANS canon préexistant, ratifiant le kit HTML « Atelier du scribe » — tokens `--atelier-*`
(`base.css`, encres laiton/bois/cire, couche PARTAGÉE) ; le reste de la charte (boutons, onglets,
chips, panneaux, carte-parchemin) s'ALIGNE sur le canon déjà existant ci-dessus, jamais dupliqué.

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.metal-status` (+ `.metal-status-chip`/`.metal-status-plaque`, `.st-bronze`/`.st-argent`/`.st-or`) | Chip statut métallisé Bronze/Argent/Or + échelon | Composée par `MetalStatus` (`src/ui/MetalStatus.tsx`, CLAUDE.md) — dérivée de `parseStatus`, jamais un `switch` de couleur recodé. |
| `.wax-seal` / `.sealed-plaque` (+ `.sealed-plaque-seal`/`-title`/`-desc`, `.sel`) | Sceau de cire tête de mort (SVG) + plaque d'élu scellée | Composés par `WaxSeal`/`SealedPlaque` (`src/ui/WaxSeal.tsx`, CLAUDE.md) — tout médaillon de candidature/carrière élue. |
| `.char-stats` (+ tailles `.char-stats-sm`/`.char-stats-md`/`.char-stats-lg`, `.stat`, `.stat-label`, `.stat-val`) | Grille de plaques de caractéristique (CC, CT, F…) : libellé small-caps gravé + valeur en grand, cadre laiton discret | Composée par `CharStatsGrid` (`src/ui/CharStatsGrid.tsx`, CLAUDE.md) — SOURCE UNIQUE du markup, échelle NOMMÉE (`size`, défaut `sm`, #418, jetons `--stat-*`) au lieu d'une taille en dur ; `.codex-kv` (fiche Codex) converge sur les MÊMES jetons `--stat-label-sm`/`--stat-val-sm`. |
| `.cc-path` (+ `.cc-step`, `.cc-step-lv`/`-nm`, `.now`, `.cc-link`) | Chemin d'évolution de carrière en médaillons de niveau | Composé par `CareerPath` (`src/ui/CareerPath.tsx`, CLAUDE.md) depuis `levelsForCareer` (données réelles). |
| `.fig-tile` (+ `.fig-tile-name`/`-sub`, `.sel`) | Tuile-figurine compacte cliquable (compose `CharacterPreview`) | Composée par `FigTile` (`src/ui/FigTile.tsx`, CLAUDE.md) — brique de rangée d'une `GroupedPickGrid`. |
| `.gpg-grid` (+ `.gpg-heading`, `.gpg-row`, `.gpg-section`) | Grille de sélection en sections par famille/classe | Composée par `GroupedPickGrid` (`src/ui/GroupedPickGrid.tsx`, CLAUDE.md) — `role=listbox`/`option`, roving tabindex. Préfixe `gpg-` DÉLIBÉRÉ : nom distinct hérité de l'époque où `.pick-grid` était pris par `FacetedPickGrid` (créateur, MORT #393 P2 — Race puis Carrière ont migré vers `GroupedPickGrid`/`MasterDetail`, dernier consommateur parti). |
| `.detail-frame` (+ `.detail-frame-name`/`-meta`/`-prose`) | Cadre de détail de l'élue (nom + chips + rubriques + prose scrollable) | Composé par `DetailFrame` (`src/ui/DetailFrame.tsx`, CLAUDE.md) — aucun slot d'actions (« Suivant » fait déjà ça). |

### Cue de bord de rail scrollable (#535)

Convention (pas un composant : CSS pur, aucune classe ajoutée en JSX) — un rail long qui déborde
(`overflow-y: auto`) porte un voile dégradé HAUT/BAS collé au bord du viewport de scroll, pour
signaler visuellement qu'il y a plus de contenu au-delà du cadre. Sélecteur CANONIQUE (à chercher
en diagnostic navigateur, plutôt qu'un `:first-child` structurel opaque) :
`.creator-step > .master-detail-list::before` / `::after` (`src/ui/styles/creator.css`) — scopé au
créateur (ancêtre `.creator-step`), PAS universel sur tout `MasterDetail` (les autres consommateurs
— Compendium, pickers marchands — n'ont pas été jugés sur ce cue ; l'étendre est une décision de
goût séparée, pas un effet de bord de #535).

Mécanique : `position: sticky` (haut/bas) + `margin-bottom`/`margin-top` négatif égal à sa propre
`height` (annule sa contribution au flux flex, ne pousse aucun contenu), `pointer-events: none`
(purement indicatif). **Piège vécu (#535 recette)** : sans `flex-shrink: 0`, un rail flex-column
très en overflow (ex. étape Caractéristiques, ~1050px de contenu pour ~750px visibles) écrase le
pseudo à hauteur RÉELLE 0 avant de toucher les rangées voisines — un pseudo `content: ''` a un
plancher `min-height: auto` de 0 (rien à mesurer dedans), donc l'algorithme de rétrécissement flex
le sacrifie TOUJOURS en premier. `flex-shrink: 0` est donc une partie NON optionnelle du patron :
tout futur cue de bord posé sur un rail flex-column overflowing doit le porter.

**DYNAMIQUE** (verdict utilisateur #535 : « le gradient du haut disparaît quand le rail est tout en
haut, celui du bas quand on atteint le fond ») — un vrai indicateur « il reste du contenu », jamais
un décor statique. Attributs d'état CANONIQUES `data-at-top`/`data-at-bottom`, posés sur
`.master-detail-list` par `useScrollEdgeAttrs` (`src/ui/MasterDetail.tsx`, hook interne — UN SEUL
mécanisme de mesure pour TOUS les écrans `MasterDetail`, coût nul même sans cue consommateur) :
écoute `scroll` (rAF-throttlé) + `resize` fenêtre + `ResizeObserver` du rail (le CONTENU change de
hauteur sans `scroll` natif — ex. la cérémonie séquentielle de l'étape Caractéristiques), mesure
initiale au montage avant peinture (pas de flash). `[data-at-top]::before { opacity: 0 }` /
`[data-at-bottom]::after { opacity: 0 }` + `transition: opacity` sur le pseudo — **jamais** de
scroll-driven animation CSS pure (`animation-timeline`, support navigateur inégal) : la mesure de
bord reste en JS, seule la transition d'opacité est déclarative. Le RENDU du voile reste scopé
créateur (`.creator-step > .master-detail-list::before/::after`) — les attributs, eux, sont posés
par la primitive PARTAGÉE et disponibles à tout futur consommateur de `MasterDetail` qui voudrait
son propre cue (Compendium, pickers marchands…) sans reposer le mécanisme de mesure.

### Négoce (table marchande, #371 LOT 3)

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.cart-step` (+ `.btn-step`, `.cart-n`) | Stepper de quantité `[−][centre][+]` | Composé par la primitive `QtyStepper` (`src/ui/QtyStepper.tsx`, CLAUDE.md) — jamais une paire de `<button>` +/- recodée à la main. |
| `.btn-step` | Peau de bouton CARRÉ 24px (fond `--panel2`, coin 6px) | Le pas d'un `QtyStepper`, mais aussi tout bouton d'icône serré d'une rangée (✕ « Retirer » d'un panier) — réutiliser cette peau plutôt qu'en dériver une variante. |
| `.market-carrier` | Chip de PORTEUR (destinataire des achats) ancré à droite d'une `.screen-toolbar` | Marché terrestre (`LandMarketView`) : même graisse discrète que `.port-purse`, sémantique DISTINCTE (un porteur n'est pas la bourse) — ne jamais emprunter `.port-purse`, propriété de la primitive `ScreenMeta`. |
| `.trade-table` (+ `.trade-row`, états `.unaffordable`/`.open`) | Table de négoce (colonnes de stats + prix `<Coins>` + action par rangée, groupes de rubrique) | Composé par la primitive `TradeTable` (`src/ui/TradeTable.tsx`, CLAUDE.md) — tout écran de négoce (marchand, port, marché terrestre) la COMPOSE au lieu d'un tableau maison ; `.unaffordable` grise une rangée inabordable, `.open` marque sa fiche de détail dépliée. |

### Layouts responsive (règle stricte 4)

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.layout-sidebar` | Grille « colonne latérale (270px) + contenu » | Fiche vivante, inspecteurs — s'empile en 1 colonne ≤900px (breakpoint canon). |
| `.panel-grid` (+ `.span-2`) | Grille de `.panel` en auto-fit (min 340px) | Tableau de bord de plusieurs panels — 1 colonne ≤700px ; `.span-2` pour un panel pleine largeur. |
| `.bar` | Barre d'écran (en-tête, fond dégradé, filet or) | En-tête d'écran avec titre + actions — s'enroule ≤700px ; ne PAS la détourner pour une simple rangée sans fond/padding de header (charte : « éviter les espaces vides »). |
| `.screen` | Colonne plein-écran (flex column, hauteur 100%) | Coquille racine d'un écran plein-champ « historique » (hors `ScreenShell`, cf. table `docs/primitives.md`). |
| `.screen-body` | Corps de `ScreenShell` borné/centré (~960px) | Posée par `ScreenShell` (prop `body='centered'`) — écran de PANNEAUX/LECTURE (marché, dossier, hub) plutôt que canevas plein cadre ; jamais un centrage/bornage manuel recopié par écran. |
| `.screen-body-wide` | Modificateur de `.screen-body` — plafond relevé (~1400px) au-delà de 1440px | Posée par `ScreenShell` (prop `body='centered-wide'`, politique grand écran) — écran-GRILLE/catalogue (négoce en `TradeTable`/`.panel-grid`) plutôt que lecture ; toujours combinée à `.screen-body`, jamais seule. |
| `.master-detail` (+ `.master-detail-list`, `.master-detail-detail`) | Gabarit maître-détail (liste gauche + détail centre), LAYOUT pur | Composé par `MasterDetail.tsx` (CLAUDE.md) — s'empile ≤700px (`MASTER_DETAIL_STACK_BREAKPOINT_PX`), jamais une 2ᵉ composition liste+détail recodée. |
| `.tabs` (+ `.tab-btn`) | Style de base (variante `flat`) de la barre d'onglets | Posée par la primitive React `Tabs` (CLAUDE.md) — les variantes `pill`/`sub`/`dock` composent par-dessus dans `tabs.css` ; jamais un `role=tablist` recodé à la main. |
| `.seg` (`sheet.css`) | Segmented control (choix exclusif, boutons collés) | Composé par la primitive React `OptionChooser` (variante `seg`) — jamais un groupe de boutons exclusifs recodé à la main. |

### Formulaires

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.field` / `.ed-field` | Champ de formulaire, libellé AU-DESSUS du contrôle | Toute paire libellé+input/select/textarea — `.ed-field` = même primitive côté éditeur. |
| `.ed-hint` | Texte d'aide en italique sous un champ éditeur | Précision de saisie (contrainte, format attendu), jamais un texte tutoriel joueur (cf. règle « Zéro texte tutoriel »). |
| `.bg-edit` (+ `.bg-hint`) | Bloc de champs « background » (Motivation/Ambitions) | Primitive `BackgroundFields`, partagée créateur ⇄ fiche — champs en `div.field` (pas `label`) pour un rendu identique sur les deux surfaces. |

### Titres / texte

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.mini-title` | Titre de section en petites capitales dures (11px, `--muted`) | Réflexe par défaut pour titrer une rubrique dans un panel — pas de nouveau style de titre ad hoc. |
| `.section-label` | Annotation de section alternative (small-caps, plus discrète que `.mini-title`) | Variante ADDITIVE quand `.mini-title`/un `Hn` gothique seraient trop lourds — pas un remplacement systématique. |
| `.clue-refuted` | Contenu ÉCARTÉ (barré + atténué) mais qui reste LISIBLE — jamais retiré du DOM | Fausse piste d'un indice de carnet (`ClueState.statut === 'réfuté'`, #670) ; tout contenu qu'une règle 7 arbitre à consulter-mais-marqué-caduc. |
| `.clue-history` (+ `.clue-history-entry`) | Bloc de lectures ANTÉRIEURES, en retrait atténué | Progression par stades d'un indice de carnet (#670) — l'ancienne lecture reste visible sous la courante, jamais effacée. |
| `.dlg-history-reply` | Réplique du joueur, STATIQUE, préfixée d'un chevron doré (même idiome que `.dlg-choice`) | Relecture d'une conversation (`DialogueHistoryScreen`, #718) — la réponse choisie n'est plus un bouton, juste un texte marqué « c'est le joueur qui parle ». |

### Modales (cadre partagé)

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.modal-overlay` (+ variante `:has(.roll-modal)`) | Voile plein écran (`position:fixed inset:0`) | Cadre UNIQUE de toute modale — jamais un voile recopié à la main ; la variante `:has()` ancre les modales de jet en bas avec un voile plus léger. |
| `.modal` / `.modal.wide` | Boîte de la modale (surface, largeur plafonnée) | `.wide` (760px) pour un contenu riche (multi-colonnes) ; `.modal` seul (520px) sinon. |
| `.picker-modal` | Titre `<h3>` d'une modale de sélection | Modale de choix dans une liste (picker) — cohérent avec `.modal`. |
| `.modal-actions` | Barre d'actions de modale (max 2 boutons : ghost à gauche, primaire à droite) | JAMAIS de 3ᵉ bouton — les dépenses de ressources vivent dans `.rm-influence`, pas ici. |
| `.rm-influence` | Rangée « influencer le jet » (Chance/Pacte/Résilience/Détermination) | Vide → invisible (`:empty{display:none}`) ; composée par `InfluenceRow` (CLAUDE.md). |
| `.prow` | RANGÉE de jet (`RollRow`) — CONTENEUR | Porte le ferrage EXPLICITE de tous ses enfants (`text-align`) : sans lui chaque enfant hérite du `text-align` de la coquille hôte et la même rangée se lit différemment selon la modale. Tout ferrage/alignement de rangée se règle ICI, jamais élément par élément. |
| `.prow-act` | Zone d'ACTIONS d'une rangée de jet (`RollRow`) | Ordre visuel imposé par la primitive : choix de RÈGLE (Résilience/Résistance/Détermination) → offre de CONFORT (dé fixé) → CTA « Lancer ». Layout posé dans `combat-modals.css`, jamais hérité de l'ambiance de la coquille hôte. |
| `.rm-die-pick` | Bloc du sélecteur de dé (`ForcedRollPicker`) — options de dé + champ | Le champ COMPOSE `.field` (libellé au-dessus) et se dimensionne à son contenu (3 chiffres) ; sa matière se déclare AU CONTENEUR (`.rm-die-pick > label > input`), sans classe propre — jamais une cellule d'une grille de boutons (`.rm-loc-grid`) détournée. UNE surface par ÉTAT : l'étiquette dit « Fixer le dé » (offre, champ vide) puis « Dé fixé » (marque de provenance, valeur éditable). |
| `.prow-fixed-mark` | MARQUE de provenance « Dé fixé » d'une rangée SANS sélecteur (témoin, bilan, siège voisin) | Ne se rend PAS quand le sélecteur est présent : c'est alors SON étiquette qui porte la marque (jamais deux surfaces pour un seul fait). |

### Ligne de jet : la DIFFICULTÉ sur la ligne, les chips au CIRCONSTANCIEL (#1072)

Règle (directive utilisateur 2026-08-04, verbatim intégral au ticket #1072) : **la Difficulté d'un
jet s'affiche sur la LIGNE, en texte et en valeur** — c'est la nature du jet, pas un modificateur ;
**les chips (`.rm-mod`) sont réservées aux modificateurs circonstanciels** (Soutien, Avantage,
plafond mesuré, portée, États…).

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.rm-roll-diff` | Difficulté du Test à la suite du libellé de la ligne (« — Accessible (+20) »), annotation d'allègement comprise (« , allégée : Crochetage ») | Posée par le site de rendu UNIQUE `RollLine`/`PendingRollLine` depuis le champ `difficulty` de `RollBreakdown`/`PendingRoll` — jamais recomposée à la main dans une modale, et JAMAIS émise en `.rm-mod`. La valeur reste comprise dans le modificateur et la cible : seule la présentation change, aucune somme ne bouge. |

### Bandeau d'interlocuteur / bande d'ambiance

| Classe | Rôle | Quand l'utiliser / anti-patron |
|---|---|---|
| `.dialogue-box` (+ `.dlg-boniment`) | Surface du bandeau (portrait + nom + réplique) | Composée par la primitive `SpeakerBanner` (CLAUDE.md) — `.dialogue-box` seul flotte en overlay bas d'écran (variant `dialogue`) ; `.dlg-boniment` la remet dans le flux normal (variant statique marchand/aubergiste). Jamais recopiée à la main. |
| `.dlg-head` / `.dlg-portrait` / `.dlg-body` | Structure interne (portrait + colonne texte) | Posées par `SpeakerBanner` — le portrait se replie sur un fleuron `Ornaments` sans entité (boniment). |
| `.dlg-speaker` / `.dlg-text` | Nom de l'interlocuteur / réplique | Idem, posées par `SpeakerBanner`. |
| `.dlg-choices` (+ `.dlg-choice`, `.dlg-choice-text`, `.dlg-choice-cost`) | Zone de choix du dialogue arborescent | Variant `dialogue` seulement — le contenu des lignes reste au métier (`DialogueBox`), la primitive ne pose que le conteneur. |
| `.scene-backdrop` (+ `.scene-backdrop-fallback`) | Bande d'illustration d'ambiance (bord haut d'un panel) | Composée par la primitive `SceneBackdrop` (CLAUDE.md) — sans `backdropId`/id inconnu, repli dégradé + fleuron `Ornaments`, jamais un trou. |

## Contrat d'affichage d'un jet (Z0-Z15)

Doctrine (arbitrages utilisateur 2026-08-04, #1078) : **un seul schéma d'informations pour TOUS les
jets** — mono, opposé, multi, cascade, magie, soin, naval. Une spécificité de type de jet étend la
MÉCANIQUE (déclaration multi, table d100, dé fixé…), jamais le schéma affiché ; un écart est une
non-conformité à converger, pas une préférence d'écran. Chaque zone porte UNE information et une
seule, et a UN propriétaire — la primitive qui la rend. Réfs : #1064, #1072, #1078.

| Zone | Information portée (et elle seule) | Propriétaire | Règle |
|---|---|---|---|
| **Z0** Titre | le NOM de l'action, seul | `RollShell.title` | Jamais l'acteur, la compétence ni la difficulté : `rollTitle` rend l'`actionLabel` nu — un titre composé redouble Z1 (#352). |
| **Z1** Sous-titre | « Acteur — Action (Compétence) » + compteur `n/m` | `RollShell.subtitle` (`.rm-subtitle`, classe UNIQUE — la coquille de jet n'a plus de variante d'enveloppe) | Composé par `composeRollLabel` (source unique) ; en séquence, `stepSubtitle` est ramené à la POSITION seule (`n/m`) — le libellé d'étape et son renvoi de règle vivent au titre (`CascadeBody`), d'où le dédoublonnage contre Z0. Jamais la difficulté (#1072), jamais la progression (Z6), jamais un A→B textuel (Z3). |
| **Z2** Instruction | la consigne de GESTE pré-jet | `RollShell.instruction` | Un seul poseur, rôle documenté ; ni rappel de règle, ni issue. |
| **Z3** Opposition | l'A→B : portraits + flèche | `VsHeader` (`.rm-vs` — SEUL écrivain de la classe) | Arbitrage user : « on a des portraits, une flèche ». Le verbe est un vocabulaire FERMÉ (`IconId`), défaut « → » ; `targetVariant='full'` quand les États du sujet guident la fenêtre. A→B naval → #1088. |
| **Z3b** Enjeu | ce que le jet MET EN JEU — la PHRASE seule | prop `stake` de `RollShell` / `CascadeStep.stake` → `StakeNote` (`.rm-stake` — SEUL écrivain de la classe) | Le producteur ne fournit qu'une `StakeRef` (clé de dataset + valeurs calculées) : le TEXTE est rendu par le résolveur unique `resolveStake` (fail-closed). Contenu autorisé : **descripteur mécanique** assemblé depuis la donnée réelle, et/ou **verbatim COURT** recollable — jamais une phrase d'aide rédigée, jamais un pavé (le verbatim intégral vit dans la fiche Codex). Ton NEUTRE : un enjeu ANNONCE. |
| **Z3b′** Renvoi de règle | la porte vers la FICHE de la règle du jet | affordance COMPACTE accolée au libellé d'étape DANS LE TITRE (`CascadeBody.titleNode`, Z0 — le sous-titre `stepSubtitle` ne porte plus que la position) : `StakeRule` (`CodexRef` en déclencheur-icône, `ab-codex-info` + glyphe `journal/info`), cible DÉRIVÉE de l'entrée d'enjeu | Arbitrage user 2026-08-06 : « "la régle" ? C'est moche. Je pensais que tu allais mettre un "i" a coté de "Cauchemars", pas "la régle" en dessous ». Jamais un lien textuel sous la phrase, jamais un bouton local ni un caractère typographique bricolé ; nom accessible obligatoire (`ariaLabel`, l'icône est `aria-hidden`). **Ne vaut que pour le TITRE d'étape** : les CHIPS restent leurs propres portes, sans ⓘ voisin (#1078). |
| **Z3b″** Renvoi en surface DENSE | la porte vers la règle depuis une GRILLE d'actes (menu d'infirmerie, listes de gestes) | l'ÉLÉMENT D'ACTION est sa propre porte : `CodexRef wrap` + `instance` nommant l'acte, cible DÉRIVÉE de l'enjeu du jet (`stakeRuleOf(flowStakeRef(...))`) | Jamais un ⓘ par cellule (la grille en serait criblée), jamais une phrase d'enjeu par cellule. Un acte dont le jet n'a PAS d'enjeu authoré ne reçoit AUCUNE porte — pas d'affordance morte (`hasFlowStake` décide). Même principe que Z5b : le contrôle EST sa règle (#1078). |
| **Z3c** Menace subie | la perturbation/menace que le personnage SUBIT (sabotage d'un Test d'équipage, attaque entrante) | `.rm-threat` (2 écrivains : `CrewTestModal`, `ShipBatteryModal`) | Ton DANGER assumé — réservé à ce qui est subi, jamais à un enjeu annoncé (Z3b). |
| **Z4** Pré-jet | le choix de RÈGLE avant le jet (Parade/Esquive, arme, localisation) | `RollShell.setup` + `OptionChooser` | Valeurs par `optionValue`/`optionPending`, jamais un « base + mods » recalculé au call-site. Disparaît au jet. |
| **Z5** LA ligne | portrait · libellé + difficulté · base ± mods = cible · dé · verdict ✓/✗ ±DR | `RollLine` / `PendingRollLine` (site UNIQUE) | La Difficulté vit ICI, en texte et en valeur (`.rm-roll-diff`), TOUJOURS — jamais en chip (#1072). Elle est CHOISIE (hors combat : le site qui ouvre le jet la pose) ou DÉRIVÉE (en combat : la combinaison des circonstances la compose, `LDB 14 l.91-96`) — un contrat, deux modes, le mode se lit à la présence de `difficultyParts` (posée par `rollLine`, jamais devinée à l'affichage) ; DÉRIVÉE, le palier devient sa propre affordance de règle (popover de composition → fiche « Combiner les Difficultés ») et ses circonstances ne sont PLUS des chips (#1153). Le masque de découverte (#990) s'applique par CELLULE (`RollMask`). |
| **Z5b** Chips | les modificateurs CIRCONSTANCIELS, nommés | `ModChips` (`.rm-mod`) | Une chip EST sa règle, cliquable (patron `chipCodex` / `CodexRef` / `RULE_REF`) ; provenance en badges structurés, jamais un ⓘ. L'écart de réconciliation (`reconciled`, plafond mesuré `TestResult.clamped`) devient une chip NOMMÉE — jamais un masquage silencieux. |
| **Z5c** Raison du verdict | POURQUOI ce verdict quand la comparaison des DR AFFICHÉS ne le dit pas seule — départage d'un Test opposé (LDB 12 l.160) | ANNOTATION de LA ligne (Z5), au même site de rendu que la difficulté (`RollLine`) | La raison appartient à la ligne dont elle explique le ✓/✗ : jamais un bandeau de bilan (Z13 COMPARE, elle n'explique pas), jamais l'issue (Z12) ni la sous-ligne de rangée (Z7). DONNÉE du résolveur (`RollBreakdown.decided`, posée par `opposedReasons`) : l'affichage n'a rien à recomparer, et rien ne s'écrit quand les DR ont tranché. PÉRIMÈTRE : la phrase n'est tamponnée que si les DR NATURELS des deux camps (ceux que les lignes montrent) sont égaux eux aussi — un verdict rendu sur des DR ajustés (Taille en Parade, Défensive…) reste MUET plutôt que d'annoncer une égalité introuvable à l'écran. La phrase EST le renvoi Codex de la règle (`CodexRef` → `RULE_REF['tests-opposes']`, fiche `regles/tests-opposes`), jamais un ⓘ voisin. Masquée avec les jets qu'elle compare (#990), masque de VALEUR compris — la phrase cite les deux grandeurs (#1149). |
| **Z6** Progression | Test étendu `n/m` | `RollRow.extendedDr` → `DrBar` | SEULE surface de progression : ni le sous-titre, ni l'issue ne la redisent. |
| **Z7** Sous-ligne | l'issue de CETTE rangée | `PanelRowData.note` (`.rr-note`) | Canal UNIQUE d'une note par rangée. |
| **Z8** Refus | la RAISON de l'indisponibilité, visible | `RollRow.rollBlocked` → `GatedAction` | Dérivée du MÊME prédicat que la garde du résolveur, jamais une seconde condition recopiée. |
| **Z9** Déclaration | qui lance (fenêtre à composition) | `RollRow.declare` | Phase 1 : elle précède les choix de règle. |
| **Z10** Influences | les POOLS de ressource, « Ressource ×N » | `InfluenceRow` (+ `ResilienceButton`, `DeterminationButton`) | Jamais de `n/m` sur un pool (réservé Z6). La fiche RAW passe par la PORTE du popover (`CodexRef` `wrap` : le clic dépense, ↓ épingle). |
| **Z11** Sélecteur de dé | le dé POSÉ (Résilience, option « Dés fixés ») | `ForcedRollPicker` | Commit au geste TERMINAL (Entrée) ; un blur pré-jet réinitialise. UNE surface de marque « Dé fixé » (étiquette du sélecteur, sinon `.prow-fixed-mark`). |
| **Z12** Issue | ce qui s'est PASSÉ | `RollShell.outcome` (`RecapLine[]` → `RecapLineRow`, cadre `.rm-journal`) | DONNÉE, jamais du JSX ni du markup de site. Ni le verdict chiffré (Z5) ni la progression (Z6). Pleine couleur par défaut, ton AUTHORÉ. Muette sous le verrou `panelMasked` (#990). |
| **Z13** Bilan | l'agrégat multi / le DR net | `RollShell.summary` (`.rm-summary`) + `netSL` (`.rm-netsl`) | Masqué avec les jets qu'il compare (#990). |
| **Z14** Post-jet métier | surincantation, Critique, contre-sort | `RollShell.postRollExtra` / `forcedExtra` | Ne porte JAMAIS d'issue (Z12). L'ATTENTE d'un jet distant est une zone d'ÉTAT distincte (`.rm-await`). |
| **Z15** Actions | les verbes de la barre | `RollShell.actions` (`RollAction`) | Vocabulaire VERROUILLÉ (`assertActionVocabulary` : verbes du flux + neutres) ; la proéminence se DÉDUIT de la `key`, aucun style au call-site. |

### Invariant de GÉOMÉTRIE d'une fenêtre de jet (#1142)

**Le bord HAUT de la fenêtre de jet est invariant pour une session de jet donnée.** Toute zone dont
la présence dépend de la phase est rendue APRÈS les zones stables dans l'ordre du document. Une zone
qui apparaît pousse vers le BAS ; aucune ne tire vers le haut. **Les flux ne compensent jamais
localement** — un site qui déplace son contenu d'un slot à l'autre pour « éviter que ça saute »
soigne le symptôme chez lui et laisse l'invariant faux partout ailleurs.

Conséquences concrètes :

- L'ancrage de la fenêtre dans le voile fixe son bord HAUT (`.app-campaign .modal-overlay:has(.roll-modal)`,
  `src/ui/styles/combat-modals.css`) : la fenêtre occupe la bande basse de l'écran, la bande de champ
  de bataille visible au-dessus reste CONSTANTE d'un état à l'autre. C'est ce que servait l'ancrage
  bas (verdict vision #942 L7, « voir l'action sous la fenêtre ») — un bord haut fixe le sert mieux,
  puisque la bande visible ne respire plus au gré du contenu.
- La fenêtre garde un `max-height` borné : elle ne crève jamais le bas de l'écran, les grands flux
  (cascade à N pas déjà validés) défilent dans `.rs-scroll`, corps SŒUR de la barre d'actions.
- Ordre du document dans `.rs-scroll` (`RollShell`) : sous-titre → enjeu → `extra` → **setup (Z4)** →
  rangées (`.cs-rows`) → issue → DR net → bilan → post-jet → post-dé-forcé. Seule Z4 est volatile
  AU-DESSUS des rangées : elle disparaît au jet, sous le rideau de dés opaque (`.rm-scene`,
  `position:absolute; inset:0`) qui couvre la fenêtre pendant le roulis — la transition est masquée
  sur le chemin majoritaire. Volatilité ACCEPTÉE en l'état (zéro JS, zéro hauteur réservée) : si un
  chemin sans rideau vient l'exposer, c'est la coquille qui réservera CE slot, jamais un site.
- Cliquet structurel : `src/ui/roll-display-contract.test.tsx` (l'index DOM de `.cs-rows` dans
  `.rs-scroll` est le même pré-jet et post-jet, et aucune zone volatile hors Z4 ne la précède).

**Un signe, un sens** (libellés de jet) : la **parenthèse** est le détail DÉRIVÉ par le moteur — la
compétence, ajoutée par `composeRollLabel` ; le **tiret long** est le séparateur acteur/action. Donc
l'`actionLabel` écrit au call-site est un **groupe nominal capitalisé sans ponctuation** (« Forcer le
rythme », « Mal de mer par mauvais temps »), jamais une valeur dynamique entre parenthèses, un usage
(« … (boire) ») ni une situation après un tiret. Cliquet : `src/state/roll-action-label-guard.test.ts`.

**Règle transverse** : toute nouvelle surface de jet **compose** ces primitives — jamais un markup
recomposé, jamais une classe de rôle empruntée (`.rm-vs` appartient à `VsHeader`, cliquet
`src/ui/roll-display-contract.test.tsx`). Une information qui manque se sert par sa zone ; si aucune
zone ne l'accueille, c'est le contrat qu'on amende ici, avant le code.

## Politique grand écran (≥1440px)

Les breakpoints canon de la règle stricte 4 (900/700/560) ne bornent que VERS LE BAS (empilement
mobile). Sans politique symétrique vers le HAUT, un écran large (~1920px) lit un contenu enfermé
dans un couloir étroit avec un océan vide de part et d'autre (« vide non habité », #371) — constat
utilisateur sur moniteur large. Nouveau seuil documenté : **1440px**, au-delà duquel s'appliquent
trois règles :

1. **Les GRILLES de cartes s'élargissent.** Une grille de cartes (scénarios, catalogue…) compose
   `grid-template-columns: repeat(auto-fill, minmax(~380-420px, 1fr))` sur la largeur UTILE du
   conteneur (pas un `auto-fit` étroit qui laisse 2 colonnes flotter dans un couloir) — 3-4 colonnes
   sur un 1920px plutôt que 2. `.ts-grid` (scénarios de test) applique ce motif.
2. **Le PLAFOND diffère grille/lecture.** Un écran-GRILLE ou catalogue (tables, cartes,
   `TradeTable`) monte son plafond vers ~1200-1600px — plus de colonnes utiles, plus de contenu par
   écran. Un écran de LECTURE (prose, fiche, panneau centré) GARDE un plafond confortable
   ~960-1080px : la lisibilité d'une ligne de texte a une largeur optimale (trop large = l'œil perd
   la ligne en fin de retour), ce n'est pas un oubli mais un choix délibéré. `ScreenShell` porte
   cette distinction via la prop `body` : `'centered'` (lecture, `.screen-body` ~960px, inchangé) vs
   `'centered-wide'` (grille/catalogue, `.screen-body.screen-body-wide` ~1400px au-delà de 1440px) —
   choisir selon la NATURE du contenu, pas par défaut.
3. **Le FOND hors-cadre n'est jamais un aplat nu.** Les marges dégagées par un plafond de largeur
   doivent lire « cadre de table de jeu », pas « vide » — l'ambiance existante (gradients radiaux
   dorés/sang du menu principal, `.menu`) s'applique au CONTENEUR HÔTE partagé (`.worldmap-overlay`,
   coquille de `ScreenShell` — pas écran par écran) pour habiller ces marges sur toute la famille
   d'écrans plein-champ qui la composent.

## Raison d'un refus, et emplacement vide (arbitrages user 2026-08-24)

Deux règles NON NÉGOCIABLES, tranchées à l'écran par l'utilisateur sur une capture de la console de
combat — elles supplantent la spec HUD datée (`docs/plans/2026-08-16-spec-hud-combat.md` l.291 et
l.206-210), qui n'avait jamais été validée en rendu :

1. **La raison d'un refus vit au SURVOL et au FOCUS, jamais en texte inline.** Verbatim (2026-08-24) :
   « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue
   Trader qui est notre interface de départ n'a pas un tel comportement. » Une case, une pastille, un
   bouton fermés restent PROPRES (icône + libellé + touche, encre d'état grisé tenant AA ≥ 4,5:1) ; la
   raison naît de l'infobulle PARTAGÉE (`CodexRef` prop `refus`, rendue en tête du popover) au survol
   souris comme au focus clavier/manette — une seule infobulle par ancrage, jamais une 2ᵉ boîte
   concurrente. Sa copie HORS ÉCRAN (`.hors-ecran`) reste au DOM, cible de l'`aria-describedby` : un
   lecteur d'écran reçoit la raison sans avoir à survoler quoi que ce soit.
2. **Un emplacement vide ne porte AUCUN mot.** Verbatim (2026-08-24) : « Et je ne connais aucune
   interface, même pas Rogue Trader, qui dans les emplacement de capacité met "Libre" ». L'alvéole
   vide est un CREUX : verre en retrait, liseré en retrait, ombre interne — reconnaissable sans
   texte. Le nom (« emplacement vide ») n'existe que hors écran, pour le lecteur d'écran. Un texte
   d'aide au placement ne paraît que PENDANT un geste d'édition/dépôt, jamais au repos.

Corollaire mesuré : rendre au libellé la hauteur que la bande de raison lui volait (les capacités aux
noms longs — Détermination — étaient tronquées DEUX fois : le nom ET la raison).

## Densité et contrôles stylisés

- **Aucun contrôle natif non stylisé.** `<input type=checkbox/radio>` et `<select>` système sont
  interdits : style GLOBAL `appearance:none` appliqué dans `src/ui/styles/base.css` (+ variantes
  par module — `combat-ui.css`, `combat-modals.css`, `creator.css`) — case charbon bordée (cochée
  = fond `--accent` + marque `--gold2`), radio = point or, select = chevron or en data-URI, focus
  `--gold`, options thémées. **Piège select** : un override `padding` shorthand mange la flèche →
  utiliser `padding-right` + `background-color` (jamais `background` en raccourci).
- **Éviter les espaces vides.** Un panneau aéré-à-vide lit comme inachevé. Regrouper sur une
  ligne ce qui peut l'être (ex. itinéraire + boutons de mode en `space-between`), ne pas
  détourner `.bar` (header à fond/padding) pour une simple rangée, resserrer les marges —
  densité maîtrisée mais lisible. **Vérifier à 360px ET en large** : un layout qui tient à 360
  peut s'étaler à vide en grand (breakpoints canon 900/700/560, règle stricte 4).

## États de fin d'un combattant (#237)

Un combattant qui quitte le combat NE se rend pas de la même façon selon la raison — une croix
générique confondait mort, KO, reddition et hors-combat. Langage visuel défini **une seule fois**
dans `src/ui/endStateVisual.ts` (`END_STATE_VISUAL`), keyé sur la catégorie retournée par la
fonction moteur PURE `endState(c)` (`src/engine/conditions.ts`) :

| État (`endState`) | Sens | Icône | Classe |
|---|---|---|---|
| `mort` | mort définitive | `journal/death` (crâne) | `es-mort` (grenat) |
| `inconscient` | KO conscient perdu | `condition/unconscious` | `es-koan` (bleu) |
| `rendu` | reddition (#215) / coque amenée — pavillon baissé | `journal/surrender` | `es-rendu` (pâle, portrait NON grisé : l'ennemi capturé est intact) |
| `hors-combat` | éjecté vivant (Destin, naufrage, Mort Subite, coque coulée) | `journal/flee` | `es-hors` (sépia) |

`rendu` vs `hors-combat` repose sur le seul champ `Combatant.exitReason` (`reddition`/`prise` →
rendu ; `destin`/`naufrage`/absent → hors-combat), posé aux sites de sortie (`resolveSurrenderThreshold`,
`resolveShipUnits`, Destin dans `combatSlice`). Un héros à 0 PB CONSCIENT reste À Terre — `endState`
renvoie `null`, aucun marqueur de fin (l'À Terre vit dans les pastilles d'États).

Ce langage s'applique aux **trois surfaces** via cette source unique : le jeton de carte
(`TokenChromeMarks`, pastille `token-endmark`), le portrait et la frise d'initiative (`PortraitTile`, badge `end-mark` —
la frise réutilise `PortraitTile`). Une coque (`bodyShape 'vehicule'`) passe par le même token :
prise = pavillon amené (`rendu`), coulée = `hors-combat`. Verrou : `src/engine/endState.test.ts`
(4 états distincts) + `src/ui/endStateVisual.test.ts` (icône/classe uniques sur jeton ET portrait).

## Galerie design system (#412)

`src/ui/gallery/DesignGallery.tsx` — écran DEV uniquement (`import.meta.env.DEV`, chunk async,
`setScreen('gallery')` depuis l'entrée « Design system » du menu principal en dev) : la référence
de goût pérenne du design system, **remplace la planche HTML** figée (retraitée par ce ticket).
Gabarit `MasterDetail` : liste de primitives (Atomes du canon partagé, primitives « Atelier du
scribe », portraits/aperçus) → détail = la primitive **vivante**, montée dans ses états, avec des
DONNÉES RÉELLES de `src/data` (jamais inventées). Toute nouvelle primitive UI se catalogue ici EN
MÊME TEMPS qu'au catalogue ci-dessus et à `src/data/primitives.manifest.json` (`docs/primitives.md`).

## Zéro texte tutoriel

- **Ne JAMAIS ajouter de texte d'aide/tutoriel dans l'UI** (HUD ou écrans). Une UI bien conçue se
  comprend par ses affordances (surbrillances, chemins, badges d'action, curseurs,
  placeholders) — pas par un mode d'emploi affiché en permanence. Un badge/label = le NOM de
  l'action seul (« Charger (+1 Av) »), jamais une phrase d'instruction. Un **état vide** = un
  bouton d'action directe (« ➕ Créer un personnage »), jamais un paragraphe qui explique où
  aller.
- La consigne d'un champ va dans son `placeholder` ; l'explication optionnelle dans un `title`.
  GARDER en revanche les infos de DÉCISION (enjeux d'un choix : bonus PX, prix) et le lore — ce
  n'est pas du texte tutoriel.
- **JAMAIS de référence au livre dans un texte joueur** (pas de « Parer le tir — Protectrice 2+
  (LDB 62 l.307) » affiché à l'écran) : les refs LDB restent dans les commentaires de code
  (convention du dépôt), jamais dans l'UI. Réutiliser les libellés EXISTANTS plutôt que d'en
  réinventer un plus verbeux.
