# Recette navigateur — vérifier une feature dans le jeu (Playwright MCP)

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire au moment de valider une
> feature UI dans le navigateur.

**Vérification** : après une feature UI, valider dans le navigateur (Playwright MCP) — charger
l'app de CET arbre (`npm run dev` imprime son URL), dérouler le flux, vérifier `console` (0 erreur)
et screenshoter. Le menu
**« 🧪 Tests — scénarios »** ouvre un choix de scénarios de test (groupe fixé + scène adaptée,
combat direct) ; **passer par le scénario adapté, sinon en créer un** — un scénario = un fichier
dans `src/scenes/test-scenarios/` (cf. `docs/test-scenarios.md`).

**Le port est PROPRE À L'ARBRE** (#1679 L1c) : `scripts/port-dev.mjs` rend **5173 pour l'arbre
principal** (celui dont `.git` est un DOSSIER — arbre de travail ou clone) et un **port dérivé du
chemin absolu de la racine pour un worktree lié** (`.git` y est un fichier), dans la plage 5174-5272 ;
`vite preview` suit la même règle sur 4173 / 4174-4272 (`portDev`, `portPreview`). `vite.config.ts`
pose `strictPort` — deux arbres servis en même temps ne peuvent plus se recouvrir, et un port déjà
pris fait ÉCHOUER `npm run dev` au lieu de glisser sur le suivant. Le kit de recette vise ce même
port par défaut (`DEFAULT_URL`, `scripts/recette/lib.mjs`) ; `WFRP_DEV_URL` ou `--url` visent un
autre serveur.

**La recette est adossée à l'arbre qu'elle mesure** (#1679 L1c) — trois contrôles, tous portés par
`scripts/recette/lib.mjs`, aucun à recoder par scénario :

- **arbre SERVI** — le serveur publie sa racine dans un en-tête (`vite.config.ts`), `checkServer` la
  compare à l'arbre courant et REFUSE au premier geste sinon (`verdictArbreServi`). Fail-closed :
  un serveur qui ne publie rien est refusé aussi. `WFRP_RECETTE_ARBRE_LIBRE=1` lève ce contrôle
  quand la cible est délibérément ailleurs (app déployée, tunnel).
- **arbre GELÉ** — `withReloadRetry` relève `empreinteArbre` (mtime max + cardinal de `src/**` et
  `vite.config.ts`) avant, puis à chaque rechargement de page : un `src/` réécrit en plein vol fait
  ÉCHOUER la recette en NOMMANT le fichier (`verdictArbreGele`) au lieu de rejouer en silence.
- **état PERSISTANT** — `openApp` prend un instantané des stockages de la page
  (`instantanerStockage`) et le remet à `session.close()` : une recette ne laisse pas derrière elle
  les sauvegardes et réglages qu'elle a créés en jouant.

`evaluate` est BORNÉE (`DELAI_EVALUATE`, 15 s par défaut, réglable par appel) : le plafond part au
navigateur par le paramètre `timeout` du CDP — seul levier qui interrompt aussi une boucle
SYNCHRONE — doublé d'une course côté Node pour qu'une réponse qui ne revient jamais rejette au lieu
de figer le script sans message.

**Quel process sert un port ?** `Get-NetTCPConnection -LocalPort <port>` → colonne `OwningProcess` = le
PID RÉEL. Ne pas s'en remettre à `ps -W` seul : il rend le WINPID du wrapper npm, pas celui du serveur
Vite. L'arrêt passe par `node scripts/recette/arreter-dev.mjs <port>`, qui tue l'ARBRE de l'écoutant
(`taskkill /T`) : `taskkill`/`Stop-Process` sont bloqués dans le SHELL de l'agent, pas dans un script.

## Preuve headless (agents)

> **Le socle `lib.mjs` est TOUJOURS la première option, avant tout `playwright-MCP`** — le profil
> Chrome partagé (piloté par `playwright-MCP`) peut être VERROUILLÉ par une autre session en cours
> (lock Chrome mort/vivant d'une autre recette) ; `lib.mjs` lance SON propre Chrome headless avec un
> profil temporaire dédié (`launchSession`), donc jamais ce conflit. N'invoquer `playwright-MCP` que
> si le besoin dépasse ce que `lib.mjs`/`shot-screen.mjs` couvrent (vécu diagnostic #506).
>
> **NUANCE mesurée (recette #1117, 2026-08-05)** : sur les CASCADES à re-render fréquent (une étape
> valide, la suivante se monte — le DOM change sous la main), `playwright-MCP` s'est montré PLUS
> FIABLE que le socle, dont les refs se périment entre deux gestes. La préférence `lib.mjs` reste la
> règle pour la capture et la console ; pour PILOTER une cascade pas à pas, `playwright-MCP` est
> l'outil qui tient — et le piège des refs périmées ci-dessous s'applique aux deux.

Kit **committé** `scripts/recette/` — capture d'écran + console sans réinventer un script CDP par
agent (constat 2026-07-14 : plusieurs dizaines de scripts scratchpad ad hoc, un par session, pour
faire la même chose). Deux niveaux :

- **Cas simple** : `scripts/recette/shot-screen.mjs`, la CLI prête à l'emploi — plus AUCUN script à
  écrire.
- **Cas sur-mesure** : `scripts/recette/lib.mjs`, le socle (à importer dans un script jetable pour
  dérouler un flux précis).

Moissonné de scripts scratchpad éprouvés (patrons repris tels quels) : CDP nu sur Chrome headless
(`des-v5-verify.mjs`, `gallery-v2-tour.mjs`, `repro-399.mjs` — spawn Chrome, `Target.attachToTarget`,
`Runtime.evaluate`), filtrage console par `sessionId` (`repro-399.mjs`, `gallery-v2-tour.mjs`),
émulation `prefers-reduced-motion` via `Emulation.setEmulatedMedia` (`dice-reduced-motion.mjs`).
**Zéro dépendance nouvelle** : `playwright-core` n'était PAS installé dans ce dépôt (vérifié —
seul le scratchpad d'un agent l'avait en local) ; le socle reste donc en CDP nu (fetch + WebSocket
natifs Node ≥ 22), le choix le plus robuste des scripts moissonnés au regard de cette contrainte.
Le kit ne DÉMARRE **jamais** le serveur de dev — il s'y **attache** (erreur claire si injoignable).

> **L'étalon se juge aux TROIS VUES, source unique `scripts/recette/vues-recette.json`** (#1847) :
> `bureau` **1707×780** (la fenêtre réelle de l'utilisateur, et le viewport par DÉFAUT du kit),
> `portable` **1366×650**, `mobile` **360×740**. Le fichier ne porte QUE des vues ; le kit les expose
> par `VUES_RECETTE`, `vueRecette`, `VUE_REFERENCE` et l'helper `pourChaqueVue`.
>
> **Tout script qui OUVRE un écran pour le JUGER lit cette source.** Un script reste libre de son
> propre cadrage à une condition : que ce cadrage soit un GABARIT DE MESURE dont un chiffre
> consigné dépend, et qu'il le DISE à son site. Deux le font, nommément : `perf-scenario.mjs`
> (1600×950 — ses coordonnées de clic par défaut et ses cadences rAF s'y rapportent) et
> `scripts/qc/capture-jeu.mjs` (1600×900 — le cadrage des étalons commités de
> `public/qc/baseline-affine/`). Partout ailleurs, un couple en dur est une divergence.
>
> Le défaut historique de 1280 a fait juger « étriqués »
> pendant deux jours des écrans qui rendaient juste à leur largeur de référence (lot « matières &
> proportions », #393) ; les 900px de HAUT qui lui ont succédé ne tiennent sur AUCUN écran de
> l'utilisateur (mesure 2026-09-20 : fenêtre utile ≈ 745-780px). Ces vues ne remplacent pas la passe
> de largeur 900/700/560/360 de la charte : ce sont les fenêtres où l'on REGARDE, pas des
> breakpoints. Voir `docs/charte-ui.md` § « La HAUTEUR réelle ».

### CLI — `scripts/recette/shot-screen.mjs`

```
node scripts/recette/shot-screen.mjs --screen gallery --out mon-dossier
node scripts/recette/shot-screen.mjs --screen menu --mobile
```

Options : `--screen <id>` (obligatoire, un id de `SCREENS`, `src/state/store.ts`), `--out <dir>`
(défaut CWD), `--url <url>` (défaut : le port de CET arbre, cf. `scripts/port-dev.mjs`), `--mobile` (viewport 360×740),
`--width`/`--height`, `--settle <ms>`. Exit ≠ 0 si la console a remonté une erreur/exception après
l'ouverture de l'écran.

### CLI — `scripts/recette/hud-clickables.mjs`

```
node scripts/recette/hud-clickables.mjs
node scripts/recette/hud-clickables.mjs --widths 700,560,360
```

Vérifie par `elementFromPoint` et par les boîtes rendues qu'aucune surface du HUD n'en recouvre une
autre ni ne sort du champ, en exploration puis en combat, à 1707/1100/900/700/560/360 (options
`--widths`, `--url`) : chaque portrait du groupe et chaque case du pont reçoit SON clic, la piste du
groupe (`.pd-track`) tient sur UNE ligne, le fil d'événements ne mord pas sur la frise d'initiative,
la piste `.is-tiles` défile au lieu de déborder, la frise en bande va jusqu'au bord droit (réserve
≤ 8px), son cartouche de Round et l'acteur AU TRAIT restent dans le champ à tout défilement, la
TÊTE de la frise reste couverte par le cartouche à neuf positions de défilement (ni vignette ni
mobilier en débord entre le bord du champ et lui, ni sur ses flancs, ni PEINT sur lui — rangs
d'empilement comparés), toute entrée qui COMMENCE dans la zone utile de la colonne y FINIT, le PAS
d'entrée est constant (la mise en évidence de l'unité au trait est un `transform`, elle ne change
aucune boîte), la vignette AU TRAIT réserve son RELIEF (sa boîte peinte — liseré mis à l'échelle du
`transform` — ne recouvre aucun contrôle, n'est rognée par aucun bord du champ et ne passe sous le
cartouche que par son halo ; son chevron se voit), et la frise se juge dans ses TROIS états (pause
d'initiative, badges de score montés ; tour engagé ; acteur au trait EN BAS de l'ordre, piste défilée
à fond),
l'ouvreur d'écran d'un rail dissous garde un ancrage hors flux, et la boîte pleine ligne du bandeau
d'objectif n'avale rien hors de sa tête. Exit ≠ 0 avec la liste des défauts.
Le TIROIR DU JOURNAL se juge **ouvert** : la sonde le déplie par clic réel sur sa poignée
(`.ld-btn`) au premier tour tenu par un héros, puis refuse un panneau qui recouvre la console
(« recouvre la console de N×Mpx ») — fermé, il ne recouvre rien, et la question n'a pas de sens.
Chaque situation où la mesure serait verte par VACUITÉ (rail dissous sans ouvreur, bande de groupe
sans carte ni poignée, tiroir qui ne s'ouvre pas, console sans case) se DIT « sonde aveugle ».
La caméra n'a plus de plaque sur l'écran de jeu (`src/ui/camera-sans-plaque.test.ts`) : `.vc-btn`
n'est plus sondée. ANGLE MORT DÉCLARÉ : l'ouvreur de dossier de navire n'est monté qu'en combat
NAVAL — le scénario `enc-mutants` sondé par défaut ne le porte pas.
Le DÉTECTEUR est fait de DEUX fonctions pures exportées par `scripts/recette/hud-clickables.mjs` —
`defauts` pour la mesure entière, `defautsFrise` pour les seuls verdicts de frise (les passes qui ne
montent pas le pont l'appellent directement) — testées à fixtures par `scripts/recette/hud-clickables.test.mjs` (gate
`test:recette`), un cas rouge et un cas vert par verdict. Règle de partage unité ⁄ sonde :
`docs/charte-ui.md` § « Où se garde un contrat CSS ».

### CLI — `scripts/recette/console-pont-formes.mjs`

```
node scripts/recette/console-pont-formes.mjs
node scripts/recette/console-pont-formes.mjs --widths 900,700 --mesures
node scripts/recette/console-pont-formes.mjs --stress 105
```

Sonde les DEUX ponts, dans cet ordre. **Passe EXPLORATION** d'abord, aux trois vues jugées
(1707×780 / 1366×650 / 360×740), une conversation EN COURS et le panneau du tiroir-journal DÉPLOYÉ :
c'est là que vit le défaut fondateur du ticket #1848 (le bandeau de dialogue passant sous le pont
léger) et une sonde qui n'irait qu'au combat mentirait par couverture. Elle refuse : un pont
d'exploration absent, un dialogue ou un panneau non montés (elle s'annonce AVEUGLE plutôt que de se
taire), une surface de la rangée du monde qui descend sous le bord haut du pont, plus les deux
détecteurs purs ci-dessous. Une surface PORTÉE par le pont (la commande du tiroir, assise dessus)
est relevée `descendant` : ce n'est pas une occlusion.

**Passe COMBAT** ensuite : le PONT DE CONSOLE dans ses TROIS formes — pont complet (tour du joueur), forme spectatrice
(tour non contrôlé), ouverture de combat — aux vues 1707×780 / 1366×650 / 1100 / 900 / 700 / 560 /
360×740. Refuse : une région qui ampute son contenu (`scrollHeight > clientHeight` sur `.cc-dock` et
chacune de ses régions), une bande dont la hauteur RENDUE est plus COURTE que sa hauteur DÉCLARÉE
(`--cc-deck-h`, une réserve qui mentirait) ou qui en dérive de plus de 6px, un contrôle du pont qui
sort du champ, un pont qui recouvre le fil ou la frise, une bande dont la hauteur CHANGE d'une forme
à l'autre (au-delà de 700, là où le pont est une ligne), un bandeau de phase qui recouvre l'arche,
le fil ou la frise — à chacune de ses TROIS adresses (`data-phase` : parapet du pont, ouverture au
haut de la carte, centré au-dessus de l'arche en forme spectatrice) —, un bandeau d'ouverture qui
recouvre la bande de groupe, la frise, le rail, le fil ou le pont, ou qui quitte le HAUT de la carte
tant que la zone haute le permet, une arche décentrée, une bande qui garde une région ou sa MATIÈRE
en forme spectatrice (« les barres gauche et droite »), et un flanc de l'arche où l'on ne touche pas
le PLATEAU.
Deux DÉTECTEURS PURS portent le reste du verdict — `scripts/recette/detecteurs-pont.mjs`, testés à
fixtures rouge/verte par `detecteurs-pont.test.mjs` (gate `test:recette`) :
`surfaceOcculteeParUnPont` (une surface basse du champ — dialogue, tiroir, fil, commandes de
première personne, puce d'attente — dont le PONT répond au centroïde de l'intersection : le critère
est l'OCCLUSION, jamais une fraction de recouvrement) et `elementsHorsFenetre` (tout élément non-SVG
hors d'un scrollport dont la boîte sort du viewport à gauche ou à droite).
`--mesures` imprime les mesures sans verdict : c'est ainsi que se dimensionnent `--cc-deck-h` et
`--cc-arch-chrome` (`src/ui/styles/combat-console.css`), que jsdom ne peut pas calculer — le bloc
`arche {h, pad, gap, enfants[], portrait}` donne le chrome par `h − portrait`.
`--stress <px>` fait DÉRIVER le contenu de l'arche et INVERSE le verdict : la sonde doit rougir,
sinon elle est déclarée aveugle (exit 1). Exit ≠ 0 avec la liste des défauts.

### CLI — `scripts/recette/hauteur-reelle.mjs`

```
node scripts/recette/hauteur-reelle.mjs
node scripts/recette/hauteur-reelle.mjs --vues portable --mesures
```

La garde de l'invariant de HAUTEUR (#1847, `docs/charte-ui.md` § « La HAUTEUR réelle »). Pour CHACUNE
des trois vues de `vues-recette.json`, elle OUVRE : les écrans `menu`, `party`, `creator`,
`compendium`, `editor`, `test`, `coop` ; la campagne en exploration ; le menu système (vraie frappe
d'Échap) et ses sous-écrans Options, Options/Clavier et Coopération (vrais clics) ; la fenêtre de jet
d'ouverture de combat, puis le combat. Un écran hors de cette liste n'est pas gardé — l'y ajouter est
le geste. Elle refuse :

- **un scrollport de PAGE** — `document.scrollingElement` qui déborde, ou une boîte défilante qui
  COUVRE tout le viewport (le scrollport de page sous un autre nom) ;
- **une commande INATTEIGNABLE** dans une carte de menu — un bouton dont le bas tombe au-delà de la
  boîte du corps défilant ET de la course qui reste à défiler ;
- **un corps de modale ÉCRASÉ** — une fenêtre dont le corps défile alors qu'elle ne tient pas ce que
  son CSS déclare réclamer (`--roll-fenetre`, planchers `--roll-band-min`/`--roll-dock-min` lus au
  `getComputedStyle` du voile) : ce sont ses bandes qui la tiennent, pas l'écran ;
- **l'acteur au trait hors du champ** de sa piste d'initiative.

Les quatre VERDICTS sont des détecteurs PURS (`scripts/recette/detecteurs-hauteur.mjs` :
`scrollportDePage`, `commandesInatteignables`, `corpsDeModaleEcrase`, `courantHorsChamp`), testés à
fixtures rouge/verte par `detecteurs-hauteur.test.mjs` (gate `test:recette`) — la MESURE vit dans la
sonde, le JUGEMENT dans le détecteur. La sonde IMPRIME son relevé à chaque écran, défaut ou non
(page, cadres défilants, corps/boîte/bandes de la fenêtre de jet) : `--mesures` suspend le verdict et
ne garde que ce relevé. Exit ≠ 0 avec la liste des défauts. Résidu mesuré sur l'arbre : Codex à
360×740, page 3007/740 — #1860 ; la sonde reste donc à 1 défaut, sans exemption.

### Socle — `scripts/recette/lib.mjs`

| Fonction | Rôle |
|---|---|
| `openApp` | vérifie le serveur (fetch), lance Chrome headless, navigue, attend que `__wfrp.screen` soit prêt (chargement async, cf. `src/main.tsx`). `timeoutMs` (45 s par défaut) borne l'amorçage COMPLET — l'URL CDP de Chrome (`launchSession`) puis l'attente de `__wfrp.screen` : un premier chargement à froid a été mesuré à 21 s sur un worktree neuf ; le refus DISTINGUE « `__wfrp` absent » (mauvaise URL, build cassé, serveur non-DEV) de « app trop lente à s'installer » |
| `gotoScreen` | navigue vers un écran via `__wfrp.screen` |
| `shot` | capture PNG nommée dans un dossier donné (créé si absent) ; `{ancre}` fait DÉFILER un sélecteur en vue avant la capture — à 360 px les écrans s'empilent et le sujet passe sous le pli ; NEUTRALISE par défaut ce qui signe une capture — `Escape` si le focus est sur un `<select>` (son popup est NATIF et restait ouvert), puis `blur`. `{neutraliser:false}` pour photographier un contrôle focalisé. ⚠ Ce `blur` par défaut CASSE une mesure clavier : jamais de `shot` entre le focus posé et la frappe qui le consomme — capturer AVANT, ou passer `{neutraliser:false}` |
| `consoleGuard` | collecte erreurs/warnings/exceptions, filtrés sur LA session courante (piège du buffer partagé, § « Pièges vécus » ci-dessous) |
| `espionReseau` ⚠ à POSER AVANT le geste mesuré | les URL que la page DEMANDE : patch `fetch`/`XMLHttpRequest` DANS la page **et** `Network.requestWillBeSent` (CDP), réunis. `await esp.urls()` rend tout, `await esp.correspondant('/source/')` filtre. C'est la preuve d'une requête ABSENTE (« la fiche du Codex ne charge aucun chapitre »). **Jamais l'inventaire de ressources de l'API `performance`** : son tampon est BORNÉ (250 entrées) et l'app le sature à l'amorçage — il a rendu un faux « aucune requête » en recette C5 |
| `freezeTimeout` / `unfreezeTimeout` | monkey-patch `setTimeout` pour figer/dégeler une durée d'animation avant capture |
| `emulateReducedMotion` | force `prefers-reduced-motion: reduce` (CDP `Emulation.setEmulatedMedia`) |
| `setViewport` / `setMobileViewport` | viewport explicite / mobile canon 360×740 (charte-ui.md — testable dès 360px) |
| `clickButtonByText` | trouve un `<button>`/`[role="button"]` par son TEXTE (`session, texte, {exact?}`), `scrollIntoView`, PUIS lit son rect et clique via un VRAI clic CDP (`Input.dispatchMouseEvent` pressed+released) — SCROLL-AWARE : lire le rect AVANT le scroll fait rater le clic SILENCIEUSEMENT (aucune erreur, aucun effet). `{exact:true}` compare le texte ENTIER (obligatoire dès qu'un libellé en préfixe un autre) ; `{dans}` = sélecteur RACINE où chercher, quand le même libellé vit dans deux zones de l'écran — racine d'une modale : `.modal-overlay` ; racine d'un ÉCRAN PLEIN (`ScreenShell`, `src/ui/ScreenShell.tsx` : bibliothèque de campagnes, carte du monde, port, marché, dossier de navire, carnet, possessions, voyage, hub de ville, sélection du groupe…) : `.worldmap-overlay` — `{ dans: '.modal-overlay' }` n'y trouve RIEN ; `{rangee}` = texte d'une RANGÉE quand chaque rangée d'une liste porte le même bouton (les « Choisir » de la modale « Choisir la campagne » : `{ rangee: 'La Diligence' }`) — seuls comptent les boutons de l'ancêtre le plus proche de ce texte qui en contient un, et une rangée introuvable est un refus qui la nomme (friction mesurée en recette E7, #1343) ; si PLUSIEURS boutons matchent, le premier est cliqué et l'ambiguïté est AVERTIE sur `stderr` avec les textes concurrents |
| `cliquerSelecteur` | CLIC RÉEL d'un contrôle désigné par un SÉLECTEUR (`session, selecteur`) — le pendant de `clickButtonByText` quand le contrôle n'a PAS de texte (bouton à glyphe : tiroir du journal `.ld-btn`, ouvreur d'écran). SCROLL-AWARE, et il REFUSE en le nommant : cible absente, boîte 0×0 (non rendue), contrôle désactivé — jamais un clic silencieux qui n'a rien fait |
| `clicReel` | la triade CDP `mouseMoved`/`mousePressed`/`mouseReleased` — geste de clic UNIQUE du module : tout helper qui clique passe par là, aucun ne la réécrit |
| `resoudreModales` + `CASCADE_LABELS` | RÉSOUT toute fenêtre ouverte (`.modal-overlay`) jusqu'à ce qu'il n'y en ait plus — DÉFINITION UNIQUE partagée par les sondes. Deux gestes, dans cet ordre : (1) un bouton d'AVANCEMENT (`CASCADE_LABELS` : Lancer, Appliquer, Continuer… — aucun nom de RÈGLE n'y figure) ; (2) à défaut, la **première option OUVERTE** d'un sélecteur d'options (`OptionChooser` : `.seg`, `.rm-loc-grid`, `.rm-loc-inline`). Une fenêtre de CHOIX (défense, désengagement, résistance) n'offre aucun bouton d'avancement tant que le joueur n'a pas tranché : la recette tranche par la FORME du contrôle, jamais par le nom d'une règle — toute fenêtre de choix passe, y compris celle qu'une règle future ouvrira, et l'option cliquée est IMPRIMÉE (une recette dit ce qu'elle a choisi à la place du joueur). Lève en nommant les boutons offerts si aucun des deux gestes ne s'applique, et lève « l'option « X » ne fait pas avancer la fenêtre » si la fenêtre est identique après deux clics. ⚠ `max` (40) est un BUDGET TOTAL de clics pour fermer la cascade ENTIÈRE, **pas un pas unitaire** : l'helper lève si une fenêtre reste ouverte au bout du budget, donc `{ max: 1 }` ne sert PAS à « avancer d'un cran » — il lève aussitôt. Pour avancer d'UN pas, cliquer soi-même — `clickButtonByText` avec le libellé voulu et `{ dans: '.modal-overlay' }`, ou `cliquerSelecteur` sur l'option visée (friction mesurée en recette #1852, 2026-09-21) |
| `realKey` | frappe RÉELLE (`session, touche`, `Input.dispatchKeyEvent` : `rawKeyDown`/`char`/`keyUp`) — traverse les MÊMES handlers que le clavier physique (`keybindings.ts`), contrairement à un `KeyboardEvent` JS synthétique souvent ignoré. UNE forme d'argument pour toute la famille `realKey*` : la TOUCHE `{ key, code?, windowsVirtualKeyCode?, modifiers? }` — pour Échap, `session` puis `{ key: 'Escape' }` ; seul `key` est requis, `code` et le code virtuel se déduisent de lui (`scripts/recette/lib.mjs`). Alias français : `frapperTouche` (même geste, même forme). ⚠ Observé en recette #1752 le 2026-09-17 : `Enter` envoyé sur un `<button>` FOCALISÉ n'a pas activé le bouton (`keydown` reçu, `defaultPrevented:false`, aucun `click`) ; `Space` l'a activé. Une frappe d'activation se mesure donc, elle ne se suppose pas |
| `realKeyDown` / `realKeyUp` + `ALT` / `MOD_ALT` | geste MAINTENU (`session, ALT` — la même TOUCHE que `realKey`, `ALT` imposant `code`/code virtuel) : l'appui et le relâchement sont deux appels, et ce qui se joue ENTRE les deux porte `{ modifiers: MOD_ALT }` (`survoler`, `clickButtonByText`) — sinon l'événement déclare la touche relâchée. C'est le pilotage d'**Alt maintenu** (`decor.reveler`) : halo + plaque de nom sur chaque utilisable visible, le survolé agrandi ; relâché, le champ redevient muet. ⚠ `__wfrp.screen('editor')` charge la scène-FIXTURE, pas la scène active — pour ouvrir un document précis, `editorOpen(id)` ; et un `querySelector` de pastille reste vrai SOUS la modale d'intro (mesurer la scène, pas le seul DOM) |
| `typeInField` | SAISIE réelle dans un champ (`session, selecteur, texte, {clear?}`) : focus par VRAI clic CDP, puis `Input.insertText` — l'insertion passe par le pipeline d'édition, donc le `onChange` React s'exécute (mesuré : `ab12cd` frappé dans `.coop-code-input` se lit `AB12CD`, la casse venant du handler React de `CoopCodeInput`). Rend la valeur relue APRÈS la frappe. C'est la sortie du piège « Champ CONTRÔLÉ React » ci-dessous |
| `selectOption` | CHOISIT une option d'un `<select>` AU GESTE (`session, selecteur, valeur`) : focus par VRAI clic CDP, `value` posée par le SETTER NATIF puis `input`+`change` dispatchés — un `<select>` ne s'ouvre pas en headless (popup natif, hors DOM), le geste rejouable est celui du clavier. Refus explicites : liste absente, ou valeur hors des options (les options offertes sont remontées). Rend `{valeur, libelle}` RELUS après le geste |
| `champParLibelle` | SÉLECTEUR CSS d'un champ visé par son LIBELLÉ VISIBLE (`session, 'dernier bloc'`) : il pose un `data-recette` inerte sur le champ trouvé et rend `[data-recette=…]`. Nécessaire parce que les `id` de `NumberField`/`useId` (`:r5:`, `:ra:`) ne sont PAS des sélecteurs CSS valides — `querySelector('#:r5:')` jette. `{dans}` = sélecteur RACINE où chercher, même option que `clickButtonByText` : sans elle, le PREMIER champ du document qui porte ce libellé est pris — à l'éditeur, le « Nom » de l'inspecteur passe avant celui de la modale « Enregistrer » (`{ dans: '.modal-overlay' }`) |
| `poserFichier` | PEUPLE un `input[type=file]` (`session, selecteur, chemin, {dans?}`) par les appels CDP `DOM.enable` / `DOM.getDocument` / `DOM.querySelector` / `DOM.setFileInputFiles` : l'`input` reçoit son `change` sans aucun dialogue — cliquer son `<label>` ouvrirait le sélecteur de fichier de l'OS, qu'aucun pilote ne ferme. `chemin` est résolu en absolu (et rendu). REFUSE en le nommant : racine `dans` absente, `input` absent |
| `verdictDebordement` | MESURE de la règle stricte 4 à la largeur courante : `{ vw, docSW, debordants:[{tag, aria, droite}] }`. `docSW > vw` = la page pousse latéralement ; `debordants` nomme les contrôles clippés. Un débordement ne se voit pas sur une capture, il se mesure |
| `survoler` | SURVOL RÉEL (`session, sélecteur|texte de bouton`, `Input.dispatchMouseEvent mouseMoved`) — le geste par lequel une raison de refus se lit (arbitrage user 2026-08-24 : survol/focus/tap, jamais inline). SCROLL-AWARE comme `clickButtonByText` ; `{attenteMs}` laisse l'infobulle naître |
| `infobulleDe` | l'infobulle ouverte et sa POSITION relative à la cible : `{ texte, dx, dy }` (écarts entre les deux boîtes, 0 quand elles se touchent). `texte: null` = aucune bulle. Un `dx`/`dy` énorme signe un rect mesuré à 0×0 (vécu : `display: contents` sur l'enveloppe → bulle à (8, 6) pour un contrôle à (1050, 258)) |
| `evaluate` / `waitFor` | eval JS dans la page (attend les promesses) / poll jusqu'à condition vraie |
| `evaluerFn` | ÉVALUE UNE FONCTION dans la page (`session, fn, ...args`) : le corps est sérialisé tel qu'ÉCRIT et les arguments par `JSON.stringify`. C'est la sortie du DOUBLE ÉCHAPPEMENT (voir ci-dessous). La fonction ne capture RIEN de la portée du script |
| `attendreSelecteur` | attend qu'un sélecteur soit PRÉSENT, et REFUSE en le nommant sinon — au lieu d'un `sleep` gonflé « au cas où » qui cache la cause |
| `checkServer` / `launchSession` | briques bas niveau d'`openApp` (séparément utilisables) — `launchSession` prend pour défaut la vue de RÉFÉRENCE, **1707×780** (§ « L'étalon se juge aux TROIS VUES » ci-dessus) |
| `VUES_RECETTE` / `vueRecette` / `VUE_REFERENCE` / `pourChaqueVue` | les trois vues jugées, lues à `vues-recette.json` ; `pourChaqueVue` prend la session et une fonction : il pose le viewport, laisse le DOM se reposer, puis appelle la fonction avec `{ nom, largeur, hauteur }`. Un nom de vue inconnu LÈVE, au lieu de rendre un viewport `NaN×NaN` |

**Capturer un écran** :
```js
import { openApp, gotoScreen, shot, consoleGuard } from './scripts/recette/lib.mjs';
const session = await openApp();
const guard = consoleGuard(session);
await gotoScreen(session, 'compendium');
await shot(session, 'compendium-01', 'mon-dossier');
console.log(guard.errors());
await session.close();
```

**Ouvrir sur un port DÉRIVÉ (worktree lié) et piloter un formulaire aux gestes** — `openApp` appelé sans
argument vise `DEFAULT_URL` (le port de l'ARBRE PRINCIPAL, 5173) : en worktree, `npm run dev` imprime
son port dérivé (`scripts/port-dev.mjs`) et il faut le passer EXPLICITEMENT, sinon la recette juge
l'autre arbre :
```js
import { openApp, gotoScreen, selectOption, clickButtonByText, shot } from './scripts/recette/lib.mjs';
// URL explicite du port dérivé imprimé par `npm run dev` dans CE worktree ; `opts` = ceux de
// `launchSession` (`{ width, height, mobile, chromePath, port }`).
const session = await openApp('http://localhost:5182/', { width: 1366, height: 650 });
await gotoScreen(session, 'compendium');
await selectOption(session, 'select[aria-label="Chapitre du passage"]', '21');
await clickButtonByText(session, '+ Fragment', { exact: true });
await shot(session, 'adresse-01', 'mon-dossier');
await session.close();
```

**Éteindre son serveur de dev à la fin** — par le PORT, jamais par le PID du job du shell :
```
node scripts/recette/arreter-dev.mjs 5233
```
`npm run dev` monte une CHAÎNE (npm → node → vite) : le PID relevé au lancement est celui du wrapper,
et `process.kill` dessus laisse l'écoutant vivant — le port reste pris. Le script lit l'ÉCOUTANT sur
la table TCP du système puis tue son ARBRE (`taskkill /T` sous Windows, seul geste fiable ; `taskkill`
lancé par un script `.mjs` n'est pas soumis à l'allowlist du shell de l'agent).

> **Un script de recette écrit au SCRATCHPAD importe le kit par une URL `file:///`.** Le scratchpad est
> hors de l'arbre : `import { openApp } from 'C:\\…\\scripts/recette/lib.mjs'` échoue (`ERR_UNSUPPORTED_ESM_URL_SCHEME`
> — un chemin Windows absolu est lu comme un schéma d'URL). La forme qui passe est
> `import('file:///C:/Users/…/scripts/recette/lib.mjs')`, slashs compris. Un chemin RELATIF
> (`'./scripts/recette/lib.mjs'`) se résout contre le scratchpad et échoue en `ERR_MODULE_NOT_FOUND`
> (vécu en recette le 2026-09-22).

> **Toute expression passée à `evaluate` EN CHAÎNE s'écrit en `String.raw`** — ou passe par `evaluerFn`.
> Le template literal de Node consomme les antislashs AVANT que la page ne voie l'expression : `/\s+/`
> écrit dans un backtick arrive `/s+/` dans le navigateur, et la recette mesure autre chose sans une
> erreur (vécu : 4 appels perdus). Passer la fonction à `evaluerFn` supprime la question.

> **Une infobulle `title` NATIVE n'est pas une preuve.** Elle est peinte par le système, hors du DOM :
> elle n'apparaît sur AUCUNE capture, et un lecteur d'écran ne la lit pas toujours. La preuve qu'un
> refus « porte sa raison au survol » est donc l'ATTRIBUT et le DOM — `aria-disabled="true"`,
> `aria-describedby` pointant une copie hors écran, et l'infobulle partagée `CodexRef` (prop `refus`),
> qui est du DOM et se photographie. Un `title` seul est un défaut, pas une raison atteignable.

**Figer une animation le temps d'une capture** :
```js
import { openApp, evaluate, freezeTimeout, shot } from './scripts/recette/lib.mjs';
const session = await openApp();
await freezeTimeout(session, [0]); // AVANT de déclencher l'animation
await evaluate(session, "document.querySelector('.dice-roll-btn').click()");
await shot(session, 'des-figes', 'mon-dossier');
await session.close();
```

**Cliquer le VRAI bouton « Lancer » fait lire un `roll` NULL le temps du roulis** : le clic déclenche
`useRollFrisson.trigger` (`src/ui/useRollFrisson.ts`) qui attend le tumble (**750 ms**, `TUMBLE_MS`)
AVANT d'exécuter le résolveur réel et de committer le jet au store — lire l'état (`pendingTest.roll`,
`__wfrp.modal()`…) tout de suite après un `Input.dispatchMouseEvent` sur « Lancer » lit donc encore
`roll: null`. Deux parades : attendre le roulis (`waitFor`, ~800 ms) avant de lire, OU `freezeTimeout`
(exemple ci-dessus) AVANT le clic — `setTimeout` patché à 0 ms collapse le tumble ET l'atterrissage
(`LAND_MS`), le résolveur s'exécute quasi immédiatement. **`__wfrp.roll()` n'a PAS ce piège** : il
appelle l'action du store DIRECTEMENT (`devDriveModal`, `src/state/devtools.ts`), sans passer par le
bouton ni l'animation — réservé au SETUP/observation (doctrine ci-dessous), jamais pour valider le
flux visuel que le joueur vit.

Pièges déjà documentés (renvois, pas de doublon) : le buffer console **partagé** entre
sessions/onglets, le **closure-sync** (lire le DOM dans le même `evaluate` que l'action qui change
l'état React), le **HMR silencieux** qui ramène au menu en pleine recette — voir « Pièges vécus » et
« Piège du *closure-sync* » plus bas dans ce document.

## Doctrine : piloter COMME UN JOUEUR, pas à la main

Ordre de préférence STRICT pour exercer un flux :
1. **Vrai input** : le contrôle **clavier** est développé (cf. `src/state/keybindings.ts` — navigation,
   ciblage, actions ; + manette) → `browser_press_key` ; clics réels sur les éléments (`data-cid` sur
   les tokens SVG, boutons des modales). C'est le SEUL pilotage qui valide ce que le joueur vit.
2. **`__wfrp` pour le SETUP et l'OBSERVATION** : lancer un scénario (`scenario`), placer/donner le
   tour (`place`/`turn`), lire la vérité (`state`/`battle`/`aim`/`modal`/`log`).
3. **Appel direct des fonctions du store** (`__wfrp.store.getState().xxx()`) : DERNIER recours,
   jamais pour valider le flux testé — on validerait un chemin que le joueur n'emprunte pas, et
   c'est la première source d'erreurs (closures, état non re-rendu, préconditions sautées).

> **Touches du déplacement en EXPLORATION** (piège de recette : les flèches paraissent mortes hors combat).
> Le pas du groupe est sur les codes physiques `KeyW`/`KeyA`/`KeyS`/`KeyD` (bindings `explore-*` de
> `src/state/keybindings.ts` — WASD sur clavier QWERTY, ZQSD sur AZERTY : `code` = position, pas lettre).
> Les **flèches** (`ArrowUp`…) pilotent le SEUL curseur de combat (bindings `cursor-*`). En vue subjective
> (`povActive`), les mêmes touches deviennent cap-relatives (bindings `pov-*`).
> La case d'arrivée n'est PAS un delta de grille fixe : `stepPartyDir` → `exploreStepDest`
> (`src/state/exploreNav.ts`) retient la voisine CONNECTÉE dont le centre est le mieux aligné avec la
> direction ÉCRAN poussée (`screenStepDot`, `src/state/combatCursor.ts`) — le delta `x`/`y` dépend donc de
> la rotation caméra et de la vue. Vérifier le déplacement par la position lue (`__wfrp.state()`), jamais
> par un delta attendu en dur.
> ⚠ **Le `key` du volet Claude_Browser (outil `computer`, action `key`) n'émet pas `event.code`** (mesuré
> 2026-09-04, listener `keydown` : `code === ''`) alors que TOUTE liaison de `src/state/keybindings.ts` est
> keyée sur le `code` physique → passer par Playwright
> (`mcp__plugin_playwright_playwright__browser_press_key`) pour tout déplacement au clavier.

> **Mouvement EN COMBAT au clavier** (piège de recette, mesuré 2026-08-04) : pousser le curseur
> au-delà de l'allonge de Mouvement normal du combattant n'échoue pas silencieusement — la validation
> ouvre la modale de **Course** (Test d'Athlétisme +20). Une recette qui « appuie N fois sur la flèche
> puis Entrée » pour un simple pas peut donc déclencher un JET inattendu (et perdre son état si elle
> l'annule mal). Viser une case DANS l'allonge, ou vérifier `__wfrp.modal()` avant de valider.

## Outillage `__wfrp` (SOURCE UNIQUE du harnais, DEV uniquement, `src/state/devtools.ts`)

Pour piloter le jeu depuis Playwright **sans chasser les coordonnées pixel des tokens**, via
`browser_evaluate`. Cette section liste **TOUS** les helpers de `buildApi()` — un ajout/retrait
côté `devtools.ts` se répercute ICI (source unique, jamais une 2ᵉ liste partielle ailleurs).

### Scène / navigation

| Helper | Usage | Limites connues |
|---|---|---|
| `state()` | instantané `{screen, sceneId, partyPos, inDialogue, inCombat, party, money…}` | lecture seule ; PROJECTION CURATÉE, pas le store : **`state().battle` n'existe PAS** (`devtools.ts` n'expose que `inCombat: !!s.battle`) — pour le combat, lire `battle()` ou `store.getState().battle` ; `party` est une PROJECTION allégée (`{id, name}` seulement, `devtools.ts`) — ni `.skills` ni `.activeEffects` ; pour inspecter le détail d'un héros, lire `store.getState().party` |
| `net()` | vue RÉSEAU du siège local `{mode, mySeat, roomCode, gmSeat, ownership, seatNames, presence}` (`state()` n'expose rien de `net`) | lecture seule (copies) ; `gmSeat` `undefined` = camp ennemi à l'IA ; `presence` n'est peuplée QUE côté hôte. Pour AGIR sur le réseau (héberger, rejoindre, attribuer), passer par `store.getState()` — `net()` n'a aucun effet de bord |
| `entities()` | cartographie des entités de la scène `{id,label,kind,pos,access}` | exclut les entités `hiddenUntilCombat` |
| `screenPos('id')` | bounding box ÉCRAN (`{x,y,width,height}`) du nœud `[data-cid="id"]` | lecture seule. ⚠ **CADUC pour les JETONS depuis le monde volumique** (#1176, C5a ; mesuré en recette 2026-08-14, cf. #1296) : les corps sont peints dans le canevas WebGL et ne portent plus AUCUN `data-cid` (`stage/spritePicker.ts`, `stage/GameStage3D.tsx`) — `screenPos` y rend `null` pour un combattant ou une entité. Restent adressables par ce canal : les STRUCTURES de siège, dont l'arête porte le `data-cid` du Combattant-mur (`stage/AreteOverlay.tsx`, peuplement `state/aretes.ts`) — l'arête est ancrée sur la case du MUR (sa prise suit le lift du mur), et n'est offerte que PENDANT mon tour : hors tour, aucun contrôleur, donc `screenPos` rend `null`. Pour armer le siège d'un coup de main, `quality('id', 'Siège')` pose l'Atout sur l'arme active (table des tricheurs ci-dessous) ; pour vérifier ce qu'un 1er clic a ARMÉ, lire `battle().preview`. En **vue du DESSUS** (#1176, P3-5c), les pions redeviennent du SVG : chaque jeton y porte un groupe `[data-pion-cid="id"]` (et, dans les deux vues, son chrome porte `[data-chrome-cid="id"]`) — ces nœuds-là sont mesurables, et le pion est CENTRÉ sur sa case (viser le centre de la bbox, pas son bas). **Replis** : (a) agir par les BOUTONS réels de l'UI (HUD, ordre de tour, panneaux) ; (b) pour les raccourcis liés à `e.code`, passer par la voie CDP `realKey` (§ manette/clavier) ; (c) pour viser une CASE, `tileScreenPos` (ci-dessous), qui ne dépend d'aucun `data-cid`. Le repère de clic historique reste valable là où un `data-cid` existe : **viser `{x: x+width/2, y: y+height}` (le BAS de la bbox, pied du token)** plutôt que le centre géométrique — une bbox de créature haute est étirée vers le haut, le centre tombe hors silhouette (résidu #199). Port du serveur de dev : celui de `.claude/launch.json` (5191), pas le défaut Vite |
| `tileScreenPos({x,y,z?})` | **un SEUL argument, un OBJET** (`tileScreenPos(tile: { x, y, z? })`, `state/devtools.ts`) — ex. `__wfrp.tileScreenPos({ x: 2, y: 5 })`, ou `{ x: 2, y: 5, z: 1 }` pour un étage. ⚠ **piège mesuré** : `tileScreenPos(2, 5)` (deux nombres) ne lève RIEN — le second argument est ignoré, `tile.x`/`tile.y` sont `undefined` et la bbox rendue est un rectangle de `NaN`, que `browser_evaluate` sérialise en `{"x":null,"y":null,"width":null,"height":null}` : un `null` de forme, pas un « hors scène ». Même bounding box ÉCRAN pour une CASE, vide comprise — projetée par `diamondCorners` (`src/geometry/iso.ts`, la géométrie du rendu) puis passée par la CTM du groupe caméra, donc zoom/panoramique/rotation viennent du DOM | lecture seule ; `null` hors scène ou tant que le stage n'est pas monté. Pour un clic, viser le CENTRE (`{x: x+width/2, y: y+height/2}`) : contrairement à un token, une case n'a pas de pied. Vérifié aux 8 crans de caméra contre `screenPos` du jeton du groupe (écart ≤ 6px sur une tuile de 93px = l'ancrage propre du sprite) |
| `pickTileAt({x,y})` | l'INVERSE de `tileScreenPos` : ce que le PICKING RÉEL résoudrait sous ce PIXEL D'ÉCRAN — `{tile:{x,y,z}|null, cid, via:'sprite'|'decor'|'meuble'|'pas-etage'|'sol'|'aucune', nature:'case'|'combattant'|'entite', geste:{entId?}}`, plus `entId` quand `nature` vaut `'entite'`. **`geste.entId` = l'entité qu'un CLIC à ce pixel traiterait vraiment** (dialogue, marchand, place à s'asseoir) : le verdict dit ce que le pixel FRAPPE, `geste` dit ce que le geste SERT — un PNJ ancré sur la case rend `nature:'case'` (aucun rayon ne nomme un personnage hors combat) et ouvre pourtant son dialogue. Les deux sortent de la fonction que le hook appelle (`stage/geste.ts:entiteDuGeste`), jamais d'une copie : `geste.entId` absent = le clic ne traite aucune entité. La CHAÎNE ENTIÈRE est PARTAGÉE par construction avec le geste (`stage/pickResolve.ts:resoudrePixel`, appelé par `stage/useStagePointer` comme par `stage/pickProbe`) : inversion du pixel (`stage/pickResolve.ts:pointStageSousPixel`) → rayon → meuble dessiné → pas inter-étages → case marchable → sol cross-couche ; la sonde n'a AUCUN étage propre, et la pose qu'elle inverse (projection, caméra du rendu, zoom) est celle que l'hôte a publiée (`stage/spritePicker.ts:CadreRendu`), jamais le store | lecture seule, ne clique RIEN. **L'outil du clic « qui ne fait rien »** : le `via` NOMME l'étage qui a tranché : `'decor'` = le rayon a touché un décor volumique, le clic part sur SA case d'ancrage ; `'meuble'` = aucun rayon ne l'a touché (plateau fin) mais c'est bien la case du meuble DESSINÉE sous le pixel ; `'pas-etage'` = un franchissement vertical voisin du groupe ; `via:'sprite'` avec un `cid` inattendu = un CORPS couvre la case visée (engin 2×2, créature haute) et le clic part sur l'ENTITÉ, pas sur le sol ; `tile:null` = aucune surface résolue à ce pixel (hors carte, ou étage sans surface). Vérifier AVANT de conclure à un bouton/overlay mort, et TOUJOURS relire après un geste de caméra. **Ne rend QUE la bbox de la CASE** : pour viser un CORPS dressé, voir « Cibler un sprite HAUT » (Pièges vécus) |
| `talk('id')` | téléporte le groupe à côté de l'entité + l'interpelle (dialogue/marchand) | rien si l'entité n'a ni dialogue ni marchand ; ⚠ un marchand-PNJ de scène n'a PAS de bande de décor (`ScreenShell` slot `backdrop`) — cette ambiance n'existe QUE par le chemin service-de-lieu (`openPlaceMerchant`, hub de ville) qui la porte en donnée. Ne pas conclure à une régression de décor en interpellant un PNJ |
| `goto('id'\|{x,y,z?})` | place le groupe sur une case (déclenche portes/triggers au pas) | — |
| `screen('menu'\|'party'\|…)` | navigue vers un écran | id validé contre `SCREENS` (`state/store.ts`) — `throw` immédiat + liste des ids valides si invalide (#211 ; avant : routage silencieux, écran blanc, zéro erreur console). ⚠ `screen('interlude')` n'ARME PAS l'interlude : `InterludeScreen` rend `null` sans `state.interlude` (peuplé par `startInterlude`) → écran vide. Utiliser `interlude()` (ci-dessous), pas `screen('interlude')` |
| `levels()` | décompose le rendu multi-niveaux (tuiles/murs/hauteurs par étage) | lecture seule |
| `viewLevel(z?\|null)` | force l'étage ACTIF (`etageActif`) ; sans argument : lit l'override | n'affecte que le RENDU, jamais la logique (LdV/portée restent réelles). ⚠ **portée mesurée** : n'ISOLE l'étage rendu qu'en **vue du DESSUS** — `stage/MondeDeCampagne.tsx` ne filtre `el.cell.z !== activeZ` que sous `planVue` (= `viewPolicy.etageIsole`, vrai pour le seul regard du dessus). En vue **ISO**, les deux couches restent peintes et `viewLevel` ne change RIEN au monde : c'est la loi de dégagement (`clearedSpace`, `builders/roofs.ts`) qui découvre ce qui abrite le groupe. Partout, il reste l'étage que le picking résout par défaut |
| `ascii(z?)` | plan ASCII de la couche (à comparer œil-pour-œil avec l'écran) | `console.log(__wfrp.ascii())` pour l'alignement monospace |
| `fog(on=false)` | brouillard ON/OFF (diagnostic RENDU sans vision) | bascule GLOBALE — remettre `fog(true)` avant de valider un flux de vision réel |
| `ready(timeoutMs=15000)` | **à `await` après `scenario()`, `goto()` ou `campaign()`**, AVANT toute capture : résout quand la scène du store est montée ET son voile d'entrée tombé (`✓ monde prêt — scène « id », voile tombé après N ms`) | REJETTE en NOMMANT le cas (aucun monde monté / scène attendue ≠ scène montée / voile encore levé). La borne par défaut est très au-dessus du plafond d'entrée en scène (`AMBIANCE.entreeEnScene.plafondMs` = 2000) : un dépassement signale un monde qui n'a JAMAIS monté, pas une lenteur. Ne s'applique qu'au monde volumique (aucun voile → aucun signal). ⚠ FAUX POSITIF sur un MÊME id de scène rejoué (`scenario('x')` deux fois) : l'armement du voile est keyé sur `scene.id` (`src/gameIso/stage/GameStage3D.tsx`), le voile ne se relève pas et `ready()` résout pendant la re-cuisson — changer de scénario, ou recharger la page. ⚠ `ready()` n'attend QUE le voile : la fenêtre d'INTRO d'une scène (`pendingCascade`, texte d'ambiance) peut rester ouverte, et `marcheAutorisee` (`src/state/stageWalk.ts`) refuse alors la marche clavier comme le clic-case SANS log ni erreur — `resoudreModales` (`scripts/recette/lib.mjs`, avec son étape) après `ready()`, avant le premier geste joueur (friction mesurée en recette #1362, 2026-09-21) |
| `editorOpen(id?)` | ouvre un document dans l'ÉDITEUR sans la modale « Ouvrir » — donc sans le dialogue de fichier de l'OS, que le pilote ne sait pas fermer. Sans id : les trois familles ouvrables `{projets, campagnes, scenarios}`. Avec id : bascule sur l'écran `editor`, attend le montage, puis ouvre | SETUP seulement. Une campagne built-in s'ouvre en **COPIE** (comme par la modale : `projectId` reste `null`). Rejet nommé si l'éditeur ne se monte pas (3000 ms) ; `✗ « id » introuvable` liste les ids des trois familles |
| `editorEntities()` | INVENTAIRE du BROUILLON ouvert à l'éditeur : `{ id, kind, ref?, pos }` par entité — pour retrouver l'id que l'éditeur vient d'attribuer à ce qu'on a posé à la carte, avant de le passer à `editorPatchEntity` | lecture seule. ⚠ `entities()` lit la scène du STORE DE JEU, PAS le brouillon de l'éditeur : les deux divergent dès la première édition. Même pont et même attente qu'`editorOpen` ; rejet NOMMÉ si l'éditeur ne se monte pas |
| `editorPatchEntity(entityId, patch)` | PRÉPARE l'état d'une entité de la scène OUVERTE à l'éditeur : patch PARTIEL, une clé à `undefined` vaut ABSENTE (`editorPatchEntity('p0', { ref: undefined })` fabrique le « décor sans type » qu'une porte doit refuser). Même voie qu'`editorOpen` : le pont d'INTENTION `state/editeurBridge` (commande `patcherEntite`), jamais une remontée du fiber React de `.editor-inspector` | SETUP seulement — préparer l'état, jamais déclencher le flux mesuré (c'est « Fichier → Exporter JSON » ou « Importer JSON… » qu'on clique ensuite à la main). TROIS refus NOMMÉS : rejet si l'éditeur ne se monte pas (3000 ms, le message porte le helper appelé), `✗ « id » introuvable` listant les ids de la scène, et `✗` sur une clé d'IDENTITÉ (`id`, `kind`) qu'aucun patch ne touche. Le patch passe par le seam d'assise unique (`state/sceneEdit.ts:editEntity`) : il est ANNULABLE (Ctrl+Z) et normalisé comme une édition d'auteur. ⚠ « ABSENTE » vaut au DOCUMENT : en mémoire la clé reste présente à `undefined` (`{ ...ent, ...patch }`, `state/sceneEdit.ts:585`) — `'ref' in ent` rend encore `true`, c'est la sérialisation (`JSON.stringify`) qui la fait disparaître, et le schéma qui la lit comme manquante |
| `projectMinimal(id?, label?)` | rend une entrée de BIBLIOTHÈQUE DE PROJETS (`SavedProject`) minimale et VALIDE — une scène vide (`emptyScene`) enveloppée par `documentDeProjet`, identité d'un projet d'auteur (`MAISON_PROJET_AUTHORE`) : elle passe `parseProject`. Rien n'est écrit | SETUP seulement : la recette la DÉFORME pour son cas (jamais un document recopié du schéma, où un champ oublié — `maison` — fait refuser PLUS TÔT que le refus mesuré), puis la pose par `projectSave` |
| `projectSave(entree)` | POSE l'entrée en bibliothèque par la fonction du même nom (`projectSave`, `state/projectLibrary.ts`) : le cache de `projectsLoad` est mis à jour, AUCUN rechargement de page requis (`✓ projet « id » posé…`, `✗` portant le message de l'écriture en échec) | SETUP seulement. Aucune porte : une entrée déformée se pose telle quelle. Les écrans qui listent les projets (« Ouvrir » de l'éditeur, bibliothèque de campagnes) lisent le cache à leur OUVERTURE (`useState(() => projectsLoad())`) : poser AVANT de les ouvrir, sinon les fermer et rouvrir. Setup et geste tiennent dans UNE session (`restaurerStockage` à `session.close()`, § « Pièges vécus ») |
| `roofCut(on=false)` | lève-toit ON/OFF — `roofCut(false)` débraye le dégagement de la pièce occupée : toits, façades et décors de toit RESTENT peints même quand le groupe entre dans l'empreinte, **hors le disque local de perçage autour de chaque héros** | bascule GLOBALE — remettre `roofCut(true)` avant de valider un flux de vue réel (symétrique de `fog`). Ne débraye QUE le dégagement de PIÈCE : le perçage par occlusion (#1176 M3, `src/gameIso/stage/percage.ts`) reste actif, donc un trou subsiste dans la nappe au-dessus d'un héros qu'elle cache |
| `labels(on?)` | overlay debug de coordonnées sur la carte | bascule ; zéro coût si OFF |
| `visibleCount()` | `{visible, explored, total}` sur l'état VIVANT — cases VUES (`computeStateVisible`, la dérivation du rendu, composée telle quelle), cases EXPLORÉES de la scène courante, cases construites (dimensions × étages) | lecture seule ; chiffre une révélation (cloison qui laisse voir, lampe allumée) sans lire la carte au pixel. ⚠ `fog(false)` force `visible` = `total` (REVEAL_ALL) — remettre `fog(true)` avant de mesurer |
| `walls(structure?)` | arêtes de `scene.walls` : sans argument, un DÉCOMPTE par `structure` (`Record<id, n>`, arêtes nues sous `(sans structure)`) ; avec un id de Structure, la liste `{x,y,z,side,structure,window,door,closed}` | lecture seule ; `closed` n'est rendu que pour une PORTE et vaut son état VIVANT (`doorIsOpen`, flags de scène), jamais le seul champ authoré |
| `go('scene-id', entry?)` | saute vers une scène du projet | scène inconnue → message `✗`, scène inchangée |
| `fight(encounterId?)` | sans argument : liste les rencontres de la scène ; avec id : lance le combat | — |
| `store` | store Zustand brut (`getState`/`setState`) | **dernier recours** (doctrine ci-dessus, §3) — ⚠ **`setState` brut peut CORROMPRE l'état sans récupération** (pas de validation/dérivations liées, contrairement aux actions du store) : un état incohérent après un `setState` direct impose un RELOAD complet, pas un simple retour arrière. `store` = LECTURE (`getState()`) ; toute mutation passe par un helper `__wfrp` ou une vraie action du store (`getState().xxx()`), jamais `setState` à la main sur un flux qu'on valide |

### Combat — lecture / ciblage

| Helper | Usage | Limites connues |
|---|---|---|
| `battle()` | snapshot combat (round, actif, modales, `preview`, combattants une ligne chacun) | lecture seule. `preview` = l'APERÇU ARMÉ brut du store (`BattleState.preview` : `kind`, `path`, `tile`/`targetId`, `cost`…), pas une projection de recette — c'est lui que le 2ᵉ clic commet (`state/targetingModes.ts`, `samePreview`) : un 1er clic qui n'arme pas le geste attendu se lit ICI, avant de conclure à un clic mort |
| `hover('id'\|{x,y}\|null)` | survol PROGRAMMATIQUE (tooltip + réticule sans souris) | requiert le monde de campagne monté (`✗ monde de campagne non monté` sinon) |
| `aim('id')` | vérité state du ciblage pour l'actif (`ok`/`invalid`/`none` + raison, compétence, dégâts) | uniquement en combat |
| `pad('A'\|'B'\|…)` / `padDir('up'\|…)` | simule bouton/direction manette (shim DEV, MÊME chemin que la vraie manette) | requiert le shim `window.__wfrpPad(Dir)` installé (`useGamepad` monté) |
| `padUp('LT'\|…)` / `padDirUp('up'\|…)` | RELÂCHE le bouton/la direction — obligatoire pour tout geste MAINTENU (marche tenue, rotation caméra) | sans lui le geste armé ne s'arrête jamais |
| `modal()` | modale(s) `pending*` ouvertes + actions dérivées | conventions `<flux>Roll/Confirm/Cancel` uniquement (voir doctrine ci-dessous) |
| `roll()` / `confirm()` / `cancel()` | pilotent LA modale ouverte par convention | `✗ aucune modale ouverte` / `✗ pas de flux pilotable` si hors convention |
| `log(n=8)` | dernières lignes du journal (exploration + feed combat) | lecture seule |
| `aiLog(n=50)` | diagnostic IA : action choisie + classement des candidats par tour | `(forcé)` = garde psychologie/RAW hors scoring |
| `auto()` | diagnostic auto-cadence (mode, modale active, `willAutoResolve`, `pending*` ouverts) | pour investiguer un soft-lock, pas pour agir |

**La grille de capacités est PLAFONNÉE** à `RIGHT_CELLS = 12` (`src/ui/CombatConsole.tsx`), sans
défilement : un gros grimoire déborde et ses derniers sorts n'ont aucune alvéole. Pour recetter un
sort précis, réordonner `combatants[].spells` au SETUP (ou passer par le scénario court quand il
existera).

**Flux HORS convention `<flux>Roll/Confirm/Cancel`** (`devDriveModal`/`roll()`/`confirm()`/`cancel()` ne
les couvrent PAS — cliquer les VRAIS boutons) : `pendingCorruption` (Exposition/Seuil de Corruption,
LDB 19) se résout par l'action `resolveCorruption` — bouton **« Continuer »** de la modale
(`src/ui/CorruptionModal.tsx`), jamais `corruptionConfirm` (n'existe pas) ; `pendingCascade` se
résout par `cascadeResolveAll` (bouton **« Tout lancer »**, résout d'un coup le reste sans influence)
puis `cascadeFinish` (bouton **« Terminer »** du bilan) — `cascadeRoll`/`cascadeNext` avancent étape
par étape (bouton « Continuer »/« Terminer » de la dernière étape), cf. `src/ui/CascadeModal.tsx`.

**`pendingTest` seul ne rend RIEN à l'écran** : c'est un slot d'état pur (`store.ts`), consommé en
LECTURE par `useTestJetProps` (`src/ui/jetProps/useTestJetProps.tsx`) — dont `CascadeModal.tsx` est
l'UNIQUE point de montage qui l'appelle. Poser `pendingTest` à la main (`store.setState`) sans que
`CascadeModal` soit monté ne produit donc aucune modale visible (piège du dernier recours de la
doctrine ci-dessus). Raccourci de démo LÉGITIME pour l'armer EN COMBAT (passe par une vraie action du
store, pas un `setState` forgé) : `__wfrp.store.getState().battleGainAdvantage(skillId)`
(`src/state/combatSlice.ts`) — ouvre le `pendingTest` « Avantage — <compétence> » (LDB 09 l.305-308),
à condition que `skillId` soit une Compétence que le combattant actif POSSÈDE (`hero.skills`) et dont
la donnée porte `combatAdvantage` (`SkillData`, ex. `intuition`) ; sinon l'action ne fait rien
(silencieux, cf. gate `skillAdvantageCap`).

**Lancer un sort à cible « Vous »** : une fois focalisé (ou prêt à incanter directement), le
LANCEMENT ne passe PAS par le bouton « Focaliser (X/CN) » — celui-ci (`battleFocusSpell`) ne fait
QUE (re)poser/empiler de la Focalisation, il ne lance jamais le sort. Le lancement effectif passe
par un clic sur le **TOKEN DU LANCEUR lui-même** sur la carte (`castClickCommit`,
`src/state/targetingModes.ts` — le clic-combattant en mode `cast` vise l'allié/ennemi/SOI selon le
token cliqué). Défaut d'affordance joueur ticketé par ailleurs — cette section décrit l'état ACTUEL,
pas la cible d'UX.

### Combat — triche de mise en place

| Helper | Usage | Limites connues |
|---|---|---|
| `spawn(creatureId, pos?, {side?, id?}?)` | instancie une créature du REGISTRE (`creatures.json`) directement EN COMBAT — VRAI pipeline `creatureToCombatant` (`src/state/spawn.ts`, MÊME dérivation que `spawnEnemy`), sans rencontre de scène. `spawn('gobelin')` / `spawn('gobelin', {x:12,y:8}, {side:'hero'})` | `pos` défaut : à côté du combattant ACTIF (sinon 1er combattant positionné) ; `opts.side` (`'enemy'` défaut / `'hero'` / `'npc'`) pose `kind` après coup — `'hero'` marque aussi `aiControlled` (allié PNJ piloté par l'IA, jamais un 5ᵉ héros manuel) ; `creatureId` inconnu → `✗` |
| `turn('id')` | donne le TOUR à un combattant (réinitialise Action/Mouvement) | saute les bornes de Round — mise en place, pas simulation de partie. **Ne DÉCLENCHE PAS l'IA** (mesuré #1135) : positionne l'index de tour SEULEMENT (`battle.turn`), aucune logique de début de tour n'est invoquée — un ennemi conduit par l'IA reste immobile. Enchaîner `fastForward()` pour qu'il agisse. **Ne purge PAS l'armement de fin de tour** (`battle.endTurnArmed`, deux temps « Finir quand même ? ») : rappeler `turn()` sur le MÊME combattant au même Round après un cycle armé→confirmé peut retrouver l'empreinte d'économie de l'armement et afficher « Finir quand même ? » d'emblée — prendre un combattant vierge ou changer de Round (mesuré recette P2-A) |
| `place('id',{x,y})` | téléporte un combattant | **PIÈGE COMPOSITE (corrigé)** : cible une coque à postes (`postes` non vide) ou un membre de `ShipPoste.crewIds` → déplace la FORMATION ENTIÈRE (coque + tout l'équipage des postes) du même delta, MÊME sémantique que la poussée (`pushCommitTile`). Téléporter la coque SEULE désynchronisait aperçu (postes) et portée réelle (équipage resté en arrière) — 30 % du budget d'une recette perdu à débugger ce déphasage avant fix. Retourne `{msg, moved:[ids]}` en cas composite, une chaîne sinon (combattant simple inchangé). |
| `turnShip('id','tribord'\|'babord'\|crans)` | vire le cap d'un navire (triche, sans jet) | ne déplace QUE le cap (`facing`), jamais la position — vérifier ensuite avec `aim()` |
| `maneuver('id', side?, helmsmanId?)` | manœuvre RÉELLE (Test de Navigation, peut échouer) | contrairement à `turnShip`, PEUT rater — pas une triche |
| `killEnemies({withQualityLoot?})` | élimine tous les ennemis + flux de victoire NORMAL | ignore les postes `inert` non `dead` (affûts non visés, LDB — voir `isOutOfAction`) ; `withQualityLoot:true` ajoute à `pendingVictory.gear` un objet CATALOGUÉ à qualités (premier trapping de `trappings.json` avec `qualities` non vide, choisi dynamiquement — MÊME brique `gearFromEffects` que le vrai butin) — NON ajouté si la victoire n'est pas atteinte (cascade de fin de combat ouverte / combat en cours), le message le signale |
| `dealDamage('id', n=5)` | inflige `n` Dégâts à un combattant par le VRAI pipeline (`applyOps` op `wounds` → armure de coque/PA, États, puis `checkBattleOver` : reddition/naufrage/victoire) | combat requis ; éprouve l'issue navale (coule une coque, teste un naufrage) sans jouer chaque tir |
| `combatEnd({heroId?,critical?,corruption?})` | arme les conséquences de fin de combat (Infection/Corruption/Destin) puis LAISSE la cascade ouverte | à conduire à la main (`cascadeRoll`/`Next`) — n'auto-résout rien, contrairement à `killEnemies` |
| `healParty()` | groupe à neuf (PB max, états/critiques/maladies purgés, morts relevés) | ne touche QUE `kind:'hero'` en combat |
| `charge('enemyId', heroId?)` | simule une charge (déclenche `onCharged`, Frappe réactive) | héros cible = le plus proche par défaut. ⚠ **Ni `place()` ni `charge()` n'établissent l'Engagement** (`engagedWith` reste vide) : RAW, seule une VRAIE attaque de corps à corps engage (LDB 13 l.169-175). Une recette qui a besoin d'un Engagement le crée en ATTAQUANT, pas en approchant — ~20 appels perdus à chercher pourquoi l'état n'arrivait pas |
| `quality('id', label?, advantage?)` | ajoute un Atout/Défaut à l'arme ACTIVE + Avantages | ne touche que `weapons[0]` |
| `condition('id', name?, n?)` | applique un État via le VRAI `addCondition` (déclenche les triggers) | — |
| `disease(heroId, maladieId, { phase? })` | contracte une maladie via le VRAI cycle (`contractDisease` + `tickDisease` de l'incubation) ; `phase:'active'` la déclare en avançant son horloge — jamais un état forgé (localisation de cloque, transitions, `infectedMinutes` réels) | `maladieId` inconnu → `✗` ; défaut = phase d'incubation. Ex. `disease('hero-1','crampes-abdominales')` n'existe pas (crampes = SYMPTÔME) → passer par la maladie porteuse (`colique`, `vers-de-carie`, `vers-du-reik`) |
| `bladeTrap(defenderId, attackerId, defSL?)` | ouvre l'étape « Piège-lame » sans forcer un Critique défensif | assigne un `uid` factice à l'arme de l'attaquant si absent |
| `focus('id', spell?, dr?)` | met un combattant en Focalisation (test d'interruption au coup suivant) | c'est aussi le raccourci LÉGITIME de SETUP pour poser un DR de Focalisation ARBITRAIRE sur un sort à CN élevé et sauter le grind multi-Rounds du bouton « Focaliser » (ci-dessous) — pas seulement l'éprouve d'interruption |
| `fear(heroId, enemyId, indice?)` | pose une Peur + simule l'approche de la source | positions requises (`✗` sinon) |
| `talent('id', talentId, opts?)` | octroie un Talent à un combattant — `opts` = `times` (nombre, défaut 1) OU `{ spec?, times? }` pour un talent `specsSource` (ex. `talent('hero-1','magie-du-chaos',{spec:'tzeentch'})` — la spec posée EST l'id lu par `chaosDomainOf`, `engine/combatFeatures/dispatch.ts`) | sans `spec`, un talent `specsSource` reste sans mécanique lisible |

### Groupe / campagne / règles

| Helper | Usage | Limites connues |
|---|---|---|
| `give(gold=10)` / `xp(amount=100)` | crédite la bourse / +PX au groupe | — |
| `giveTrapping(heroId, trappingId, qty?)` | donne un objet de CATALOGUE à un héros (défaut : le 1er), par le VRAI pipeline `giveTrapping` du store (`applyEffects` → `itemFromGive` : item bien formé, qualités du catalogue, rangement/Encombrement recalculés) | `trappingId` inconnu → message `✗` ; `qty` fixe la quantité de l'instance (ex. `giveTrapping('hero-1','boulet-et-poudre',6)` charge le coffre d'un canon) — ⚠ munitions ≠ rations (achat au marchand : la munition d'artillerie/à distance est un article SÉPARÉ des vivres, jamais suggéré à la place) |
| `flags()` / `flag('id', value=true)` | lit/force un drapeau de scénario | — |
| `setMorale(n)` | pose directement `vessel.morale.score` (setup, MÊME patron que `flag()`) | pas le pipeline hebdomadaire (`recalcMorale`) — sert à rendre la désertion à quai (bande ≤75, `moraleBand(score).desertionRoll`) observable sans dérouler des semaines de facteurs ; `✗` sans `state.vessel` |
| `gmSeat(bool?)` | flip du siège MJ SOLO (`setGmSeat`, siège 0) — sans argument : BASCULE | ⚠ **`scenario()` ne RÉINITIALISE PAS le siège MJ** (mesuré #1028 : `net.gmSeat` survit à `setParty`/`startScene`/`loadProject` — seuls `setGmSeat` et la fermeture d'un siège `netSeatClosed` y touchent) : appeler `gmSeat(false)` EXPLICITEMENT entre deux scénarios, sinon le 2ᵉ hérite du siège MJ (ennemis conduits à la main, jets surfacés qu'on croyait auto). La VALIDATION du flux MJ reste la checkbox RÉELLE de l'UI (§ Pièges vécus ci-dessous), ce helper économise seulement la mise en place |
| `time(minutes=60)` / `rest(days=1)` | avance l'horloge / dort N jours par le chemin EAGER | ⚠ **`rest()` n'ouvre AUCUNE modale de nuit** : il route `restParty` → `restFlow.sleepParty`, qui résout la nuit ENTIÈRE d'un coup (triche d'avancement). Le VRAI chemin joueur — la cascade influençable, une étape à la fois — est le bouton « Dormir » de l'auberge/du camp (`restSleep` → `openRestNight` → `pendingRest`) : pour recetter un jet de nuit (Faim, Récupération, Exposition, maladie…), passer par CE bouton, jamais par `rest()`. ⚠ **NE PILOTE PAS non plus une traversée EN MER** : découplé de `travelPlan.sea` (`state/seaVoyageFlow.ts`), il avance l'horloge SANS faire progresser le navire sur sa route (désynchronise `gameTime` du voyage). Pour accélérer une traversée COMMANDÉE, voir « Voyage en mer » ci-dessous |
| `chantier('reparer'\|'carener'\|upgradeId, units?)` | services du chantier naval au port | hors combat, navire de campagne requis |
| `massBattle(ally?, enemy?, rounds?)` | lance une bataille de masse de démo | la scène courante doit porter les rencontres attendues |
| `scenario(id?, seed?)` | lance un scénario de test PRÊT À JOUER ; sans argument : liste les ids | Round 1 déjà acquitté, initiative déterministe SI `seed`. Un id inconnu ou une scène vide JETTENT une `Error` nommée (#1734) : l'id inconnu porte l'id demandé ET la liste des ids ; la scène vide (aucune scène active, ou `scene.entities` à 0) porte son id et son compte d'entités. Un lancement refusé n'écrit RIEN dans la mémoire d'onglet de `resumeLastScenario()` |
| `resumeLastScenario()` | relance le DERNIER `scenario(id, seed)` de CET onglet — id ET seed mémorisés en `sessionStorage` (clé `wfrp.dev.lastScenario`, posée à chaque lancement d'un id connu) : un reload HMR ramène au menu en perdant tout, ce geste rejoue le même scénario à l'identique (#1335) | AUCUNE relance automatique au boot (un rechargement humain doit rendre le menu) ; mémoire PAR ONGLET (un nouvel onglet ne sait rien), et un lancement par le MENU « Scénarios de test » (bouton Lancer, `src/ui/TestScenariosScreen.tsx`) n'écrit RIEN — seul le helper mémorise ; `✗ aucun scénario mémorisé…` sinon. Relance = un vrai `scenario()` : l'état de jeu repart de zéro (progression, siège MJ hérité, cf. `gmSeat`), ce n'est pas une restauration de sauvegarde |
| `campaign(id?, seed?, sceneId?)` | charge une CAMPAGNE BUILT-IN (`builtinCampaigns`, `scenes/campaign.ts`) SANS dérouler le character creator ×4 à la main — groupe canonique (`makeShowcaseParty`), MÊME chemin que le picker `PartyScreen` (`setPendingCampaign` + `loadProject`) ; sans argument : liste les ids | les campagnes built-in ne portent PAS de pré-tirés propres (seul `pregens.json`, libre-service au picker) → groupe canonique (les 4 piliers de l'Arène), pas le casting narratif de la campagne ; `sceneId` (optionnel) démarre ailleurs que l'entrée par défaut — hors des scènes de la campagne, `✗ scène « … » introuvable dans « id » — ids : …` et RIEN n'est chargé (ni groupe, ni scène) ; `pendingCampaign` redevient `null` juste après (comme le flux réel : `loadProject`→`startScene` réinitialise l'état à l'INITIAL hors le sous-ensemble préservé, `store.ts`) — pas une régression. ⚠ **L'ARÈNE N'EST PAS LISTÉE** (mesuré recette 2026-08-29, arbre 5e129a110) : `campaign()` sans argument rend 3 campagnes sur 4 — l'Arène passe par un autre chemin de chargement. CONTOURNEMENTS mesurés : (a) la bibliothèque de campagnes AUX CLICS (menu → groupe → picker), (b) `fight('enc-…')` pour tomber directement dans un combat |
| `interlude(weeks=3)` | arme un INTERLUDE de démo jouable (`startInterlude` — MÊME flux réel : `state.interlude` peuplé, Événement d100/héros, budget `min(3, weeks)`, écran 'interlude') SANS voyager jusqu'à Altdorf | catalogue d'Activités dérivé de la DONNÉE (`interludeCatalog`/`activities.json`), rien d'inventé ; sans groupe chargé, pose le groupe canonique (`makeShowcaseParty`, comme `campaign()`) ; `✗` si combat en cours ; interlude déjà ouvert → message sans réarmer ; à conduire ensuite à la main (Activités, clôture) — pas `screen('interlude')` seul (écran vide) |
| `rules(id?, value?)` | lit/force une règle optionnelle (`policy.ts`) | **ASYMÉTRIE À CONNAÎTRE** : `rules(id, value)` est une surcharge **RUNTIME NON PERSISTÉE** (elle meurt au rechargement), tandis que `rules(id, null)` réinitialise **ET purge la surcharge PERSISTÉE** (`resetHouseRule` → `localStorage['wfrp4.house-rules.v1']`). Une règle cochée un jour au **panneau Options** (seule couture qui persiste, `setHouseRule`) revient donc COCHÉE à chaque ouverture tant qu'elle n'est pas réinitialisée — piège vécu (#1279 : « Jeux de taverne rapides » retrouvée active 3 runs de suite malgré deux `rules(id, false)`). **Vérifier l'état PERSISTÉ en fin de run** : `localStorage.getItem('wfrp4.house-rules.v1')`. La CADENCE n'est plus ici (préférence de confort, cf. `prefs()`) — les règles sont VERROUILLÉES tant qu'un combat est en cours (`houseRulesMutability`) : l'écriture est refusée en silence, et `rules(id, null)` rend alors la raison |
| `prefs(id?, value?)` | lit/force une PRÉFÉRENCE de confort (`state/preferences.ts`) — dont `prefs('combat-cadence', 'auto')` (auto/rapide/manuel) | écriture PERSISTÉE (localStorage) + effet déclaré joué (reprise de boucle) ; `prefs(id, null)` réinitialise ; modifiable EN COMBAT, contrairement aux règles |
| `seed(n)` | re-ensemence le RNG de bataille EN COURS de combat | même action que `scenario(id, seed)` au lancement |
| `previewRoll(seed, count=1)` | lecture PURE des `count` premiers d100 d'un seed — `makeRNG(seed)` À PART, ZÉRO mutation d'état (jamais le `battleRng` du store) | fidèle au PROCHAIN jet réel du store UNIQUEMENT depuis un `seed(n)`/`scenario(id, seed)` FRAIS, avant toute autre consommation — `battleRng` est PARTAGÉ (initiative/dégâts/IA s'intercalent, désynchronisent la prédiction) ; deux previews du même seed renvoient TOUJOURS la même séquence |
| `fastForward(maxIters=400)` | avance les tours IA jusqu'au prochain tour PILOTÉ HUMAIN, à une FENÊTRE à répondre, ou à la fin du combat — MÊME machinerie que la partie réelle, juste sans les délais du Réalisateur | CONTRAT (#1852) : il n'AMORCE un tour d'IA que si personne ne tient la main (aucune fenêtre ouverte, aucune pause de Round) et ne joue JAMAIS deux fois le même tour (jeton de tour dans la machinerie) ; il rend la main en NOMMANT la fenêtre ouverte — `✓ fenêtre « defense » ouverte (à répondre)` : c'est au scénario d'y répondre comme un joueur (clics réels), `fastForward` ne la valide pas. `maxIters` = garde-fou anti-boucle (scrutations, pas des tours) — `✗ borne atteinte…` = soft-lock probable, à diagnostiquer via `auto()` ; retourne une `Promise` (`await`) |
| `fillCreatorDefaults(uptoStep?)` ⚠ résout INTÉGRALEMENT chaque étape traversée — pour observer un état « non soldé », viser l'étape N−1 puis dérouler le dernier cran à la main. ⚠ `browser_take_screenshot` écrit au cwd du process Playwright (racine du repo) même avec un filename relatif : déplacer chaque capture vers le scratchpad JUSTE après la prise, jamais en fin de recette | remplit le brouillon du CRÉATEUR de personnage OUVERT avec des défauts VALIDES (`fillDraftDefaults`, `ui/creator/creatorDefaults.ts`) jusqu'à `uptoStep` incluse (défaut : dernière étape), puis avance l'étape affichée | SETUP UNIQUEMENT (couture `window.__wfrpCreator`, requiert `CharacterCreator` monté sinon `✗ créateur non monté`) — sert à SAUTER jusqu'à une étape sans dérouler tirages/choix un par un ; le flux joueur réel (tirages, choix, allocations) reste testé aux clics, jamais via ce raccourci |

**Doctrine `seed`/`fastForward`** : SETUP et OBSERVATION seulement (même doctrine que le reste de
`__wfrp`, § ci-dessus) — `seed` fige l'aléatoire pour REJOUER une recette à l'identique, il ne
force jamais une issue particulière ; `fastForward` saute le BRUIT des tours IA (temps d'attente
Playwright), jamais l'action du joueur ni un jet du flux qu'on est en train de valider. **Passer un
Round/tour se fait TOUJOURS par `turn()`/`fastForward()`, jamais à la main** (pas de bidouille de
`battle.round`/`order` par `store.setState` — ce sont des recettes, pas le flux testé).

⚠ **`seed()`/`previewRoll()` ne couvrent QUE le RNG de COMBAT** (`battleRng`) : les SÉQUENCES hors
combat (jeux de taverne, poursuite, crises de mer) tirent leurs dés par le même module, mais AUCUNE
n'est ré-ensemencée par `seed()` tant qu'aucun combat n'est ouvert — une recette qui veut rejouer une
partie de taverne à l'identique n'a aujourd'hui aucune prise dessus (mesuré par échec répété,
recette #1279 S2). Corollaire : une branche rare d'une séquence (une plage de dés peu probable) se
recette en la POSANT (option « Dés fixés » → étape à table), jamais en cherchant la bonne graine.

**Recetter un IMPACT garanti (touche, dégâts, FX) : `seed()` + `previewRoll()` AVANT le clic « Lancer »**
(mesuré en recette 2026-08-16, #1335 — ~15 appels perdus à chercher l'impact par des détours de jeu :
« Viser » qui consomme l'Action sans tirer, arbalète à recharger entre deux essais). Méthode : depuis un
`scenario(id, seed)` (ou un `seed(n)`) FRAIS, lire `previewRoll(seed, n)` — les `n` premiers d100 du
même générateur, sans consommer l'état — et ne cliquer « Lancer » que sur un seed dont le PROCHAIN d100
passe sous la Compétence effective lue par `aim('cible')`. On choisit ainsi la graine, jamais l'issue :
le jet réel reste celui du flux joueur. Contrainte à respecter sinon la prédiction ment : `battleRng`
est PARTAGÉ (initiative, IA, dégâts s'intercalent) — re-`seed()` juste avant le jet visé, et vérifier
après coup par `lastRoll()`/`log()`, jamais par une capture.

Les tokens portent `data-cid="<id de l'entité/combattant>"` dans le SVG — COMBAT ET EXPLORATION
(#226) → survol/clic ciblé par sélecteur DOM (vrais clics
Playwright, cf. piège ci-dessous), ou lecture de position via `screenPos('id')`.

### Contenu gaté par une règle optionnelle

Avant de rapporter une **ABSENCE** (une race manquante au créateur, une carrière, une table, un
écran, un événement jamais tiré) : vérifier que le contenu n'est pas simplement gaté par une règle
optionnelle DÉSACTIVÉE par défaut. Le registre complet — id, groupe, valeur par défaut, et ce que
chaque règle change — est dans **`docs/regles-optionnelles.md`** (généré). Y trouver l'id, l'activer
en setup (`rules(id, value)` pour un run, panneau Options pour un état persisté), rejouer le geste,
et ne conclure à l'absence qu'après. Précédent : #1660, « pas de Gnome au créateur » rapporté à tort
alors que `creation-gnome-jouable` vaut `false` par défaut.

### Voyage en mer — accélérer une traversée commandée (recette, #297)

La progression jour par jour d'une traversée EN MER (`runSeaDay`, `state/seaVoyageFlow.ts` — météo,
périls, halte de nuit) enchaîne les jours ; chaque jour est UNE cascade (`pendingCascade`, `purpose:
'travelDay'`) qui se SUSPEND à chaque étape influençable et à chaque halte de nuit (`pendingRest`) ;
elle reprend à la CONFIRMATION de ces étapes/modales, jamais via `time()`/`rest()` (ci-dessus,
`rest()` reste découplé de `travelPlan.sea`).

| Helper | Usage | Limites connues |
|---|---|---|
| `advanceSeaDay({stopOnEveryEvent?, stopAt?, maxIters?})` | symétrique VOYAGE de `fastForward` : pilote la journée EN COURS (cascade du jour, halte de nuit, Activités hebdo si le palier de 8 jours tombe) jusqu'au JOUR SUIVANT — MÊME machinerie que le joueur (`cascadeResolveAll`/`Finish`, `restSleep`, `seaActivitiesConfirm`), sans les clics | s'arrête sur la cascade `travelDay` FRAÎCHE du jour suivant (déjà ouverte, `cursor:0`, pas encore consommée — le PROCHAIN `advanceSeaDay()`/`roll()`/`skipToArrival()` la joue), jamais un `pendingCascade` à `null` ; `maxIters` (défaut 400) = garde-fou scrutations, `✗ borne atteinte…` = soft-lock probable (`auto()`) ; retourne une `Promise` (`await`). **PORTÉE EXACTE de `stopOnEveryEvent:true` (#380)** : il ne s'arrête QUE sur un événement RACONTÉ (carte-parchemin, `travelDay.events` non vide, testé sur `pendingRest`/`pendingSeaActivities`) — **jamais** sur une étape STRUCTURELLE du jour (Progression, choix de Progression, Orientation, Exposition, Entretien…), que `cascadeResolveAll` traverse aux défauts. L'attendre pour observer une étape a coûté un point de recette. Pour CELA : `stopAt:'<kind>'` (#1117) → s'arrête **avant** de résoudre la cascade qui porte cette étape et rend la main intacte (ex. `advanceSeaDay({stopAt:'sea-progression-choice'})`, puis `__wfrp.modal()`/`roll()`). Même option sur `advanceRiverDay` |
| `skipToArrival(maxIters=4000)` | comme `advanceSeaDay` mais ROULE jusqu'à l'ACCOSTAGE (`openPortAt`, `travelPlan` vidé) | s'arrête aussi sur un combat (embuscade/abordage) — `battle` alors ouvert, à jouer/`fastForward` séparément ; `Promise` (`await`) |
| `dealShipDamage(n=5)` | inflige `n` Dégâts de coque HORS COMBAT — VRAI pipeline (`damageVesselHull` si un voyage est en cours sur le navire de campagne, sinon `setVesselHull` directement au port) | symétrique de `dealDamage` (combat) — voir le piège des DEUX copies de coque ci-dessous ; **NE déclenche PAS un naufrage fiable** (voir piège d'ORDONNANCEMENT ci-dessous, `forceShipwreck`) |
| `forceShipwreck(aboardIds?)` | déclenche `beginShipwreck` DIRECTEMENT (setup ASSUMÉ, PAS le pipeline de dégâts) — coque + cargaison purgées IMMÉDIATEMENT, cascade de survie à la nage (Chance/Pacte/Résilience influençable) ouverte pour les héros à bord | `✗` sans `state.vessel` ; voir piège d'ORDONNANCEMENT ci-dessous |
| `clickRoute(routeId)` | calcule un point ON-PATH CLIQUABLE d'une route depuis ici → `{x,y}` ÉCRAN. SONDE `elementFromPoint` au milieu du tracé et, si un décor transparent l'intercepte (chaîne d'ancêtres sans `cursor:pointer`), balaie d'autres fractions de `getPointAtLength` jusqu'à un point cliquable (repli INTÉGRÉ) | ne clique PAS lui-même (le VRAI clic reste `page.mouse.click(x,y)`, Playwright) — remplace le calcul manuel `browser_run_code_unsafe`, voir piège ci-dessous ; `note` indique la fraction retenue (ou qu'aucune n'a testé cliquable → milieu par défaut) ; `✗` si route inconnue/non cliquable d'ici/tracé absent du DOM |
| `forceEncounter(id='navire-hostile')` | force un événement de bord maritime NOMMÉ (`sea-events.json`, id ou kind) au PROCHAIN jour — court-circuite le timer 1d10 + le tirage d100/Manann | à dérouler avec `advanceSeaDay()` : le drive s'ARRÊTE sur la décision présentée (Cogue pirate fuir/combattre/soumettre) sans la trancher — voir doctrine ci-dessous ; `✗` si aucune traversée en cours / événement introuvable |

**Observer le PROCÈS-VERBAL groupé du jour (`MultiRollList`, une bande par rubrique + son enjeu)** —
le PV se lit à `SeaVoyageScreen` (`.sea-voyage-log`) et à `TravelRecapModal`, alimenté par
`travelDay.entries` (une ligne par contributeur, `group` = le libellé de l'étape). Il n'existe qu'une
fois le jour RÉSOLU en route **commandée** (les Tests d'équipage de routine s'auto-résolvent —
`voyageCadence.ts`) : `await __wfrp.advanceSeaDay()` puis lire l'écran de traversée. Pour jouer une
étape d'équipage À LA MAIN avant qu'elle n'entre au PV, s'arrêter dessus par son `kind` — les kinds
RÉELS passés à `buildVoyageCrewStep` (`seaVoyageFlow.ts`, 3ᵉ argument — à ne pas confondre avec le
`testTypeId` du 2ᵉ) sont `progression`, `orientation`, `embuscade`, `phare`, et en crise `poursuite`
ou `tourbillon` :

```js
await __wfrp.advanceSeaDay({ stopAt: 'orientation' });  // rend la main AVANT le Test d'Orientation
__wfrp.modal();                                          // la modale de cascade est intacte
```

`stopAt:'sea-progression-choice'` vise le CHOIX de progression (une étape de décision), pas un Test
d'équipage : pour le Test lui-même, viser `progression`.

**Doctrine `advanceSeaDay`/`skipToArrival`** : même doctrine que `fastForward` — SETUP et
accélération du BRUIT de routine, jamais un raccourci qui saute une décision du joueur. La halte de
nuit est résolue avec les valeurs PRÉ-REMPLIES de la modale (`pendingRest`, lodging/pitance par
défaut) — pour tester spécifiquement un choix de couchage/tambouille, dérouler cette nuit-là à la
main (vrais boutons) plutôt que via ces helpers. Si le scénario propose un départ en **voyage
rapide** (MDG ch.15 l.21-37, `sea.fast` — palier appliqué en un bloc), le choisir AU DÉPART reste la
vraie accélération native du jeu ; il n'est pas rejouable après coup sur une traversée déjà en cours
au pas.

**`forceEncounter` + `advanceSeaDay` s'ARRÊTENT à l'événement PRÉSENTÉ** : un événement de bord qui
ouvre une DÉCISION du joueur (Cogue pirate `navire-hostile` → cascade `purpose:test` fuir/combattre/
soumettre, `openPirateHail`) n'est PAS de la routine — le drive (`advanceSeaDay`/`skipToArrival`)
s'arrête PROPREMENT dessus et le signale (`✓ événement présenté — « … » attend une décision …`),
laissant `pendingCascade` intact pour que le recetteur voie et tranche les 3 choix (jamais un
`defaultChoice` appliqué en silence, jamais l'état vidé sous l'écran). Les choix INTERNES d'une
journée (`purpose:travelDay`) gardent, eux, leur défaut de routine. Dérouler alors la branche au clic
(vrais boutons) ; `advanceSeaDay()` reprend ensuite le voyage.

**Constater une carte-parchemin de ROUTINE** : `forceEncounter()` tire par défaut
`navire-hostile`, un événement DÉCISIONNEL (le drive s'arrête sur la décision, pas sur une carte
racontée). Pour observer une carte-parchemin de routine (`sea.events`, `SeaVoyageBody`), NE PAS
forcer : laisser le tirage d100/Manann jouer et rouler avec `advanceSeaDay({stopOnEveryEvent:true})`
— le drive s'arrête au recap dès qu'un événement raconté vient d'être résolu.

**Piège des DEUX copies de coque** (#296) : la coque « source de vérité » est `state.vessel.wounds` ;
`travelPlan.vehicle` n'en est qu'une COPIE DE TRAVAIL utilisée par `applyOps`/le combat pendant la
traversée. Juste après l'appareillage (`startTravel`/`buildSeaPlan`), `vessel.wounds` peut rester
`undefined` un moment (la copie de travail démarre pleine, la persistance n'a encore rien à écrire) —
lire la coque RÉELLE en cours de voyage via `travelPlan.vehicle.wounds`, PAS `vessel.wounds`, tant
qu'aucun Dégât/jour n'a encore persisté. `dealShipDamage`/`damageVesselHull`/`healVesselHull`
écrivent TOUJOURS les deux (une seule écriture par appel) — jamais un accès `.wounds` direct sur
l'une des deux copies dans une recette.

**Piège d'ORDONNANCEMENT du naufrage** (#332, symétrique du piège des deux copies ci-dessus) : la
garde de naufrage (MDG ch.13 l.674, coque à 0 → `beginShipwreck`) n'est évaluée QU'À L'ENTRÉE de
`runSeaDay` (`state/seaVoyageFlow.ts` : `plan.vehicle.wounds.current <= 0`). Poser
`dealShipDamage(999)` PUIS rouler le jour avec `advanceSeaDay`/`skipToArrival` ne produit PAS
mécaniquement un naufrage : si la Réparation de fortune (ou tout autre applier du même jour) répare
la coque AVANT que `runSeaDay` ne soit re-consulté, les dégâts posés sont EFFACÉS sans que la garde
n'ait eu l'occasion de s'exécuter — la preuve écran #269 est donc mécaniquement impossible avec ce
seul enchaînement. `forceShipwreck()` bypass ce piège en appelant `beginShipwreck` DIRECTEMENT
(MÊME fonction que `runSeaDay`/`checkBattleOver` sur un naufrage réel), sans course contre les
appliers du jour.

## Maladies réactives — trigger `onOwnTestFailed` (Crampes abdominales, MSRC 16)

Les Crampes abdominales (symptôme de `colique` / des Vers) réagissent à **tout Test RATÉ du porteur** :
DR ≤ −2 → *Sonné* ; DR ≤ −4 → Test de **Force Mentale** (palier 2) ou *À Terre* ; DR ≤ −6 → *Inconscient*
(cumulatifs, « ou pire »). Pour recetter : `__wfrp.disease('hero-1','colique',{phase:'active'})` puis faire
échouer un Test (Activité d'interlude, attaque, Parade/Esquive, Test de scène…).

**Cadence-aware** : le sous-Test de FM du palier 2 d'un **HÉROS** s'ouvre en **modale de jet** (cascade en
combat, `pendingTest` de scène en interlude) — pilotable Chance/Résilience, jamais inline ; un **PNJ/auto**
le résout inline. Garde de ré-entrance : ce FM ne ré-émet jamais le trigger (`noOwnTestFailed`).

**Points d'émission de `onOwnTestFailed`** (pour ne pas chercher à l'aveugle) :
- `store.resolveTest` — Test de scène/compétence/combat (chemin modal joueur) ;
- `interludeFlow.confirmActivity` — Activité d'interlude ratée ;
- `combatFlow.applyAttackResult` — l'**ATTAQUANT** rate son jet d'attaque (CC/CT) **et** le **DÉFENSEUR**
  rate sa Parade/Esquive (Test opposé) — le porteur uniquement, pas la défense d'un non-porteur ;
- `triggeredEffects.resolveInlineFlowTest` + `combat/triggeredTest` (inline ennemi/auto) ;
- `cascade.commitStep` (seam CENTRAL des Tests différés d'entretien : `faim`/`recovery`/`diseaseTick`/… ).

**Cadence observée en recette** : après *Lancer*, compter **~2,5 s** avant que *Appliquer* soit stable
(résolution de la défense adverse + animation d'attaque) — attendre cette tempo avant de lire le résultat.
Cette cadence n'est PAS spécifique au combat : **toute résolution de dés animée** (`RollShell` et ses
modales — Test de scène, Activité d'interlude, jet composite…) tourne sur la même animation de dés ;
attendre ~2,5 s après *Lancer* avant de capturer/lire l'état de N'IMPORTE QUELLE modale de jet
(cf. le piège du *closure-sync* ci-dessous).

## Chute du gréement — les 3 gestes (#1508)

Scénario d'id **`chute-du-greement`** (« Chute du gréement (dés à la porte) », section **Naval**).
Il ouvre un combat naval direct : la coque des héros est une cogue (25 m → Taille **moyenne**) portant
l'Amélioration **Nid-de-pie** ; Ott est au gréement, Nissa au nid-de-pie.

```js
__wfrp.scenario('chute-du-greement', 11)   // lancement (combat direct)
__wfrp.prefs('des-fixes', true)            // pour POSER les dés

__wfrp.shipCrit('greement')                // 1. Critique sur la coque des HÉROS (défaut)
// 2. valider l'étape « Critique de navire » (cascadeNext), puis LANCER chaque rangée d'Athlétisme :
//    la bande est une étape à RANGÉES — le verbe est cascadeBatchRoll(idDuTesteur), pas cascadeRoll.
// 3. les étapes de dé de la chute suivent : cascadeDieRoll(id) puis cascadeDieSetForcedRoll(id, v)
```

Mesuré au rejeu (2026-09-06) : Athlétisme `gabier:60 RATE`, `vigie:86 RATE` → étapes
« **Hauteur de chute — Tomber du gréement** » (2d10, unité `m`) puis « **Dégâts de chute** » (1d10),
toutes deux `fixed: true` après pose ; journal « Gabier Ott — Tomber du gréement : chute de **11 m**,
9 Blessure(s) (À Terre). (dé fixé) » — 11 m est la valeur POSÉE, plus un tirage interne.
Depuis le **nid-de-pie**, la hauteur est entière (25 m) : une seule étape.
Coque nommée explicitement : `__wfrp.shipCrit('greement', { hullId: 'cogue-pirate' })`.
Changer de poste sans passer par la fiche : `__wfrp.station('vigie', 'greement')`.

## Dôme — les 3 gestes (#1508 T3)

Scénario d'id **`dome`** (« Dôme — la sauvegarde octroyée par une zone (LDB 47 l.410) », section
**Magie**). Combat direct : Ilyanwe (Haute Sorcière à l'arsenal COURT — 4 sorts posés par la scène, pour
que le Dôme tienne dans les 12 alvéoles de la console) et Berta côte à côte ; un **tireur gobelin** au
loin, ARMÉ d'un arc par la scène (hors du dôme, c'est la condition « provenant de l'extérieur ») et un
**orc** qui vient au contact (sous la voûte, donc hors couverture).

```js
__wfrp.scenario('dome', 11)              // lancement (combat direct)
// 1. Ilyanwe a un arsenal COURT (4 sorts, en donnée de la scène) : chaque sort est SA PROPRE alvéole
//    de la console (`sort-<id>`, libellé = le nom du sort) — il n'existe aucune entrée « Sorts ».
//    Cliquer l'alvéole « Dôme » ouvre DIRECTEMENT la modale d'Incantation (aucun ciblage préalable) ;
//    après « Lancer », le bouton devient « Poser la zone » → CLIQUER SA PROPRE CASE (Portée « Vous »,
//    gabarit 3×3 annoncé par la modale). Le sort est NI 7 : un jet moyen rend DR 4 (« Réussite trop
//    faible ») — prévoir jusqu'à 3 clics de « Chance : +1 DR » pour le poser.
//    Grimoire manquant ? __wfrp.spell('sorciere', 'dome') MÉMORISE le sort (il ne le lance pas).
// 2. l'aura se pose ; la ZONE se dit UNE fois, sur la ligne du lanceur — « Ilyanwe érige un dôme sur
//    N m de diamètre : il octroie Protection (6+) contre les attaques magiques ou à distance venant de
//    l'extérieur » ; chaque autre couvert n'a qu'une ligne courte (« Berta est sous le dôme : … »).
//    L'Indice vient de la DONNÉE de l'op ; la ZdE, de la ligne « Cible » du sort (un seul endroit).
// 3. laisser le TIREUR gobelin tirer sur Berta : CHAQUE coup reçu SUSPEND la résolution et ouvre une
//    ÉTAPE DE DÉ « Sauvegarde » (1d10) dans la cascade, AVANT toute perte de PB — la modale nomme le
//    porteur en sous-titre (avant le lancer COMME après, `stepSubtitle`) et la rangée annonce son seuil
//    « ≥ Protection (6+) du Dôme » AVANT le lancer.
//    « Lancer » (ou poser le dé) → la rangée devient « 6 ≥ … » / « 5 < … », puis « Terminer » applique
//    la suite (Blessures, Critique si double). Le PANNEAU « Journal de combat » écrit
//    « Berta ignore le coup — sauvegarde 1d10 : 6 ≥ Protection (6+) du Dôme. » — ou RATÉE —
//    « Berta n'ignore pas le coup — sauvegarde 1d10 : 5 < Protection (6+) du Dôme. » Jamais rien.
//    Le BANDEAU (toast) ne reprend que les temps forts (`attack`/`shoot`…) : il montre donc ENCORE la
//    ligne d'attaque « … : N dégâts − M = K Blessures », qui annonce des Blessures ne tombant PAS quand
//    le coup est ignoré — défaut de forme connu et ticketé (#1740) : lire l'issue sur la ligne de
//    sauvegarde, jamais sur celle du coup.
//    Le tireur porte **Tir rapide** (`creatures.json` › `archer-gobelin`, talent `tir-rapide`) : il tire HORS de
//    l'ordre d'Initiative à l'ouverture d'un Round (`runPreemptShots`, `confirmRoundStart`), son tour
//    normal étant alors épuisé. Le combat s'ouvre donc sur un tir gobelin DÉJÀ résolu (relevé
//    2026-09-14 : Ilyanwe à 15/18 avant le geste 1), et chaque ouverture de Round peut apporter une
//    étape de sauvegarde de plus — en tenir compte dans le budget de clics de la recette.
//    Puis laisser l'ORC frapper au contact : AUCUNE ÉTAPE de sauvegarde et AUCUNE ligne (le dôme ne
//    couvre pas la mêlée).
```

Ce qui se lit à l'écran : le Trait qui a **réellement** sauvé est nommé (jamais un
« Démoniaque/Protection » à deviner). **Deux graphies RAW cohabitent, et c'est le livre qui les
sépare** : le STATBLOC écrit `Protection 6+` (`LDB 84 l.28` — puce de Trait du Codex, `grantTrait`,
`formatTrait`), la PROSE d'un sort écrit `Protection (6+)` (`LDB 47 l.410` — journal de sauvegarde,
`op.domeWard`, humanize, résumé d'op, `formatWardSave`). Ne pas « uniformiser » l'une sur l'autre.

**Poser le dé de sauvegarde** : l'option « Dés fixés » vit dans ☰ → **Options** → onglet **Confort**
(case à cocher du registre `PREFERENCES`, persistée ; `__wfrp.prefs('des-fixes', null)` la remet). Elle
allumée et le siège tenu, l'étape « Sauvegarde » offre son champ « Fixer le dé » (1-10, Entrée valide) à
côté de « Lancer » ; la ligne de journal porte alors « (dé fixé) ». A11y de l'étape : Tab atteint
« Lancer », Entrée lance.

Rejeu MOTEUR (headless) de ces trois gestes : `src/scenes/test-scenarios/22-dome.test.ts` — l'aura est
posée par le VRAI lancer (`applyCast`), le tireur TIRE dès son premier tour, le TIR ouvre son étape de
sauvegarde (suspension AVANT toute Blessure), la MÊLÉE n'en ouvre aucune. Les contrats du socle sont
ailleurs : la porte qui suspend et rend la main (`src/state/combat/sauvegarde-a-la-porte.test.ts`,
`pousserSauvegarde`), la lecture en seuil du dé (`src/state/cascade-seuil.test.ts`, `lireEnSeuil`).

Hors combat, la fiche (**Magie & Foi**) garde ses boutons « Lancer » / « Focaliser » ; **pendant** un
combat ils sont gatés, avec leur raison au survol (« En combat, les sorts se lancent depuis la
console. ») — les verbes `ooc*` sont des lanceurs HORS combat et ne produisaient rien au clic.

## Pièges vécus (corrections d'expérience)

- **Un setup de stockage posé dans une session PRÉCÉDENTE est défait** (vécu 2026-09-22, recette #1343) :
  `openApp` instantané les stockages et `restaurerStockage` les remet à `session.close()` — un projet
  écrit en bibliothèque dans un premier script a disparu au second. Setup (`__wfrp.projectSave`) et
  geste mesuré tiennent dans UNE seule session.
- **Un décor de FAÇADE ou de TOIT devient invisible dès que le groupe entre dans l'empreinte de la
  masse** (vécu 2026-09-01, recette #1478) : le lève-toit dégage la pièce occupée, et il emporte les
  décors ancrés au toit et aux façades — on croit à un décor absent ou mal ancré. Le juger avec
  `__wfrp.roofCut(false)`, puis remettre `roofCut(true)`.
- **Après `goto()` ou un scénario, `await __wfrp.ready()` AVANT toute capture** (même recette) : sans
  cette attente, le cliché fige le voile d'entrée en scène (« Chargement... ») ou un monde à moitié
  cuit — et le défaut qu'on croit voir est celui de la capture, pas du rendu.
- **Un clic sur la carte fait PERDRE le focus clavier sous Playwright/CDP** (même recette) : le
  raccourci frappé juste après part dans le vide. Pour déplacer le groupe, `__wfrp.goto()` plutôt
  qu'un clic suivi d'une touche.
- **`tileScreenPos` rend des coordonnées du VIEWPORT RÉEL, pas du screenshot** (même recette) : une
  capture mise à l'échelle (facteur ×0,5 fréquent) n'a pas le même repère — ne jamais pointer une
  case en lisant des pixels sur l'image ; cliquer aux coordonnées rendues par le helper.
- **L'id d'un scénario n'est pas l'id de sa SCÈNE** (même recette) : le scénario de la diligence est
  `diligence`, `la-diligence` est l'id de scène — `__wfrp.scenario()` sans argument liste les ids
  valides, et un id inconnu jette nommément.
- **Compendium/Atelier : ouvrir le `<summary>` du groupe AVANT de cliquer la sous-catégorie** (vécu
  2026-09-05, recette #1508 — 5 essais perdus) : les rubriques sont des `<details>` repliés, et un clic
  sur une sous-catégorie encore masquée ne porte pas. Ouvrir le groupe, relire la bbox, puis cliquer.
- **Menu système : `Escape` ne ferme pas depuis un sous-écran des Options** (vécu 2026-09-14, recette
  #1508) : depuis un onglet des Options, un premier `Escape` ramène bien au menu racine ; un second
  `Escape` n'y fait rien — sortir par « Reprendre ». Friction clavier relevée, pas un comportement
  voulu : ne pas la contourner en silence dans un scénario, la signaler.
- **Les heredocs du shell mangent un antislash** (même recette) : `<<'EOF'` a rendu `\\` en `\` et cassé
  des scripts de sonde. Écrire les scripts de recette par `Write`/`ctx_patch`, jamais par heredoc.
- **Le délai d'amorçage de l'app est RÉGLABLE** : l'option `timeoutMs` du kit
  (`scripts/recette/lib.mjs`, passée à l'ouverture de l'app ou de la session ; défaut 10 s, inchangé)
  — sur machine chargée, trois passes ont été perdues sur ce seul plafond.

- **Une position d'écran se relit JUSTE AVANT le clic, après tout geste de caméra** (vécu 2026-08-23,
  recette des pastilles d'entité) : `turn()` (et tout recentrage : ouverture de combat, focale sur
  l'actif, cran de molette) fait PANNER la caméra, et le pan converge hors React — une bbox lue avant
  le geste vise une case qui a bougé depuis. RÈGLE : `tileScreenPos`/`screenPos` se rappellent
  entre le geste de caméra et le clic, jamais mémorisés d'une étape sur l'autre. Corollaire pour les
  pastilles d'entité : leur panneau-paramètre se FERME dès que la caméra bouge (l'ancre glisserait
  sous lui) — rouvrir la pastille après un `turn()`, ce n'est pas un bug.

- **Cibler un sprite HAUT en rendu volumique : viser au-dessus du sol, PUIS vérifier l'occlusion DOM**
  (mesuré recette 2026-08-28, arbre ff8322e18) : le couple `tileScreenPos` + `pickTileAt` ne connaît que
  la bbox de la CASE ; un corps dressé (créature haute, héros) occupe l'écran AU-DESSUS d'elle. Viser
  `y − hauteur_sprite` et, si le premier essai retombe au sol (`via:'sol'`, ou un `cid` autre que la cible),
  SCANNER vers le haut par pas de ~5px jusqu'à ce que `pickTileAt` rende le `cid` attendu — un seul essai
  au centre de la case fait conclure à tort au « clic mort ». Second piège, indépendant : `pickTileAt`
  ignore l'occlusion DOM ; le point retenu peut tomber SOUS le dock de compétences, et le clic atterrit
  sur le dock EN SILENCE (aucune erreur, aucun effet sur la scène). RÈGLE : `document.elementFromPoint(x,y)`
  AVANT le clic réel, et reprendre le scan si le nœud résolu n'appartient pas au canevas de scène.
  (Helper à venir : #1543, spriteScreenPos.)

- **Listes LONGUES du Compendium/Codex sous Playwright-MCP : les refs d'accessibilité deviennent STALE**
  (mesuré recette 2026-08-28, arbre ff8322e18 — 576 sorts, 490 créatures) : sélectionner une entrée
  re-rend la liste côté React, et TOUTE ref mémorisée au snapshot précédent pointe alors dans le vide
  (échec d'interaction ou, pire, clic sur l'entrée voisine). RÈGLE : retrouver l'élément à chaque geste par
  une boucle sur `textContent` (comparaison sur la valeur `trim()`ée), jamais par une ref conservée d'un
  tour sur l'autre. **Vaut AUSSI pour les GROUPES REPLIABLES (accordéons) du Codex** (mesuré recette
  2026-08-29, arbre 5e129a110) : replier/déplier un groupe invalide les refs de ses FRÈRES, pas
  seulement celles de son propre contenu — le re-rendu ne se limite pas au groupe manipulé. Même
  parade : retrouver par `textContent` après chaque pli/dépli.
  **Vaut aussi pour tout écran qui se RE-REND à chaque geste — créateur de personnage, atelier du
  Codex** : chaque tirage, choix ou saisie remonte l'état et rebat les refs de la page entière, pas
  seulement celles du contrôle touché. RÈGLE : viser par SÉLECTEUR STABLE — rôle + nom accessible, ou
  rôle + rang (`nth`) quand le nom n'est pas unique — jamais une ref de snapshot conservée d'un geste
  au suivant.

- **`browser_snapshot` sur le Compendium : JAMAIS un snapshot RACINE** (mesuré recette 2026-08-28, arbre
  ff8322e18) : la liste à plat produit 104 000 caractères d'un coup — le budget de la recette part dans
  l'arbre d'accessibilité. TOUJOURS passer `target:<ref du panneau de détail>` (le détail est ce qu'on
  juge ; la liste se pilote au texte, cf. piège précédent).

- **Le BRIEFING d'entrée de scène avale tous les clics** (vécu 2026-08-10, recette du lacet continu —
  2 h perdues) : toute entrée de scène avec `startMessage` pousse une étape d'AFFICHAGE
  (`pushReveal` `sceneEntry` → `CascadeModal`, bouton « Terminer »), qui est une modale bloquante :
  la carte devient inerte (`modalBlocksMapHover`) et les boutons de l'écran de jeu sont sous son voile.
  Un clic « qui ne fait rien » juste après un `scenario()`/une transition N'EST PAS un bug de câblage.
  RÈGLE : FERMER le briefing (« Terminer ») AVANT toute mesure de clic, et le vérifier au DOM
  (`document.querySelector('.modal-overlay')` nul) plutôt que de conclure à un bouton mort.
- **Les modales du jeu sont des `<div role="dialog">`, jamais la balise `<dialog>`** (mesuré recette
  #1279 S2) : un sélecteur `dialog` ne trouve RIEN et fait conclure à tort qu'aucune fenêtre n'est
  ouverte. Cibler `[role="dialog"]` (ou `.modal-overlay` pour le voile).
- **Occlusion de la carte du monde sur le panneau latéral** (vécu 2026-08-05, recette 3) : sous 901px
  de large, la mise en page EMPILE carte et panneau ; `.map-canvas-frame` porte un `aspect-ratio` et
  débordait de sa cellule, son SVG recouvrant les commandes du panneau (« Rythme normal / Forcer +1 M »
  injoignables — `elementFromPoint` résolvait sur un `path`/`rect` du canevas). Corrigé #1117
  (`.worldmap-canvas` borne son contenu). **La recette précédente avait RÉUSSI le même clic** : elle
  tournait au-dessus de 901px, où les deux colonnes séparent les surfaces — d'où deux verdicts opposés
  sur le même bouton. RÈGLE : un clic qui échoue se DIAGNOSTIQUE d'abord à `document.elementFromPoint`
  (centre + 4 coins), et la LARGEUR de fenêtre se note au rapport — un test de clic sans viewport
  déclaré n'est pas reproductible.
- **`forceRiverCapsize` arme ET reconstruit la journée** (#1117) : le clic « Partir » construit les
  étapes du jour de façon SYNCHRONE — armer le vent après coup ne changeait rien (2 essais sur 3
  perdus en recette 4). Le helper reconstruit désormais la cascade du jour en cours ; `__wfrp.riverDayCascade()`
  la (re)pose seule et rend ses étapes, pour ne pas rejouer achat/carte/départ à chaque essai.
- **Zoom de la carte, panneau de route OUVERT — DÉFAUT OUVERT (#1117)** : à ~850×900, panneau ouvert,
  `elementFromPoint` au centre et aux 4 coins de « Zoomer » rend `ASIDE.worldmap-side`. Deux pistes ont
  été éliminées par la mesure : l'ordre d'empilement (le cadre carte isole déjà, `.wm-zoom` porte son
  `z-index`) et un aside COLLANT — il ne l'est pas : l'écran compose `Split side="end" align="stretch"`
  sans `sticky`, et `world-meta.css` pose `position: static` ≥901px (garde `WorldMapView.test.tsx`). La cause restante est GÉOMÉTRIQUE et se mesure au
  navigateur, pas au CSS : relever `getBoundingClientRect()` de `.worldmap-canvas`,
  `.map-canvas-frame`, `.wm-zoom` et de l'aside, plus leur `position`/`transform`/`margin` calculés,
  et joindre les 4 rectangles au rapport. Sans ces rectangles, tout nouveau correctif est un pari.
  L'`aside` ne s'ouvre qu'avec une route SÉLECTIONNÉE : recetter aussi à ~360px.
- **Toutes les routes de barge ne sont PAS une descente JOUÉE** (#1117) : la cascade jour-par-jour
  fluviale exige QUATRE conditions (`travelFlow.startTravel` → `buildRiverPlan`) — la route porte
  `river: true`, le mode choisi est une EMBARCATION, une coque existe, et le groupe compte un
  batelier (`hasBatelier` : Voile ou Ramer avancé). L'une manque ⇒ repli sur le transport payant
  (« on paie un passeur »), résolu en NARRATION, sans aucune cascade ni jet. Dans le scénario
  « Commerce fluvial », une seule route la porte : **`r-grunburg-altdorf` (Grünburg → Altdorf,
  45 km)** ; les maillons courts de 30 km de la chaîne du Reik n'ont pas `river: true` et se
  résolvent donc en narration. Recetter la navigation fluviale sur CE trajet, jamais sur un maillon.
- **L'interactivité des étapes du jour dépend du MODE de traversée** (#1117) : seul « Jour par jour »
  monte les étapes de `travelDay` en modale ; en traversée rapide elles se résolvent sans surface.
  Une recette qui ne voit « aucune modale » doit d'abord vérifier le mode choisi au départ.
- **Scénario « Voyage maritime » : la traversée démarre en Violente tempête persistante** (recette 3) —
  `kmDone` reste figé tant qu'elle dure (voiles affalées), donc ni progression ni survitesse à observer.
  Armer d'abord un vent calme (`__wfrp.forceSeaWeather({ vent: 'calme-plat' })` puis le cran voulu, ou
  dérouler les jours jusqu'à la levée du verrou météo) AVANT de recetter la Progression, la survitesse
  ou l'Orientation. Sans ça, le rapport conclut « rien ne bouge » sur un état de mer parfaitement RAW.
- **Le « Lancer » d'une cascade n'est pas celui de la rangée** (même recette) : quand une seule rangée
  est lançable, `RollShell` HISSE le bouton dans sa barre d'actions et lance lui-même. Un fix posé sur
  le CTA de rangée peut donc être vert en test et mort à l'écran. Viser le bouton de la BARRE
  (`.modal-actions`) pour recetter une cascade, et se souvenir qu'un même verbe peut avoir deux hôtes.

- **« Tout lancer » n'est PAS « Lancer »** (vécu 2026-08-05, a coûté la moitié d'une recette) : dans
  une cascade, la barre porte « Lancer » (la ligne COURANTE, influençable) et « Tout lancer » (TOUTE
  la séquence restante, résolue d'un coup, SANS aucune modale ni influence). Cliquer le second par
  réflexe brûle la scène qu'on venait recetter — et rien ne le rejoue. Depuis #1117 les deux ne se
  ressemblent plus (`all`/`rollAll` sont des rôles SECONDAIRES dans `RollShell`, le primaire reste le
  jet de la ligne) ; en recette, viser le bouton par son NOM accessible exact (« Lancer »),
  jamais par sa position.
- **Un champ « Fixer le dé » par LIGNE** (même recette) : chaque rangée offre le sien. Ils portaient
  le même nom accessible → le geste (clavier comme automate) visait au hasard et la frappe partait
  ailleurs, le jet tombant en aléatoire. Le nom accessible porte désormais sa ligne
  (« Fixer le dé — Voile ») : le cibler ainsi, et vérifier la valeur du champ AVANT d'appuyer Entrée.
- **Popover Codex resté ouvert par-dessus le CTA** (même recette, vécu 3 fois) : un popover de chip
  affiché (survol/focus) recouvrait « Continuer » et interceptait le clic ; Échap semblait inopérant
  (il refermait puis le re-focus le rouvrait aussitôt). Corrigé #1117 — si le symptôme revient :
  Échap, puis cliquer une zone neutre, et le SIGNALER (c'est une régression, pas une fatalité).

- **Retour-menu SILENCIEUX en pleine partie = arbre PAS gelé, pas un bug** (vécu 2026-07-11,
  3 reloads pendant une recette, zéro erreur console/collecteur) : Vite sert le WORKING TREE — un
  agent/une session qui écrit sous `src/` (ou dont la suite régénère un registre `gen-registry`)
  déclenche un HMR/full-reload qui ramène au menu et PERD la progression. Règle : une recette exige
  l'arbre GELÉ — AUCUN agent concurrent (même « scripts/docs seulement » : leurs suites régénèrent
  du `src/`). Si ça arrive : `git status` avant de blâmer le code.
  **CONTRÔLE EXÉCUTABLE, AVANT de démarrer** (mesuré recette 2026-08-29, arbre 5e129a110 : 4 reloads,
  ~25 appels perdus — retour-menu, état de combat perdu) : `git diff --stat -- src/` doit rendre
  VIDE. Non vide = une session concurrente édite `src/` → STOP et attendre qu'elle commite ; ne pas
  lancer la recette « en espérant ». La règle « arbre GELÉ » existait en principe : cette commande la
  rend vérifiable avant le premier clic, pas après le troisième reload.
- **Refs Playwright PÉRIMÉES après un `await`** : après tout `await __wfrp.xxx()` (ou tout clic qui
  déclenche de l'async), RE-SNAPSHOTER avant de cliquer — jamais réutiliser une ref d'un snapshot
  antérieur (échec « ref not found » sinon).
- **Coordonnées ÉCRAN périmées sur le stage — même famille que les refs ci-dessus** (vécu recette
  P3-5c, 2026-08-17) : en vue du dessus la caméra SE RECENTRE sur le combattant actif à chaque
  changement de tour, et le zoom recadre (`src/gameIso/stage/useStageCamera.ts` : le décalage manuel
  est annulé quand l'unité active change). Un rectangle relevé avant une action async vise donc du
  vide. RÈGLE : relire `getBoundingClientRect()` JUSTE avant chaque clic sur la carte, jamais
  réutiliser une coordonnée calculée plus tôt.
- **Rotation caméra : un appui bref ne se VOIT pas — y compris sur la caméra de JEU** (recettes
  2026-09-21, train B) : une frappe dont l'appui reste sous `SEUIL_MAINTIEN_MS` (250 ms,
  `src/state/stageYaw.ts:47`) ne vaut que `PAS_TAP_DEG` = 2°, imperceptible sur une capture. Une
  rotation NETTE demande le régime de MAINTIEN (`VITESSE_LACET_DEG_S` = 100°/s) : deux appels
  `realKeyDown` / `realKeyUp` du kit CDP, séparés d'une attente réelle — c'est la même règle qu'en
  POV et à l'éditeur, et elle vaut pour Q/E du monde de jeu. Le `keyboard.down`/`up` de Playwright
  s'est révélé fragile pour ce geste tenu (échec silencieux : aucune rotation, aucune erreur) ;
  vérifier l'angle obtenu entre chaque geste plutôt que de le supposer.
- **Le bouton de bascule de vue nomme sa DESTINATION, pas l'état courant** (même recette) :
  « Vue du dessus » affiché ⇒ on est en ISO (`src/ui/ViewControls.tsx`). L'état RÉEL est dans
  l'`aria-pressed` de SON bouton — jamais dans un `[aria-pressed]` NU : la barre de vues en porte
  PLUSIEURS (projection, POV, inspection — `ViewControls.tsx:68`, `:79`, `:92`), et le premier trouvé
  n'est pas forcément celui de la projection. Le désigner par l'`aria-label` de son bouton
  (`[aria-label="Vue du dessus"][aria-pressed]`), comme pour tout contrôle de cette barre.
- **EN JEU, aucune barre de vues** (relevé en recette #1343, 2026-09-22) : `ViewControls` n'est monté
  qu'à l'éditeur (`src/ui/editor/EditorCanvas.tsx`). La bascule ISO ⇄ dessus du monde de jeu est un
  RACCOURCI — binding `toggle-view`, muet en POV — à frapper par `realKey` ; la SOURCE des bascules
  d'affichage et de leurs touches est `src/state/keybindings.ts` (section `camera`), jamais ce doc.
- **Une ref de snapshot ne se passe JAMAIS sous la forme `ref=xxx`** — deux formes selon l'outil qu'on
  tient, à vérifier au premier appel plutôt qu'à l'aveugle :
  - outil MCP qui prend un **paramètre `ref` dédié** (mesuré en recette 2026-08-16, #1335) : la valeur
    est la ref NUE telle que rendue par le snapshot (`"f2e2626"`) — écrire `"ref=f2e2626"` fait échouer
    le clic ;
  - outil MCP générique qui prend un **sélecteur** : `ref=e123` est rejeté (« Unknown engine "ref" »),
    la forme acceptée est `aria-ref=e123`.
- **Faux `TimeoutError` APRÈS un `browser_click` réussi** (mesuré #1135, ~15 clics sur 15) : sur les
  boutons de modales de combat (« Tout lancer », « Lancer », « Appliquer », tokens de la carte),
  `browser_click` lève systématiquement `TimeoutError: 5000ms exceeded` — sa vérification de
  stabilité post-clic ne converge pas sous les re-renders/animations du jeu, mais **le clic EST
  passé**. Ne PAS re-cliquer (un re-clic aveugle double l'action : deux jets, deux applications) :
  après le timeout, re-snapshoter ou évaluer l'état (`browser_snapshot` / `__wfrp`) et poursuivre
  depuis ce qu'on mesure.
- **`browser_resize` seul ne rend PAS le pointeur grossier** : la largeur change,
  `matchMedia('(pointer: coarse)')` reste `false` — toute mesure de cible tactile faite ainsi juge le
  mode fin. Émulation mesurée (recette 2026-08-07), nettoyage compris :
  ```js
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 560, height: 900, deviceScaleFactor: 1, mobile: true });
  // … mesures …
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: false });
  ```
  Au socle `scripts/recette/lib.mjs`, les mêmes commandes CDP passent par `session.rpc(...)`
  (`setViewport`/`emulateReducedMotion` en usent déjà).
- **Activer le siège MJ en SOLO** : menu ☰ en jeu → case « Contrôler aussi les ennemis / le monde
  (MJ) » (`GmSoloToggle`, `src/ui/CoopPanels.tsx`) — observable via `__wfrp` : `net.gmSeat` non nul.
  `__wfrp.gmSeat(true/false)` pose/retire le siège en SETUP (évite les clics répétés à chaque
  scénario) — la VALIDATION du flux reste la checkbox RÉELLE. ⚠ Le siège **PERSISTE d'un `scenario()`
  au suivant** (mesuré #1028) : le lancement ne touche pas `net.gmSeat`. Le remettre à zéro à la main
  (`gmSeat(false)`) avant toute recette qui suppose le mode solo — sinon les ennemis restent conduits
  par le MJ et leurs jets s'ouvrent en fenêtre au lieu d'être roulés par l'IA.
- **L'IA ne joue pas l'action qu'on attend** (mesuré #1042) : sur `turn()`, un ennemi lanceur peut
  très bien attaquer au lieu d'incanter — sa décision suit sa situation tactique, pas le besoin du
  recetteur. Attendre une incantation ennemie en relançant des tours est un puits de temps. Pour la
  déclencher de façon DÉTERMINISTE : `gmSeat(true)` puis jouer l'incantation AUX CLICS (l'ennemi
  devient conduit à la main) — et `gmSeat(false)` une fois la fenêtre observée.
- **Champ CONTRÔLÉ React : `evaluate()` + `.value = …` est SANS EFFET** (vécu #1028, ~8 appels
  perdus) : poser la valeur d'un `<input>` contrôlé depuis `browser_evaluate` écrit dans le DOM sans
  déclencher le handler React — l'état ne bouge pas, le champ se ré-affiche à sa valeur d'avant, et
  le jet part avec un VRAI d100 alors qu'on croyait l'avoir fixé (« Fixer le dé » `ForcedRollPicker`,
  et tout formulaire de l'éditeur/du créateur). Utiliser la SAISIE RÉELLE : `typeInField` du socle
  (`scripts/recette/lib.mjs`), `browser_type` / `.fill()` Playwright — toutes émettent les événements
  que React écoute. Contrôle : relire le champ APRÈS la frappe (`typeInField` rend cette valeur) —
  s'il est revenu à l'ancienne valeur, rien n'a été posé.
- **Calibrer une issue déterministe d'opposition (« Dissipé ! », « Résiste ! »)** : fixer le dé du
  RÉPONDANT ne suffit pas — une opposition compare deux DR, donc il faut AUSSI fixer le jet du
  LANCEUR à un DR faible (dé haut, sous sa cible). Sinon l'incantation peut être hors de portée du
  contre-lanceur (DR lanceur > DR max atteignable) et le « Dissipé ! » reste inaccessible quel que
  soit le dé du répondant. Ordre pratique : fixer le dé du lanceur AVANT de lancer, puis celui du
  répondant dans sa rangée.
- **Module Vite PÉRIMÉ après un fix** (vécu 2026-07-09, faux « PAS CORRIGÉ » sur un P0) : le
  watcher Vite sous Windows peut RATER une écriture de fichier (agent/git) — le serveur sert alors
  l'ancienne transformation même après un reload complet. Symptôme : la stack console cite des
  numéros de ligne de l'AVANT-fix ; preuve : le `?t=` de l'URL du module (`travel.ts?t=…`) est plus
  vieux que le fix. Remède : toucher le mtime du fichier (`(Get-Item f).LastWriteTime = Get-Date`)
  puis recharger — vérifier le `?t=` AVANT de conclure qu'un fix ne marche pas. Corollaire : la
  console MCP est un buffer PARTAGÉ entre sessions/onglets — `all:true` peut remonter les erreurs
  d'une session PRÉCÉDENTE ; après un clic sensible, lire la console IMMÉDIATEMENT et depuis la
  dernière navigation, jamais en fin de parcours.
- **Captures d'écran** : le dossier d'atterrissage DÉPEND du serveur Playwright MCP — souvent
  `.playwright-mcp/` (gitignoré), mais la recette 2026-07-11 a constaté l'écriture à la RACINE du repo
  (fichier non gitignoré → poison potentiel pour un commit/deploy). Les SEULES racines autorisées en
  écriture par l'outil sont la RACINE du repo et `.playwright-mcp\` du repo (`%TEMP%` reste rejeté,
  « outside allowed roots ») ; une capture SANS chemin explicite atterrit donc à la RACINE du repo.
  NE PAS présumer : vérifier où atterrit la 1ʳᵉ capture, et si c'est hors `.playwright-mcp/`, la
  DÉPLACER hors du repo IMMÉDIATEMENT — l'arbre git est PARTAGÉ (d'autres sessions y écrivent).
  CONTOURNEMENT EN DEUX TEMPS, seul chemin qui tienne : capturer avec un chemin EXPLICITE sous
  `.playwright-mcp/` (gitignoré, donc jamais commité par erreur), PUIS copier le PNG vers un dossier
  hors dépôt (`%TEMP%`) pour l'archiver — viser `%TEMP%` dès la prise échoue (racine non autorisée).
- **« Browser already in use » / « Target page… has been closed » PERSISTANT (2026-07-16)** : si
  l'erreur revient après 2 tentatives, ce n'est PAS une contention active mais un lock Chrome MORT
  (reliquat d'une session Playwright jamais fermée proprement, pipe `--remote-debugging-pipe`
  orphelin) — signature : les PID `chrome.exe` du profil concerné restent FIGÉS (zéro churn) entre
  deux vérifications. Récupération : identifier UNIQUEMENT les processus du profil dédié
  `ms-playwright-mcp\<id>` par leur ligne de commande (ex. `Get-CimInstance Win32_Process -Filter
  "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ms-playwright-mcp*' }`), puis
  `Stop-Process` sur CES PID uniquement — JAMAIS un kill global par nom d'image (`chrome.exe`
  seul) : d'autres Chrome tournent sur la machine, dont celui de l'utilisateur.
- **Jamais de `dispatchEvent`/`MouseEvent` synthétique** pour cliquer un token/bouton — provoque de
  FAUSSES erreurs `setPointerCapture` (l'élément n'a jamais reçu de vrai pointeur). Utiliser les
  VRAIS clics Playwright (`browser_click`, sélecteur `data-cid`/rôle/texte).
- **Passer des tours** : `turn('id')` (triche, donne le tour) ou `fastForward()` (avance l'IA) —
  jamais de manipulation manuelle de `battle.round`/`battle.turn`/`battle.order` via `store`.
- **Ordre canonique en combat piloté : DRAINER toute modale AVANT `turn('id')`** — `turn()` réinitialise
  `battle.acted:false` pour le NOUVEL actif, mais une résolution en vol d'une modale déjà ouverte
  (`pendingDefense`, cascade d'attaque…) écrit son résultat en fusionnant sur le `battle` COURANT
  (`{...battle, acted: true, …}`, ex. `src/state/combatSlice.ts`/`combatFlow.ts`), donc APRÈS le
  `turn()`. Résultat : `battle.acted=true` fantôme posé sur le combattant qui vient de recevoir le
  tour, qui bloque silencieusement son Action sans message d'erreur. Vider `modal()`/`pendingDefense`/
  `pendingCascade`/tout `pending*` (`roll()`/`confirm()`/vrais boutons) AVANT tout `turn('id')`.
- **`aim()` juge l'arme SÉLECTIONNÉE dans la barre**, pas une arme perso du héros. Pour éprouver un
  tir de pièce d'artillerie, ouvrir « Attaque ▾ » et cliquer l'entrée d'arme du CANON avant `aim()` —
  un `range` sur l'arme personnelle du servant ne dit RIEN du canon. `aim()` renvoyant
  `{invalid, reason:'noammo'}` = pièce sans munition : en acheter à l'arsenal/chandelier PUIS charger
  (la munition d'artillerie est un article séparé des vivres, cf. `giveTrapping`) ; l'affordance à
  l'écran nomme la munition attendue (« Pas de munitions (Boulet et poudre) »).
- **Les tokens de combat SVG ne sont JAMAIS « stable » pour Playwright** : ils oscillent en
  permanence (idle-bob des billboards) → `browser_click` attend une stabilité qui ne
  vient pas et expire. Cibler par le **roster du HUD** (portraits/frise, éléments DOM stables) ou lire
  `screenPos('id')` puis un VRAI clic souris (`page.mouse.click`) aux coordonnées — jamais un
  `browser_click` qui attend la fin de l'animation du token.
- **Roster du HUD : viser un DOUBLON de libellé par son ID, pas par son nom** — deux héros (ou deux
  marins d'équipage) peuvent porter le MÊME libellé à l'écran ; un sélecteur par texte en attrape un
  au hasard, et la capture « prouve » alors l'autre. Résoudre l'id d'abord (`__wfrp.battle()` liste
  les combattants une ligne chacun, id compris), puis `screenPos(id)` → VRAI clic souris. Le canal
  `data-cid` est unique par entité, le texte ne l'est pas.
- **Cliquer une ROUTE de la carte du monde** : le tracé SVG n'a de hit-test QUE sur son trait
  (`pointer-events: stroke`) — jamais la bbox, jamais son label (`pointer-events: none`). Un clic au
  centre du bbox (ce que fait `browser_click` sur l'élément) tombe hors du trait et est intercepté par
  la vignette de lieu dessous. Méthode canonique (#297) : `__wfrp.clickRoute('routeId')` fait le
  calcul ON-PATH en interne (`getPointAtLength`/`getScreenCTM`, MÊME technique que ci-dessous) et
  renvoie `{x,y}` ÉCRAN — appelable via `browser_evaluate` standard (plus besoin de
  `browser_run_code_unsafe`) ; puis un VRAI clic souris (`page.mouse.click(x,y)`) — jamais
  `browser_click` sur le sélecteur de la route. `clickRoute` sonde `elementFromPoint` au point
  calculé et, si un DÉCOR TRANSPARENT interpose (milieu du tracé tombant sur un élément sans
  `cursor:pointer` dans sa chaîne d'ancêtres), balaie d'autres fractions du tracé jusqu'à un point
  cliquable — le repli du recetteur est désormais INTÉGRÉ (`note` dit la fraction retenue). Repli
  manuel ultime (si `clickRoute` échoue, ex. carte hors écran) : calculer soi-même un point ON-PATH
  via `getPointAtLength` du `path` + `getScreenCTM()` (coordonnées écran réelles du trait) — requiert
  alors `browser_run_code_unsafe` (chargé via ToolSearch, ABSENT du set d'outils de démarrage).
- **Cliquer une CASE du monde volumique : aucun outil MCP ne clique des COORDONNÉES** (mesuré en
  recette 2026-08-16, #1335). Les corps et le sol sont peints dans le canevas WebGL — ni ref de
  snapshot, ni `data-cid` (cf. `screenPos` ci-dessus). Chemin canonique : lire le point ÉCRAN par
  `__wfrp.tileScreenPos({x,y})` (centre : `x + width/2`, `y + height/2`), puis cliquer via
  `browser_run_code_unsafe` → `await page.mouse.click(x, y)` — le SEUL canal qui accepte des
  coordonnées (outil chargé par ToolSearch, ABSENT du set de démarrage : le charger AVANT d'ouvrir la
  recette, pas au milieu d'un tour de combat).
- **Un FX flottant sub-seconde ne se prouve PAS par une capture** (mesuré en recette 2026-08-16,
  #1335) : les nombres/mentions flottants vivent 900 ms (1300 ms pour la mort) et sont retirés par un
  `setTimeout` (`src/gameIso/fx/useCombatFx.ts`) — entre le clic, le rendu et l'écriture du PNG, la
  fenêtre est déjà fermée, et une capture vide ne prouve RIEN (ni présence ni absence). Se valider
  par la SOURCE de l'effet : l'événement de bus qui le pousse (`ANIM_FLOAT`/impact, `src/state/bus.ts`,
  souscrit par `useCombatFx.ts`) ou la ligne de journal correspondante (`__wfrp.log()`). Une capture
  ne sert qu'aux états PERSISTANTS (modale ouverte, HUD, écran).

- **Occlusion par footer fixe (`.bar`)** : un élément visuellement cliquable peut être RECOUVERT au
  point de clic — toujours `scrollIntoView({block:'center'})` AVANT de lire le `getBoundingClientRect`
  et de cliquer ; vérifier par `elementFromPoint` en cas de clic mort (vécu recette #495, créateur
  étape Caractéristiques).

- **Occlusion par la console de combat (`.combat-console`)** : le pont occupe la bande BASSE de
  l'écran. La visée canonique du token (« bas de la bbox », `screenPos` ci-dessus) peut tomber DANS le
  pont, pas sur le token — clic mort ou action parasite. Viser le HAUT du token
  (`{x: x+width/2, y: y+8}`) et VÉRIFIER par `elementFromPoint` avant le clic ; si une surface de la
  console répond, remonter encore (vécu recette #1004, incantation sur un token en combat).

- **Sélecteur TEXTE ambigu pour un sort** : viser un sort par son seul NOM (getByText de Playwright)
  matche AUSSI les lignes de journal de combat qui le citent → plusieurs nœuds, ou le mauvais. Cibler
  l'alvéole de la console : `.combat-console button.cc-cell` avec hasText (vécu recette #1004).

- **Sort de ZONE = DEUX portées, DEUX clics** : le clic sur un token ne fait qu'ARMER l'incantation
  (`castZoneSpell` ouvre la modale sans cible — le centre se choisit APRÈS le jet,
  `src/state/combatFlow.ts`). Le placement réel est un SECOND mode clic-case (« Poser la zone »,
  `PLACING_MODE` de `src/state/targetingModes.ts`) avec SA PROPRE validité : portée du sort mesurée
  du lanceur à la CASE + Ligne de Vue (`placedZoneValidAt`). Un `aim()` ok sur une cible ne dit RIEN
  de la case de pose, et une case hors portée échoue SANS message (`commitPlacedZone`/`castCommitZone`
  retournent sans rien faire, le clic est mort). En recette : poser la zone sur une case PROCHE du
  lanceur, et ne pas interpréter un clic sans effet comme un bug (vécu recette #1040, ~35 appels perdus).

- **Le dé fixé d'une rangée AUTO-RÉSOUT le jet** : sur une rangée pas encore lancée (mesuré sur les
  rangées de Contre-sort de la modale d'incantation), la saisie dans « Fixer le dé » LANCE le jet puis
  substitue la valeur — geste ATOMIQUE (`withPreRollFixedDie`, câblé par `rowForcedDie`,
  `src/ui/forcedDieRow.ts`). Aucun bouton « Lancer » séparé à cliquer, et aucun à chercher. Le champ
  pré-jet n'est offert que si l'option « Dés fixés » est active pour le siège (`canFixDie`) et si la
  rangée porte son déclencheur de jet ; sans champ, c'est bien « Lancer » qui résout (vécu recette
  #1040, ~8 appels).

- **Un sort à cible `special` n'a AUCUN ciblage au clic** : vérifier le `target` (et la `range`) du sort
  AVANT de le choisir pour une recette. Ex. « Soleil flamboyant » (`src/data/spells.json`) est
  `target.kind: 'special'` + `range.kind: 'self'` : la ZdE n'est pas chiffrable (`zdeRadiusTiles` rend
  `null` → `castZoneSpell` refuse d'ouvrir une pose de zone) et `spellRangeTiles` vaut 0, donc tout
  token autre que le lanceur tombe en `{invalid, reason:'range'}` dans `castAffordance`. Choisir un sort
  à cible chiffrée pour éprouver le ciblage (vécu recette #1040, ~15 appels perdus).

- **Rect périmé** : sur une liste qui peut se RE-RENDRE entre le `scrollIntoView` et le clic
  (animation, gain de PX, re-render React), re-mesurer `getBoundingClientRect` JUSTE AVANT le
  `Input.dispatchMouseEvent` — sinon le clic atterrit sur le voisin sans erreur levée (vécu recette
  #496 : clic « Humains » atterri sur « Nains »).

- **Mode Pousser (bélier/engin de siège) au clavier — séquence exacte** (#199) : cliquer le slot
  « Pousser » de la barre d'action ouvre le mode-CASE (`battle.action === 'push'`) mais laisse ce
  BOUTON focalisé dans le DOM. `ArrowUp/Down/Left/Right` posent/déplacent `combatCursor` (le **1er
  appui pose le curseur sur la case de DÉPART elle-même**, coût 0 — `Pousser (0)` à l'aperçu, RIEN
  ne bouge encore ; il faut un **2e appui** pour quitter cette case et voir un coût > 0). `Entrée`/
  `NumpadEnter` commet (`commitCursor` → `pushCommitTile`) — fonctionne MÊME si le bouton « Pousser »
  garde le focus résiduel du clic souris qui a ouvert le mode (corrigé : `cursor-commit` n'a plus la
  garde `notWhenControlFocused`, `src/state/keybindings.ts`). `Échap` annule le curseur ;
  « Annuler dépl. » (post-commit, tant qu'aucune Action n'a été prise) défait aussi une poussée
  commise au clavier, comme au clic (`src/state/push-keyboard-commit.test.ts`).

- **Combat naval — l'arc de bordée d'une pièce montée (`weapon.mountSide`)** : `firedAttackBlock`
  refuse le tir avec `reason:'arc'` si la cible n'est pas dans l'arc du bord monté, calculé depuis le
  cap de la COQUE support (`shipOfCrew` → `get().facing[ship.id]`), pas celui du servant
  (`src/state/combatFlow.ts:331-341`). Tribord/babord pointent PERPENDICULAIREMENT au cap (rotation de
  2 crans de 45°, `arcDir8`/`mountedWeaponBears`, `src/state/shipPostes.ts:128-146`) : une cible dans
  l'axe proue-poupe est TOUJOURS hors arc tribord/babord, quelle que soit la distance. Diagnostic à
  l'écran : `aim('cible')` → `{invalid, reason:'arc'}` = géométrie, pas munition/portée ; re-vérifier
  après un `turnShip`/`maneuver` du navire.

- **Apostrophe TYPOGRAPHIQUE dans les libellés** (`’`, U+2019) ≠ apostrophe droite (`'`, U+0027) :
  l'UI est MIXTE selon l'écran (mesuré : « Tenter un Test d'Athlétisme » = droite, « Dormir jusqu'à
  l'aube » = typographique) — pas de convention unique à copier. `clickButtonByText` (`lib.mjs`)
  normalise désormais LES DEUX formes vers une seule avant comparaison, côté texte cherché ET côté
  texte DOM ; un sélecteur Playwright `has-text`/`:text-is` écrit à la main reste exposé au piège et
  doit copier le libellé DEPUIS un snapshot/`__wfrp` plutôt que le retaper.
- **`button:has-text("Lancer")` matche aussi « Tout lancer »** (sous-chaîne) : un clic visant LE bouton
  « Lancer » peut résoudre le mauvais élément si « Tout lancer » est aussi à l'écran — utiliser
  `:text-is("Lancer")` (correspondance EXACTE) pour lever l'ambiguïté.
- **`__wfrp.routes()`** (symétrique d'`entities()`) : liste les routes CLIQUABLES de la carte du monde
  depuis le lieu courant (`{id, from, to, distanceLabel}`) — cible une route par son `id` pour
  `clickRoute(id)` quand plusieurs chips de distance affichés sont ambigus (même trajet, deux modes).
- **Combat naval — `aim('<coque>')` n'est (quasi) jamais une attaque directe** : une coque composite
  (`postes` non vide) est routée par `attackAffordance` vers « Servir »/« Renfort » (poste libre
  ADJACENT et acteur non déjà en poste) ou `none` — jamais vers un réticule d'attaque
  (`src/state/targetingModes.ts:236-241`, `serveTargetPoste`/`servablePostes`,
  `src/state/shipPostes.ts:339-361`). En pratique, un héros DÉJÀ posté (`mannedPoste` renseigné) tombe
  systématiquement sur `none` (`serveTargetPoste` refuse tant qu'on sert déjà une pièce) : la coque
  ennemie n'est donc pas une cible d'`aim()`, seuls ses membres d'équipage embarqués (`crewIds`) le
  sont. Dégâts à la coque = la Bordée, action du TOUR DE NAVIRE (mode `battery`, `batteryAffordance`,
  `src/state/targetingModes.ts:174-186`), un flux de ciblage SÉPARÉ de l'attaque personnelle.
- **Combat naval — `place('id',{x,y})` ne réinitialise PAS `battle.action`/l'arme choisie** (vérifié
  empiriquement sur `src/state/devtools.ts:390-414` : la fonction mute `pos` puis
  `useGame.setState({ battle: { ...b } })` sans toucher `action`/`selectedAttack`) — repositionner une
  coque/un servant PUIS re-choisir l'arme, ou l'inverse, donne le MÊME résultat avec ce helper de
  triche. Le mouvement RÉEL (clic-pour-se-déplacer, hors `place()`) remet lui `battle.action` à `null`
  (ex. `src/state/store.ts:1707`) — un réflexe distinct, à ne pas confondre avec la triche `place()`.
- **Combat naval — cibler un membre d'équipage d'une coque composite** : les sous-tokens SVG
  superposés d'un poste (chef + servants sur la même case) n'ont pas de bbox fiable au clic. Méthode
  fiable : le PORTRAIT du roster HUD (frise/dock, bas d'écran) route par `battleClickEntity` — MÊME
  ciblage que cliquer le pion sur la carte (`src/ui/CampaignView.tsx:142-166`, `onStripPortrait`/
  `onDockPortrait`) — puis ouvre la modale Attaque. La modale PRÉSÉLECTIONNE l'arme PERSONNELLE du
  servant, jamais l'arme de poste (`personalWeaponsOf` exclut explicitly l'arme du poste servi de
  l'auto-choix, `src/state/mount.ts:104-121`) : RE-sélectionner l'arme de poste dans le `<select>`
  « Arme » de la modale (`src/ui/jetProps/useAttackJetProps.tsx:171-184`) avant de lancer le jet.

- **Ouvrir la fiche complète d'un héros (`CharacterSheet`)** : `sheetId` est un `useState` LOCAL au
  composant écran (`PartyScreen.tsx`/`CampaignView.tsx`) — aucun helper `__wfrp` ne l'arme (le raccourci
  `sheet()` envisagé a été ÉCARTÉ, cf. `docs/architecture.md`). Chemin RÉEL, roster HORS combat
  (`PartyScreen`) : cliquer le portrait/nom d'un héros (`.seat-card-main`, `SeatCard`/`PresentHandle`,
  `src/ui/CharCard.tsx`) ouvre d'abord la PRÉSENTATION (`HeroPresentation`, récit) ; son bouton
  **« Fiche complète → »** (`present.fullSheet`, seulement si le héros est dans le groupe actif) pose
  `sheetId` et ferme la présentation. En COMBAT (`CampaignView`, dock du roster), un clic direct sur le
  portrait (`onDockPortrait`, hors ciblage) pose `sheetId` SANS étape de présentation — deux chemins
  distincts vers le même `CharacterSheet`. Piloter au clavier/souris réel (doctrine ci-dessus) ;
  `__wfrp.state()`/`entities()` n'exposent PAS `sheetId` (état de composant, pas du store).

## Recette COOP — deux navigateurs (hôte + invité)

Le seul flux du jeu qui exige DEUX pages : la possession (`net.ownership`, `net.gmSeat`) est un fait
d'AFFICHAGE — l'état, lui, voyage ENTIER (snapshot hôte→invité). Une recette coop se juge donc à ce
que CHAQUE page rend, jamais à un `pending*` (identique des deux côtés, cf. invariants ci-dessous).

### Le relay

| Cas | Commande | Contrôle |
|---|---|---|
| **Défaut — aucun setup** | `npm run dev` seul | `relayHttpUrl` (`src/net/relay.ts`) retombe sur `RELAY_URL_PROD` = le Worker Cloudflare DÉPLOYÉ : héberger fonctionne sans rien lancer d'autre |
| Relay LOCAL (Worker modifié / hors ligne) | `npm run relay:dev` (= `npm --prefix server run dev`, wrangler dev, port 8787) dans un terminal, **puis** Vite relancé avec la variable | `POST http://localhost:8787/rooms` doit rendre `{"code":…,"hostToken":…}` |

`VITE_RELAY_URL` est lue via `import.meta.env` **au démarrage de Vite** : la poser après coup ne
change rien, il faut relancer le serveur de dev. Syntaxe PowerShell :

```powershell
$env:VITE_RELAY_URL = 'http://localhost:8787'; npm run dev
```

(bash : `VITE_RELAY_URL=http://localhost:8787 npm run dev`). L'URL WebSocket en est DÉRIVÉE
(`http`→`ws`, `roomWsUrl`) — une seule variable pour les deux.

### Le kit deux-navigateurs (`scripts/recette/lib.mjs`)

Deux appels d'`openApp` dans le MÊME script node = **deux Chrome headless indépendants** : profil
temporaire tiré au hasard pour chacun (`os.tmpdir()`), port CDP tiré au hasard, donc deux
`window.__wfrp`, deux `localStorage`/`sessionStorage` (le token de reprise de siège compris). L'option
`port` de `launchSession` (transmise par `openApp`) ne fixe QUE le port CDP — inutile de la poser.

**Teardown** : `session.close` pour CHAQUE session dans un `finally` (ferme le target, tue l'ARBRE
Chrome — `taskkill /T`, seul fiable sous Windows — et purge le profil). Le `process.on('exit')` du
socle est un filet pour les chemins d'échec non couverts, PAS un teardown.

**Console** : un `consoleGuard` par session (le CDP multiplexe les sessions sur une connexion ; le
filtre par `sessionId` est déjà dans le socle).

```js
import { openApp, evaluate, waitFor, consoleGuard, DEFAULT_URL } from './scripts/recette/lib.mjs';
const APP = DEFAULT_URL; // port propre à CET arbre (scripts/port-dev.mjs)
const hote = await openApp(APP);
const gHote = consoleGuard(hote);
try {
  // 1. HÉBERGER — aucun helper __wfrp n'expose le réseau : VRAIE action du store (pas un setState).
  await evaluate(hote, `window.__wfrp.store.getState().netHostStart('Hôte')`);
  await waitFor(hote, `!!window.__wfrp.store.getState().net.roomCode`);
  const code = await evaluate(hote, `window.__wfrp.store.getState().net.roomCode`);

  // 2. REJOINDRE — le lien d'invitation bascule l'invité sur l'écran 'coop' et pré-remplit le code.
  const invite = await openApp(`${APP}?join=${code}`);
  const gInvite = consoleGuard(invite);
  try {
    await evaluate(invite, `window.__wfrp.store.getState().netJoin(${JSON.stringify(code)}, 'Invité')`);
    await waitFor(invite, `window.__wfrp.store.getState().net.mode === 'guest'`);
    await waitFor(hote, `Object.keys(window.__wfrp.store.getState().net.seatNames).length === 2`);
    // … recette …
  } finally { await invite.close(); }
} finally { await hote.close(); }
```

### Le flux hôte / invité

| Étape | Où | Geste RÉEL (joueur) | Raccourci de SETUP mesuré |
|---|---|---|---|
| Héberger | hôte | menu principal → **« Jouer en ligne »** (`MainMenu`, écran `coop`) → champ « Votre nom » → bouton **« Héberger »** (`src/ui/CoopLobby.tsx`) | AUX CLICS : `typeInField` sur le sélecteur que `champParLibelle` rend pour le libellé « Votre nom », puis `clickButtonByText` sur « Héberger » (le champ est un input React CONTRÔLÉ : `evaluate` + `.value` reste sans effet). Raccourci d'état : `__wfrp.store.getState().netHostStart('Hôte')` |
| Lire le code | hôte | code à 6 caractères + « Lien d'invitation » (`CoopRoomPanel`, `src/ui/CoopPanels.tsx`) | `__wfrp.net().roomCode` (`state()` n'expose pas `net`) |
| Rejoindre | invité | même écran → code + nom → **« Rejoindre »** | AUX CLICS : `typeInField` sur le sélecteur que `champParLibelle` rend pour « Votre nom », puis sur `.coop-code-input`, et `clickButtonByText` sur « Rejoindre ». Raccourci : ouvrir l'app sur `?join=<CODE>` (bascule sur l'écran `coop`, code pré-rempli, `src/ui/App.tsx`) puis `netJoin` |
| Contrôler la liaison | les deux | liste « Joueurs connectés » (`CoopSeatList`) | `__wfrp.net()` des deux côtés : `mode` = `host`/`guest`, `mySeat` = 0/1, `seatNames` = les deux noms |
| Composer le groupe | hôte | **« Composer le groupe → »** → écran d'équipe : l'hôte attribue les EMPLACEMENTS (`netAssignSlot`), chaque joueur remplit les siens | poser le groupe d'un coup par un scénario (ci-dessous) |
| Attribuer les héros | hôte | rubrique « Attribution des héros » (`CoopAssignList`, un `<select>` par héros ; `GmSeatSelect` y pose le rôle MJ) — lobby ET menu ☰ en partie (`CoopMenuSection`) | `__wfrp.store.getState().netAssign(heroId, 1)` (hôte-autoritaire : refusé en mode invité) |
| Jouer | hôte | tout le pilotage de MISE EN PLACE | `scenario`, `goto`, `fight`, `turn`, `combatEnd`… **depuis l'HÔTE uniquement** |

⚠ **Ne jamais mettre en place depuis l'invité** : `interceptGuestActions` (`src/state/netFlow.ts`)
n'enrobe QUE les actions de l'allowlist (`GUEST_INTENTS`, `src/net/intents.ts`) — toute autre action
(`setParty`, `startScene`, `scenario`…) s'exécute en LOCAL chez l'invité puis est écrasée au snapshot
suivant. Ce qui ressemble à « ça a marché puis c'est revenu en arrière » n'est pas un bug.

### Invariants OBSERVABLES

| # | Invariant | Vérité de code | Ce qu'on OBSERVE |
|---|---|---|---|
| 1 | **Un jet possédé par l'invité surface CHEZ LUI** | `ActiveModal` (`src/ui/ActiveModal.tsx`) ne monte la modale que si le siège local possède le concerné (`modalOwnerOf` + `ownsLocal`) ; `'*'` = tous | **invité** : la modale est rendue (`.modal-overlay`) — **hôte** : rien. Hors tour du concerné (défense réactive), l'hôte a la puce `.spectator-chip` |
| 2 | **Le `pending*` NE prouve rien** | l'état voyage entier (`netSnapshot`) | `__wfrp.modal()` répond PAREIL des deux côtés — la possession se lit au DOM, jamais au pending. C'est le piège n°1 d'une recette coop |
| 3 | **Le choix de GROUPE va au meneur** | dialogue = décision de groupe : `chooseDialogue`/`closeDialogue`/`interactEntity` sont routés `seat === (net.gmSeat ?? 0)` (`ROUTES`, `src/state/netOwnership.ts`) ET absents de `GUEST_INTENTS` ; `DialogueBox` lit le MÊME routage par `ownsGroupDecision` (`src/ui/ownership.ts`) | l'invité VOIT le dialogue (miroir) mais ses réponses sont **désactivées**, avec une puce `.spectator-chip` qui NOMME le meneur ; seul le choix du meneur fait avancer le nœud/le flag/le combat des deux côtés. Chez l'invité, `state().inDialogue` et le nœud affiché suivent l'hôte |
| 4 | **Une bande partagée : chaque siège ses rangées** | `bandStep` (`src/state/rollSeam.ts`) pose `groupOwner` dès >1 porteur → `modalOwnerOf` rend `'*'` → fenêtre chez TOUS ; chaque rangée n'est actionnable que par le siège qui possède son acteur (`useOwns`, `src/ui/ownership.ts` — `rollAllUnrolledRows` filtré par `owns`) | la MÊME fenêtre est ouverte des deux côtés ; le bouton de jet d'une rangée n'est servi qu'au siège propriétaire ; « Tout lancer » ne roule QUE les rangées du siège qui clique |
| 5 | **La Résilience de l'invité sur SA rangée** | `seatInfluences` : un héros non piloté par l'IA n'est influençable que par SON siège (`src/state/netOwnership.ts`) ; `canFixDie` (option « Dés fixés ») en dérive | chez l'invité, Chance/Résilience/Pacte ne sont offerts QUE sur sa rangée ; la rangée d'un héros de l'hôte les porte chez l'hôte et pas chez lui |
| 6 | **Console 0 des DEUX côtés** | — | `guard.errors()` vide pour chacune des deux sessions (un `consoleGuard` par page) |

### Pièges coop

- **Attendre la PROPAGATION avant d'asserter chez le pair** : la diffusion est throttlée (trailing
  **~120 ms** + coalescing, `scheduleBroadcast`, `src/state/netFlow.ts`) et le trajet Worker s'y
  ajoute. Après un geste côté A, poller la CONDITION attendue côté B (`waitFor`), jamais un délai fixe.
- **Les deux `__wfrp` sont ÉTRANGERS** : un helper appelé sur la page hôte ne se voit sur la page
  invitée qu'après un snapshot. Toujours nommer la session dans le script (`hote` / `invite`).
- **Clavier neutralisé — normal, pas un bug** : les raccourcis de combat exigent
  `controlsActive` **ET** aucune modale ouverte (`src/state/keybindings.ts`) → pendant le tour d'un
  autre siège, ou tant qu'une fenêtre (dialogue, pause de Round, cascade) est ouverte, rien ne répond.
  Fermer la fenêtre, ou rendre la main au bon siège, AVANT de conclure à une régression clavier.
- **Ready-check de début de Round — le combat n'est PAS bloqué** : dès `net.mode !== 'local'`, l'hôte ne
  lance le Round que quand `pendingRoundStart.readyBySeat` est complet (`roundStartReady(net.mySeat)`,
  `src/state/combatSlice.ts`). Annoncer « Prêt » **sur CHAQUE page** — sans les deux déclarations, rien
  n'avance, aucun tour ne s'ouvre, aucune modale ne surface : ce n'est pas un gel, c'est le
  ready-check. ⚠ SEULE SURFACE aujourd'hui : le raccourci clavier `round-start`
  (`src/state/keybindings.ts`) — le bandeau de phase de la console ne rend que le
  « Commencer le combat » SOLO (`confirmRoundStart`) ; en recette coop, piloter par
  `store.getState().roundStartReady(<siège>)` sur la page du siège concerné.
- **Sous-bandes successives INDISCERNABLES au DOM** : une bande peut en appeler une autre (chaque rangée
  vaincue ré-appende SON Test à la cascade — Surprise → Vigilance, `src/state/combat/triggeredTest.ts`).
  Deux étapes consécutives présentent alors le MÊME libellé et les MÊMES boutons : la présence de
  `.modal-overlay` ne prouve donc RIEN sur la progression. Lire le CONTENU des rangées (noms des acteurs,
  valeurs, rangées déjà roulées) entre deux clics, et **drainer jusqu'à disparition de la fenêtre** des
  DEUX côtés — jamais un nombre de clôtures présumé. Chaque étape est possédée par le siège de son
  acteur : une cascade qui « ne se ferme pas » chez l'hôte attend souvent une clôture chez l'invité.
- **`__wfrp.gmSeat` ne sert QUE le solo/l'hôte** : il pose le siège **0** (`setGmSeat(0)`). En coop, le
  MJ se désigne par siège au `<select>` « Maître du Jeu » (`GmSeatSelect`) ou par
  `store.getState().setGmSeat(1)` côté hôte. Le siège MJ SURVIT à `scenario()` (piège mesuré #1028
  ci-dessus) : le remettre à zéro entre deux recettes.
- **Reprise de siège** : le token vit en `sessionStorage` par room — un reload de l'onglet invité
  reprend le MÊME siège, un Chrome au profil NEUF prend un siège NEUF. `netJoin` refuse hors mode
  local et exige 6 caractères `[A-Z0-9]`.
- **Arbre GELÉ** (règle générale, ci-dessus) : elle vaut DOUBLE ici — un full-reload Vite ramène au
  menu **une** des deux pages et casse la session réseau, pas les deux.

### Scénario « coop minimal » — un jet d'invité + un choix de groupe

Deux véhicules, un par famille d'invariants — les mélanger est ce qui fait trébucher la procédure :

| Invariant visé | Scénario | Pourquoi |
|---|---|---|
| Choix de GROUPE (3) + bande partagée (4/5) | `embuscade` (`src/scenes/test-scenarios/embuscade.ts`) | exploration → dialogue → combat ; `enc-mutants` porte `surprise: 'party'` (5 embusqueurs) donc une CASCADE s'ouvre avant tout tour — c'est justement le matériau des invariants de bande |
| Jet SOLO d'invité (1/2) | `entrainement` (`src/scenes/test-scenarios/entrainement.ts`) | `enc-entrainement` est SANS `surprise` : combat direct, ready-check, puis `battleRun()` dès le premier tour — mesuré en exécution comme le chemin court |

⚠ **Ne pas chercher le jet solo dans `embuscade`** : `surprise: 'party'` fait ouvrir la bande de Surprise
(`applySurprise`, `src/state/combatFlow.ts`) AVANT tout tour, et chaque défenseur vaincu porteur de
Vigilance ré-appende SON Test — une file d'étapes successives à drainer des DEUX côtés (piège
« sous-bandes indiscernables » ci-dessus) qui noie le jet qu'on venait mesurer.

Déroulé : étapes 1-6 sur `embuscade` (choix de groupe), étape 7 sur `entrainement` (jet solo),
étape 8 pour la bande partagée. Tout depuis l'HÔTE sauf ce qui est marqué INVITÉ.

1. Relay au défaut (prod) ou local (§ ci-dessus), `npm run dev`, arbre gelé.
2. Ouvrir les deux pages et lier les sièges (script du kit ci-dessus) — contrôler `net.mode`/
   `net.mySeat` des deux côtés.
3. HÔTE : `__wfrp.scenario('embuscade')` → groupe de 4 posé, scène chargée ; l'invité la reçoit au
   snapshot (contrôler `__wfrp.state().sceneId === 'ambush-test'` chez l'INVITÉ).
4. HÔTE : relever les ids (`__wfrp.state().party`) et attribuer le 2ᵉ héros au siège 1 :
   `__wfrp.store.getState().netAssign('<id>', 1)`. Contrôler chez l'invité :
   `net.ownership['<id>'] === 1`.
5. HÔTE : `__wfrp.goto({ x: 9, y: 6 })` — la zone `approche` déclenche le dialogue `dlg-ambush`.
   **Choix de GROUPE** : `state().inDialogue` doit passer à `true` des DEUX côtés (invariant 3).
6. Chez l'INVITÉ : les réponses du dialogue sont **désactivées** (`button.dlg-choice[disabled]`) et
   la puce `.spectator-chip` nomme le meneur — rien à cliquer, l'affordance dit qui décide. Cliquer
   la réponse « Fondre sur les charognards… » chez l'HÔTE : le combat `enc-mutants` s'ouvre des deux
   côtés.
7. **Jet SOLO d'invité — basculer sur `entrainement`** (chemin court, mesuré en exécution). HÔTE :
   `__wfrp.scenario('entrainement')` → scène `terrain-entrainement` ; le groupe est DIFFÉRENT (héros
   dédiés du scénario) → **refaire l'étape 4** : relever les nouveaux ids et `netAssign` du 2ᵉ héros au
   siège 1. Puis HÔTE : `__wfrp.goto({ x: 9, y: 8 })` — franchir la bande `entrer-en-lice` (x=7) lance
   `enc-entrainement`, SANS Surprise. **Ready-check** : cliquer « Prêt » sur CHAQUE page (piège
   ci-dessus) — sinon aucun tour ne s'ouvre et on croit le combat gelé ; l'ouverture s'observe par
   `__wfrp.battle()`, jamais par `state().battle` (inexistant, cf. table des helpers).
   HÔTE : `__wfrp.turn('<id du héros de l'invité>')` (rend le tour ET le Mouvement plein).
   INVITÉ : `__wfrp.store.getState().battleRun()` — action de l'allowlist, donc VRAI trajet
   intent → hôte → snapshot. **Jet d'invité** : la modale de Course est rendue chez l'invité,
   l'hôte affiche « Invité joue <héros>… » (invariant 1).
   Si on reste sur `embuscade` : rien ne s'ouvre tant que la cascade de Surprise n'est pas DRAINÉE des
   deux côtés, et le héros est SURPRIS (`surprise: 'party'` de la rencontre, LDB 13) — passer au Round
   suivant (`fastForward`) puis refaire `turn`.
8. Bande partagée + Résilience (invariants 4/5) : HÔTE `__wfrp.combatEnd()` → la cascade de fin de
   combat s'ouvre CHEZ LES DEUX ; vérifier qu'une rangée n'est jouable que par son siège et que la
   Résilience n'est offerte à l'invité que sur SA rangée.
9. Les deux `guard.errors()` doivent être vides ; fermer les deux sessions dans les `finally`.

## Collecteur d'erreurs de playtest (#304)

Les erreurs d'une soirée de playtest ne remontent que si le joueur les VOIT (console jamais
consultée hors recette) — `src/ui/errorCollector.ts` capture localement (**zéro réseau**)
`window.onerror` + `unhandledrejection` + les crashs de rendu interceptés par `SceneErrorBoundary`
(`componentDidCatch` appelle `recordError`, EN PLUS de `console.error` — comportement de la
boundary inchangé, y compris la reprise `onRetry`/rechargement). Buffer borné (50 entrées, FIFO) :
`{message, stack tronquée (2000 car.), scène courante, seed RNG, version (`package.json`), horodatage}`.

- **DEV** : bandeau discret en bas à droite (`src/ui/ErrorCollectorBanner.tsx`, chunk async chargé
  seulement si `import.meta.env.DEV`) — compteur d'erreurs, clic → panneau listant les entrées +
  bouton « Exporter » (JSON copié dans le presse-papier + téléchargé), prêt à coller dans une issue.
- **PROD** : le collecteur reste actif (mêmes capteurs), le bandeau est absent ; export via
  `window.__wfrp.errors()` (liste) / `window.__wfrp.exportErrors()` (JSON string) — même canal
  `window.__wfrp` que la recette, mais posé DEV **et** PROD par `installErrorCollector()`
  (`src/main.tsx`), contrairement au reste de `buildApi()` (`devtools.ts`, DEV uniquement).
- ⚠ **seed RNG non tracé actuellement** : `battleRng()`/`seedBattleRng` (`src/state/battleRng.ts`)
  n'exposent pas la graine numérique (RNG opaque) — le champ `seed` de chaque entrée est `null` tant
  qu'aucune session `state/store` n'instrumente ce point (hors périmètre #304, `src/ui/`).

## Piège du *closure-sync*

Lire le DOM dans le **même** `evaluate` que `talk()` lit l'état AVANT le re-rendu React —
séparer en deux appels. Plus généralement : cliquer un bouton
qui change un état React PUIS agir dans le MÊME `evaluate` lit l'ANCIEN état (React n'a pas
re-rendu). Séparer en deux appels, ou utiliser un `ref` côté composant pour la logique de drag.

Variante mesurée (2026-08-05) : un **focus posé par un `useEffect` post-rendu** (ex. le popover
épinglé de `CodexRef` qui focalise sa porte après `↓`) n'est pas garanti au moment d'un
`evaluate(document.activeElement)` immédiat — lire un focus transitoire fait conclure à tort à
un vol de focus. Lire via `browser_snapshot` (qui laisse s'écouler un tour d'event loop), ou
attendre avant de lire. Ne JAMAIS « réparer » en mutant le DOM (`tabindex` à la main) : recharger
et rejouer la séquence canonique.

## Piège du texte concaténé au badge (listes du Codex)

Mesuré 2026-08-29 (recette T3 #1472). Dans les listes du Compendium/Codex, le compteur
(`<span className="count">`, ex. `src/ui/compendium/CompendiumScreen.tsx`) et l'abréviation de
livre sont des enfants du MÊME élément cliquable que le libellé : le CSS les pose à droite, mais
le `textContent` les colle sans séparateur — `PorteADE II`, `Alchimiste4`, `Armes d'hastLDB`. Ce
n'est pas un bug de rendu (le badge reste dans le nœud accessible), mais tout script de clic qui
matche le texte EXACT échoue en silence (« aucun élément ne matche », sans dire pourquoi). Sur ces
listes, matcher en sous-chaîne / `exact:false` (ou viser l'id), jamais le texte exact.

## Piège de la bbox d'un groupe REPLIÉ (clusters du Codex)

Mesuré 2026-08-29 (recette sous-lot C #1472), ~35 appels d'outils perdus. Les clusters de
catégories du Compendium sont des `<details className="fold">` (`src/ui/compendium/CompendiumScreen.tsx:181`,
corps `fold-body` l.200 ; CSS `src/ui/styles/components.css:93-130` — la coquille ne pose
qu'`overflow: hidden`, aucune règle n'y masque le corps). Les chips d'un cluster FERMÉ restent donc
dans le DOM, et `getBoundingClientRect()` sur l'un d'eux rend des coordonnées NON NULLES — celles de
sa position théorique si le groupe était ouvert. Ces coordonnées tombent sous le groupe SUIVANT : le
clic atterrit sur un autre élément, sans erreur ni log. Une bbox non nulle ne prouve JAMAIS qu'un
élément est atteignable : lire la propriété DOM `details.open` du groupe porteur (l'ouvrir d'abord
si elle est `false`), et re-mesurer APRÈS ouverture.

## Piège de l'échelle de capture ≠ échelle de clic

Mesuré 2026-08-29 (recette sous-lot C #1472), ~15 appels perdus. Le panneau navigateur peut rendre
une capture SOUS-ÉCHANTILLONNÉE (mesuré : 800×453) alors que le viewport où atterrissent les clics
est tout autre (ce jour-là : 1600×900) : les coordonnées relevées à l'œil sur l'image ne sont pas
des coordonnées de clic (facteur 2 ici). Avant tout clic aux coordonnées, lire l'échelle réelle (`window.innerWidth`/
`innerHeight` contre les dimensions de l'image) et convertir — ou mieux, ne pas cliquer aux
coordonnées : viser le nœud (sélecteur/`ref` de snapshot) et laisser l'outil calculer le point.

## Piège du buffer console PARTAGÉ PAR ORIGINE (panneau navigateur)

Mesuré 2026-08-30 (recette #1580). Le buffer de messages du panneau navigateur est partagé PAR
ORIGINE entre les onglets, et l'action de purge ne le vide PAS : une lecture nue rend donc aussi les
erreurs d'un onglet FRÈRE ouvert sur le même hôte, y compris périmées. Vécu : 9 erreurs de rechargement
à chaud imputées à tort à la page sous recette — même jeton `?t=` que l'onglet voisin, aucune façon de
les distinguer à l'œil. Une console « rouge » ne prouve donc rien par elle-même, et une console
« verte » lue après un geste ne prouve pas que le geste n'a rien cassé.

RÈGLE : attribuer une erreur par DIFFÉRENCE de SET — relever le buffer, recharger À FROID, relever de
nouveau, et ne retenir que ce qui apparaît. Jamais un verdict sur le buffer nu. Fermer les onglets
frères de la même origine avant la recette reste le moyen le plus court d'éviter la question.

## Piège du gros plan et du cadre de coordonnées (panneau navigateur ≠ Playwright MCP)

Mesuré 2026-08-30 (recette #1580). Deux constats sur le panneau navigateur, à ne pas confondre avec
l'outillage Playwright MCP du reste de ce document :

- **Pas de gros plan par `zoom`** : `computer{action:"zoom"}` assorti d'une `region` est inopérant et
  répond « region crop not yet supported ». Aucun recadrage n'est disponible par cette voie — pour
  inspecter un détail fin, agrandir la cible dans la PAGE (zoom applicatif, viewport réduit via le
  redimensionnement) plutôt que d'espérer un crop côté outil.
- **Le cadre des coordonnées de clic est LA CAPTURE, mise à l'échelle — pas le viewport DOM.** Le
  contrat de l'outil est explicite : une coordonnée s'exprime dans le repère de la DERNIÈRE capture,
  et le facteur d'échelle est rapporté avec elle. Un point relevé sur le DOM (`getBoundingClientRect`,
  `innerWidth`) doit donc être converti VERS ce repère, sinon le clic atterrit ailleurs — en silence,
  comme tous les clics manqués de ce document.

⚠️ La section précédente (« échelle de capture ≠ échelle de clic », mesurée sous **Playwright MCP**)
énonce la convention INVERSE : là-bas les clics atterrissent dans le viewport et c'est l'image qui est
sous-échantillonnée. Les deux sont vraies, chacune pour SON outil : avant de convertir, savoir lequel
on pilote. Appliquer la conversion de l'un à l'autre double l'erreur au lieu de la corriger.

## Piège du suffixe collé au texte d'un bouton (compteur, puce d'état)

Mesuré 2026-09-07 (recette #1691). Comme les chips du Codex plus haut, des boutons d'écran portent un
suffixe DANS leur `textContent` : le compteur de la palette (`Terrains25`) ou la puce d'état de
sauvegarde (`Enregistrer •`). `clickButtonByText` en `{ exact: true }`
(`scripts/recette/lib.mjs:636`) compare le texte ENTIER et n'y matche donc rien. Sur ces boutons, viser
en sous-chaîne (`exact: false`, le défaut) ou par préfixe, et lever l'ambiguïté par `dans` plutôt que
par `exact`.

## Chemins canoniques de l'éditeur

Pièges vécus À L'ÉDITEUR (deux recettes, 2026-09-21) — tous re-mesurés au code :

- **Préparer l'état d'une entité passe par `__wfrp.editorPatchEntity`**, jamais par une remontée du
  fiber React de `.editor-inspector` pour atteindre `setScene`. Voir sa rangée à la table `__wfrp`
  ci-dessus.
- **L'`evaluate()` du kit CDP n'accepte pas un `await` EN TÊTE d'expression** : la voie est
  `Runtime.evaluate` (`scripts/recette/lib.mjs:385`), sans `replMode` — `await __wfrp.ready()` y est
  une erreur de syntaxe. Envelopper dans une IIFE async : `(async () => { … })()` (`awaitPromise`
  est déjà posé, la promesse rendue est donc attendue).
- **`.editor-inspector select` ne désigne PAS le sélecteur du décor** : le PREMIER `<select>` du
  panneau est **Orientation** (`ent.facing`, `src/ui/editor/Inspector.tsx:1329`, pli « Identité »
  rendu en tête). RÈGLE : viser par le LIBELLÉ du champ (`label.ed-field`), jamais par rang.
- **L'écran éditeur est LAZY-chargé** (`src/ui/App.tsx:18`, `lazy(() => import('./editor/Editor'))`,
  sous `Suspense`) : après la bascule d'écran, le DOM n'existe pas encore. Attendre `.editor-toolbar`
  (`src/ui/editor/EditorToolbar.tsx:163`) avant tout geste — `editorOpen(id)` attend déjà le montage
  par le pont, mais un clic direct dans la barre ne l'attend pas.
  Au TOUT PREMIER accès d'une session de dev fraîche, Vite n'a pas encore compilé ce chunk : une
  attente de ~9 s sur `.editor-toolbar` expire alors qu'il arrive. Viser ~20 s pour ce premier accès
  (les suivants sont instantanés, le chunk étant en cache) — un timeout ici se lit comme un écran
  cassé, il ne l'est pas.
- **« Importer JSON… » est un `input[type=file]` CACHÉ derrière un `<label>`**
  (`src/ui/editor/EditorToolbar.tsx:111-126`) : le cliquer ouvrirait le dialogue de fichier de l'OS,
  qu'aucun pilote ne ferme. Le peupler par `poserFichier` (`scripts/recette/lib.mjs`), qui déclenche
  son `change` sans aucun dialogue.
- **Les boutons de zoom répondent à `onPointerDown`, pas à `click`**, et n'ont pas de texte : les
  cibler par leur `title`/`aria-label` EXACT — « Zoom arrière » (`src/ui/ViewControls.tsx:100`),
  « Zoom avant » (`:106`), « Réinitialiser le zoom » (`:110`). Un `.click()` de pilote qui n'émet
  pas `pointerdown` ne fait RIEN, sans erreur.
- **Écran « Scénarios de test » : chaque carte porte un bouton au libellé générique « Lancer »** —
  viser par texte amène le premier venu. L'ancrage est
  `[data-testid="scenario-launch-<id>"]` (`src/ui/TestScenariosScreen.tsx:71`, verrouillé par
  `TestScenariosScreen.test.tsx:25`).
- **Hors combat, `__wfrp.state()` n'expose PAS la scène** : il ne rend que `sceneId`/`sceneName`
  (`src/state/devtools.ts:532`). Les entités se lisent par `__wfrp.entities()`
  (`src/state/devtools.ts:566`), qui rend id, libellé, nature, position et ce que l'entité OFFRE.

Une op mécanique ne s'atteint pas depuis la Scène : elle vit dans un bloc d'effets de trigger.
Chemin mesuré en recette (2026-09-18, #1789) jusqu'à l'éditeur d'une op :

Éditeur → onglet **Triggers** → **+ Nouveau trigger** → **+ Bloc** → **Afflictions** → « Effets
mécaniques (Blessures / État / buffs… — vocabulaire des sorts) » → menu « Type : … » → l'op
(`offTerrainMod` est sous *Séquelles & mobilité*).

Le libellé de l'entrée est cité COMPLET (`src/state/combatEffects.ts:1535`) : viser « Effets
mécaniques » en `{ exact: true }` rate (piège du suffixe ci-dessus) — soit le texte entier, soit
`exact: false`.

## Chemins canoniques du Codex (niches ouvertes récemment)

Une recette ne doit pas redécouvrir l'arborescence du Compendium à l'aveugle : les niches nichées sous
un cluster de `Tables` ne sont PAS sous `Monde`, et le chemin ne se devine pas depuis le nom du
fichier de données. Chemins vérifiés au registre (`src/ui/compendium/registry.ts`) :

| Donnée | Chemin dans le Compendium |
|---|---|
| `weather` (table de tirage d100 par saison) | Tables › Voyage terrestre › **Météo de voyage** |
| `weatherConditions` (effets par météo) | Tables › Voyage terrestre › **Conditions météo** |

Les deux niches éditent le MÊME fichier (`src/data/weather.json`) sous deux catégories Codex : une
recette qui vérifie l'édition d'une météo doit dire LAQUELLE des deux elle a ouverte.

**Prose ADRESSÉE (`descRef`, #1389)** — la première famille dont la prose n'est plus recopiée dans la
donnée mais adressée au `Source/` est `psychology.json` (9 entrées, LDB 21). La niche s'ouvre sans
naviguer :

```js
window.__wfrp.store.getState().openCodex({ category: 'psychologies', id: 'terreur' })
```

L'adresse livrée pour Terreur est la section `terreur-indice#1` (« Terreur (Indice) » au chapitre),
blocs **0 à 1** — le titre de section porte l'Indice, et la prose tient sur deux blocs.

Ce que la recette vérifie sur cette fiche : (1) l'onglet **Description** affiche la prose du chapitre
21 du Livre de base, entière et formatée (emphases `*Terreur*`/`*Peur*`) ; (2) sur ce chemin, aucune
requête de CHAPITRE (`/source/<livre>/<NN>.md`) ni de MANIFESTE (`/source/manifest.json`) n'est émise
— la prose est MATÉRIALISÉE au build dans le bundle de données, les chapitres ne sont servis qu'en
DEV et pour l'atelier. Mesure : l'espion `espionReseau` filtré par son `correspondant` sur
l'expression `/^\/source\//` — le motif NU `/source/` attrape aussi, en dev, les modules de l'app
(`src/data/source/*.ts`, servis par Vite) et rendrait un faux positif ; (3) 0 erreur console
(`window.__wfrp.errors`). En Atelier, le champ d'édition de l'adresse (`DescRefField`) remplace la
zone de saisie de prose — et le `textarea` « Description » n'existe PAS sur une entrée adressée (un
champ DÉRIVÉ ne s'offre pas à l'édition, `estDerive` de `src/ui/compendium/editFields.ts`) :
remettre le livre de l'adresse à vide le fait réapparaître, garni de la prose matérialisée (geste
« détacher »).

ÉTAT INTERMÉDIAIRE — re-choisir un livre ensuite ne masque PAS « Description » : tant que l'adresse
ne porte aucun fragment (`{ book, ch: '', parts: [] }`), elle n'adresse rien, donc elle ne dérive
rien, et la prose reste éditable avec son texte matérialisé jusqu'à ce que chapitre + section + blocs
soient posés (seuil `adresseUnPassage` / `MIN_FRAGMENTS`, `src/data/schemas/grammaire/valeurs.ts`).

**Éditer une fiche du Codex commence par la bascule « Atelier »** (`CompendiumScreen.tsx:164-171`,
bouton `.btn small` à `aria-pressed` dans l'en-tête — pas un onglet). Tant qu'elle est éteinte, les
boutons « Éditer » et « Nouveau » du volet de détail ne sont PAS RENDUS (`:258`), et une recette qui
les cherche conclut à tort qu'un champ d'édition n'existe pas. La désactiver referme toute édition en
cours. Elle n'apparaît que sur une catégorie éditable (`isEditableCategory`).
