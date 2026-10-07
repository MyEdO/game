# Recette navigateur — vérifier une feature dans le jeu

> Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05). À lire au moment de valider une
> feature UI dans le navigateur.

**Vérification** : après une feature UI, valider dans le navigateur — par la SESSION TENUE du kit
(§ « Session tenue » ci-dessous), Playwright MCP seulement quand une capacité manque au kit — charger
l'app de CET arbre (`npm run dev` imprime son URL), dérouler le flux, vérifier la console (0 erreur :
`errors()` vide DEPUIS L'AMORÇAGE, § « Console ») et screenshoter. Le menu
**« Scénarios de test »** (`menu.testScenarios`, `src/i18n/messages/fr.ts`) ouvre un choix de scénarios de test (groupe fixé + scène adaptée,
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

> **RÈGLE DE PILOTAGE : la session tenue de `lib.mjs` d'abord** (`scripts/recette/session.mjs`,
> § « Session tenue » ci-dessous) — un Chrome headless à profil temporaire dédié (`launchSession`),
> jamais le profil partagé que `playwright-MCP` pilote et qu'une autre session peut VERROUILLER (vécu
> diagnostic #506). Playwright MCP ne sert que si une capacité MANQUE au kit ; il se lance alors à la
> vue `bureau` de `scripts/recette/vues-recette.json` (`browser_resize` à sa `largeur` × `hauteur`, lues
> dans le fichier) AVANT tout geste.
>
> **L'agent n'a pas de shell libre** : `node -e`, `sh` et PowerShell lui sont refusés. Tout geste
> passe par un script `.mjs` (au scratchpad, importé par `file:///`, cf. plus bas), dont le squelette se
> TIRE du gabarit (`node scripts/recette/gabarit.mjs`, § « Gabarit » ci-dessous).
>
> Une cascade à re-render fréquent passe par des états transitoires (mesure #1117) : `resoudreModales`
> relit une fenêtre sans geste offert pendant `attenteMs` (une seule horloge).

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

**Quel Chrome** (`resoudreChrome`, `lib.mjs`, testée à fixtures) : `CHROME_PATH` d'abord, puis les
chemins Windows de Chrome (sur `win32` seulement), puis le Chromium Playwright de plus haute version sous
`PLAYWRIGHT_BROWSERS_PATH` (défaut `/opt/pw-browsers`, `chromium-<N>/chrome-linux/chrome`) ; en root,
`--no-sandbox` est ajouté. Aucun candidat : refus nommant les chemins essayés.

Le kit ne DÉMARRE **jamais** le serveur de dev — il l'**attend** puis s'y **attache** : `attendreServeur`
(`lib.mjs`) retente une connexion refusée tous les `pasMs` jusqu'à `timeoutMs` (45 s), et sa levée nomme
la DERNIÈRE cause (`causeDeServeur` : connexion REFUSÉE = personne n'écoute ; réponse LENTE = Vite
compile à froid ou la machine est chargée — mesuré de 35 s à 8 min, friction #2290).

> **Le serveur de dev se lance EN TÂCHE DE FOND** (job détaché du shell de l'agent — `run_in_background`
> de l'outil Bash), jamais en avant-plan : le plafond d'une commande d'avant-plan le TUE en pleine
> recette longue (vécu en recette #700 : trois démarrages, ≈ 10 min perdues). Il s'arrête à la fin par
> son PORT (`arreter-dev.mjs`, § « Éteindre son serveur de dev » ci-dessous), jamais laissé vivant.

> **L'étalon se juge aux TROIS VUES, source unique `scripts/recette/vues-recette.json`** (#1847) :
> `bureau` (la fenêtre réelle de l'utilisateur, et le viewport par DÉFAUT du kit), `portable` et
> `mobile` — leurs dimensions se LISENT dans le fichier, jamais recopiées ici. Le fichier ne porte QUE
> des vues ; le kit les expose par `VUES_RECETTE`, `vueRecette`, `VUE_REFERENCE` et l'helper
> `pourChaqueVue`.
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
(défaut CWD), `--url <url>` (défaut : le port de CET arbre, cf. `scripts/port-dev.mjs`), `--mobile` (vue `mobile` de `vues-recette.json`),
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
La MATRICE RESPONSIVE du HUD (design 2026-07-31 §12) se juge sur le RENDU pour les cellules qu'un
DOM de la sonde porte (`defautsMatrice`, `defautsCompacite`, `defautsTactile`, testées à fixtures) :
**Groupe** — toutes les cartes rendues avec leur vie et leur NOM à toute tranche
(`docs/plans/2026-08-16-spec-hud-combat.md:192-194`), la vie superposée au portrait à
561–700, un défilement horizontal de secours ; à ≤560, R-M1 (`:66-68`) : chaque tuile rendue fait
≥ 44px de large et n'est rognée par le champ de la piste que si celle-ci défile ; à ≤560 la bande
REPLIÉE se déplie par clic réel sur sa poignée et le groupe déplié se juge (une ligne, chaque portrait
reçoit son clic — en combat devant le fil d'événements, recouvrement volet × fil imprimé), puis elle
se replie ; **Initiative** — colonne à gauche au-dessus de 900 avec le cartouche de Round rendu DANS
sa boîte (« round intégré »), colonne jusqu'à 701 avec l'entrée au trait entière dans le champ
(« courant entier »), bande à 700 et moins dont la piste est défilable, cartouche de Round en première
entrée, bande sous le groupe à 561–700, courant + deux suivants entiers à ≤560 ; **Dock** — pont de
bord à bord, chaque case entière dans l'écran, hauteur du pont ≤ 21 % du viewport dès 1280px et
≤ 45 % à ≤560 (`docs/plans/2026-08-16-spec-hud-combat.md` Zone 1) ; **compacité** sur la série des
largeurs (cartes et colonne d'initiative plus étroites à 701–900 qu'au-delà de 900, portraits à
561–700) ; **cibles tactiles** : le pointeur grossier est ÉMULÉ (`Emulation.setTouchEmulationEnabled`
fait répondre `(pointer: coarse)`) et chaque commande vissée rendue offre 44px à ≤560. L'ouvreur
d'écran du rail n'est monté qu'avec un navire (`src/ui/CampaignView.tsx`) : la mise en place du combat
pose un `vessel` de campagne.
Cellules NON MESURÉES, et pourquoi :
- **Caméra** `>900`, `701–900`, `561–700` : ces cellules décrivent `ViewControls`, la plaque de
  l'ÉDITEUR — `grep -rn ViewControls src` ne la trouve qu'à `src/ui/editor/EditorCanvas.tsx` et
  `src/ui/gallery/registry.tsx`. L'inspection n'a pas de plaque : c'est le GESTE SECONDAIRE d'un
  jeton ou d'un portrait (clic droit, appui long ; Menu ou Maj+F10 sur un portrait focalisé ; touche
  I, R3 à la manette — #1822), à recetter par ces gestes réels. Au tour d'un héros qui a une cible,
  Tab est la liaison `target-next` (il pose le curseur de combat sur la cible, jamais le focus sur un
  portrait) : le chemin clavier y est Tab puis I, qui inspecte la case du curseur.
- **Dock** `701–900` « dock sur deux rangées au besoin » : conditionnel, aucun rendu ne le rend
  exigible.
- **Dock** `561–700` « actions sur deux colonnes » : la grille du pont (`.cc-dock`) est réécrite sous
  #1856 ; la cellule se mesurera sur la grille qui en sortira.
- **Dock** `<=560` « modales plein écran, corps défilable, actions finales fixes » : la sonde n'ouvre
  aucune modale de jet ; la structure reste gardée par `src/ui/ui-ratchets.test.ts`.
- **Dock** `>900` « disposition de référence » : aucun contrat propre au-delà du bord à bord et du
  budget de hauteur, mesurés.
Le TIROIR DU JOURNAL se juge **ouvert**, en exploration et au premier tour tenu par un héros :
la sonde le déplie par clic réel sur sa poignée (`.ld-btn`), puis vérifie par `elementFromPoint`
les points à 10 %, 50 % et 90 % de hauteur du panneau à chaque largeur. Un tiroir absent, un
panneau fermé ou non rendu, ou des points manquants rendent la sonde explicitement aveugle.
En combat, elle refuse aussi un panneau qui recouvre la console (« recouvre la console de N×Mpx »).
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
(les trois vues de `vues-recette.json`), une conversation EN COURS et le panneau du tiroir-journal DÉPLOYÉ :
c'est là que vit le défaut fondateur du ticket #1848 (le bandeau de dialogue passant sous le pont
léger) et une sonde qui n'irait qu'au combat mentirait par couverture. Elle refuse : un pont
d'exploration absent, un dialogue ou un panneau non montés (elle s'annonce AVEUGLE plutôt que de se
taire), une surface de la rangée du monde qui descend sous le bord haut du pont, plus les deux
détecteurs purs ci-dessous. Une surface PORTÉE par le pont (la commande du tiroir, assise dessus)
est relevée `descendant` : ce n'est pas une occlusion.

**Passe COMBAT** ensuite : le PONT DE CONSOLE dans ses TROIS formes — pont complet (tour du joueur), forme spectatrice
(tour non contrôlé), ouverture de combat — aux vues `bureau` et `portable` de `vues-recette.json`, aux
largeurs 1100 / 900 / 700 / 560 de la charte, et à la vue `mobile`. Refuse : une région qui ampute son contenu (`scrollHeight > clientHeight` sur `.cc-dock` et
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
| `openApp` + `MARQUEUR_MENU` | `openApp(url = DEFAULT_URL, { timeoutMs = 45000, console, ...opts })` — l'URL est le PREMIER argument, `opts` sont ceux de `launchSession`. Attend le serveur (`checkServer`), lance Chrome headless, navigue, puis attend l'app PRÊTE : `__wfrp.screen` posé (chargement async, cf. `src/main.tsx`) ET, sur l'écran `menu`, le menu principal MONTÉ — `MARQUEUR_MENU` = `.menu-tools`, la section « Atelier » qui porte « Scénarios de test », rendue en dernier (friction #2415 : `__wfrp` prêt rendait la main avant le montage, et le premier clic de menu échouait). `timeoutMs` est la borne UNIQUE de l'amorçage : attente du serveur, URL CDP de Chrome (`launchSession`) et app prête — un premier chargement à froid a été mesuré à 21 s sur un worktree neuf. Le refus DISTINGUE « `__wfrp` absent » (mauvaise URL, build cassé, serveur non-DEV), « app trop lente à s'installer » et « app installée, menu non monté » |
| `gotoScreen` | navigue vers un écran via `__wfrp.screen` |
| `shot` | capture PNG nommée (`session, nom, dossier, { ancre, neutraliser = false }`), dossier créé si absent ; rend le chemin écrit. `{ancre}` fait DÉFILER un sélecteur en vue avant la capture — à 360 px les écrans s'empilent et le sujet passe sous le pli. Par DÉFAUT la capture ne change RIEN à l'état qu'elle capture (#2001 E : un `blur` d'office fermait le tiroir du journal avant la photo). `{neutraliser:true}` se DEMANDE : `Escape` si le focus est sur un `<select>` (son popup est NATIF et reste ouvert après `selectOption`), puis `blur` du focus. ⚠ Ce retrait MUTE l'écran : tout ce qui se ferme à la perte du focus se ferme avec lui, et une mesure clavier est cassée — jamais de `shot` neutralisant entre le focus posé et la frappe qui le consomme |
| `dernierTelechargement` | le DERNIER fichier téléchargé par la page (`session, { timeoutMs = 15000 }`) → `{ chemin, nom, contenu }`, contenu lu en UTF-8 : le plus récent du dossier `telechargements` du profil jetable (`DOSSIER_TELECHARGEMENTS`, posé par `launchSession`) que la session n'a pas encore rendu. Attend un fichier COMPLET (aucun `.crdownload`) ; à l'échéance, LÈVE en nommant le dossier et les téléchargements en cours. Geste : cliquer le VRAI bouton d'export (« Exporter JSON », « Exporter forme dépôt (dev) » de l'éditeur), puis lire. Le dossier est purgé avec le profil |
| `consoleGuard` | collecte la console de LA session courante (piège du buffer partagé, § « Pièges vécus » ci-dessous), TOUS niveaux avec leur niveau (`log`, `info`, `warning`, `error`), les exceptions et les entrées `Log` (réseau, 404, CSP, avertissements du navigateur). `errors()` JUGE (erreurs `Runtime` et `Log`, exceptions) ; `warnings()` se LISTE au rendu — une absence d'export n'est jamais un « zéro » ; `log`/`info` sont enregistrés sans juger. « Console à 0 erreur » = `errors()` vide DEPUIS L'AMORÇAGE : `openApp(url, { console: true })` pose le garde AVANT `Page.navigate` (`session.console`), `Log.enable` compris |
| `ouvrirRound` | OUVRE le Round en pause (« Commencer le combat » / « Commencer le round N ») au vrai bouton de phase — `cliquerAction(session, 'round-start', { racine: '.cc-phase' })`. C'est le premier geste après `__wfrp.fight(id)` |
| `finDuTour` | FINIT le tour du héros actif à la PLAQUE `end-turn` : si l'Action n'est pas dépensée, le premier clic ARME le garde-fou (`endTurnArmed`, lu par `__wfrp.battle()`) et un SECOND clic passe la main. Rend le nombre de clics. Le texte de la plaque (« Fin du tourAction non dépensée ») ne se vise pas : c'est son `data-action` |
| `prochainGeste` / `piloterCombat` / `avancerDeRounds` | le PILOTE de combat, au geste du joueur : `prochainGeste(lecture)` (PURE, lecture `LECTURE_COMBAT` = `__wfrp.battle()` + `__wfrp.auto()` + fenêtre au DOM) rend `fini`, `resoudre`, `ouvrirRound`, `finirTour` ou `attendre` ; `piloterCombat(session, { arret, budget = 300 })` boucle observer → geste jusqu'à `arret(lecture)` ou la fin du combat, lève en nommant la dernière lecture, et rend `{ lecture, choix }` (lecture finale ; choix de chaque `resoudreModales`, cumulés). `LECTURE_COMBAT.fenetre` porte l'IDENTITÉ de la fenêtre ouverte (`IDENTITE_FENETRE`, rangée `resoudreModales`), et `arret` est consulté à chaque lecture du pilote ET de `resoudreModales` : la recette s'ARRÊTE sur la modale qu'elle vise, laissée ouverte — arrêt sur la Défense : `piloterCombat(session, { arret: (e) => e.fenetre?.jet === 'defense' })`. `avancerDeRounds(session, n, { arret })` s'arrête au Round courant + n, ou plus tôt sur l'`arret` de l'appelant, même retour |
| `capturerPion` | CAPTURE d'un pion : PNG recadré autour de la case du combattant (`tileScreenPos` de sa position), agrandi `zoom` fois (`Page.captureScreenshot`, `clip.scale`) |
| `espionReseau` ⚠ à POSER AVANT le geste mesuré | les URL que la page DEMANDE : patch `fetch`/`XMLHttpRequest` DANS la page **et** `Network.requestWillBeSent` (CDP), réunis. `await esp.urls()` rend tout, `await esp.correspondant('/source/')` filtre. C'est la preuve d'une requête ABSENTE (« la fiche du Codex ne charge aucun chapitre »). **Jamais l'inventaire de ressources de l'API `performance`** : son tampon est BORNÉ (250 entrées) et l'app le sature à l'amorçage — il a rendu un faux « aucune requête » en recette C5 |
| `freezeTimeout` / `unfreezeTimeout` | monkey-patch `setTimeout` pour figer/dégeler une durée d'animation avant capture |
| `emulateReducedMotion` | force `prefers-reduced-motion: reduce` (CDP `Emulation.setEmulatedMedia`) |
| `setViewport` / `setMobileViewport` | viewport explicite / vue `mobile` de `vues-recette.json` (charte-ui.md — testable dès 360px) |
| `clickButtonByText` | trouve un contrôle (`SELECTEUR_CONTROLES` : `<button>`, `[role="button"]`, `<summary>` — source unique, partagée avec `survoler` et `infobulleDe`) par son NOM ACCESSIBLE (`session, texte, { exact = true, dans, rangee, modifiers, attendreChangement = false, attenteMs = ATTENTE_CIBLE }` — correspondance EXACTE par défaut) : son texte, sinon `aria-label`, sinon `title` (`CORPS_NOM_ACCESSIBLE`, partagé avec `survoler` et `infobulleDe`) — un portrait `button.ptile` ou un bouton du dock d'exploration (`.worldmap-btn`) n'a aucun texte ; `scrollIntoView`, PUIS lit son rect et clique via un VRAI clic CDP (`Input.dispatchMouseEvent` pressed+released) — SCROLL-AWARE : lire le rect AVANT le scroll fait rater le clic SILENCIEUSEMENT (aucune erreur, aucun effet). Correspondance EXACTE par défaut (texte ENTIER, espaces et apostrophes normalisés) — une sous-chaîne trouvait cinq cibles pour « Atelier » ; `{exact:false}` DEMANDE la sous-chaîne, pour un libellé à partie variable ; `{dans}` = sélecteur RACINE où chercher, quand le même libellé vit dans deux zones de l'écran — racine d'une modale : `.modal-overlay` ; racine d'un ÉCRAN PLEIN (`ScreenShell`, `src/ui/ScreenShell.tsx` : bibliothèque de campagnes, carte du monde, port, marché, dossier de navire, carnet, possessions, voyage, hub de ville, sélection du groupe…) : `.worldmap-overlay` — `{ dans: '.modal-overlay' }` n'y trouve RIEN ; `{rangee}` = texte d'une RANGÉE quand chaque rangée d'une liste porte le même bouton (les « Choisir » de la modale « Choisir la campagne » : `{ rangee: 'La Diligence' }`) — seuls comptent les boutons de l'ancêtre le plus proche de ce texte qui en contient un, et une rangée introuvable est un refus qui la nomme (friction mesurée en recette E7, #1343) ; si PLUSIEURS boutons matchent, le premier est cliqué et l'ambiguïté est AVERTIE sur `stderr` avec les textes concurrents ; `{attendreChangement}` (`true` = `DELAI_CHANGEMENT`, 2 s, ou un délai en ms) LÈVE si ni le DOM ni l'état du store n'ont bougé après le clic — un clic sans effet ne passe plus en silence (friction #2290) ; l'empreinte ignore les attributs de RENDU réécrits à chaque image (`ATTRIBUTS_VOLATILS` : `data-rendus`, `data-file` du canevas, `src/gameIso/stage/GameStage3D.tsx`), sans quoi l'écran de jeu « bougerait » sans clic ; `{attenteMs}` borne l'attente d'un recouvrement TRANSITOIRE (rangée `clicReel`) |
| `cliquerSelecteur` | CLIC RÉEL d'un contrôle désigné par un SÉLECTEUR (`session, selecteur, { modifiers, attendreChangement, attenteMs = ATTENTE_CIBLE }`) — le pendant de `clickButtonByText` quand le contrôle n'a PAS de texte (bouton à glyphe : tiroir du journal `.ld-btn`, ouvreur d'écran). SCROLL-AWARE, et il REFUSE en le nommant : cible absente, boîte 0×0 (non rendue), contrôle FERMÉ (refus de `clicReel`, raison citée) — jamais un clic silencieux qui n'a rien fait ; `{attendreChangement}` : même contrôle d'effet que `clickButtonByText`. Il ATTEND l'apparition du sélecteur (`attendreSelecteur`, `attenteMs`, 8 s) : juste après « Scénarios de test », `[data-testid="scenario-launch-embuscade"]` n'est pas monté ; à l'échéance, « cliquerSelecteur : « sel » absent du DOM après N ms » |
| `clicReel` | `clicReel(session, x, y, modifiers = 0, { cible, libelle, bouton = 'left', dureeMs = 0, attenteMs = ATTENTE_CIBLE })` : la triade CDP `mouseMoved`/`mousePressed`/`mouseReleased` — geste de clic UNIQUE du module : tout helper qui clique passe par là, aucun ne la réécrit. Le localisateur MARQUE sa cible (`data-recette-cible`) ; AVANT d'émettre, `clicReel` vérifie que la cible est OUVERTE — sinon il LÈVE en nommant le mécanisme (`disabled`, ou `aria-disabled` de `GatedAction`) et la raison affichée (`aria-describedby`, `[data-gate]`) — puis que `elementFromPoint` au point est la cible ou un de ses descendants, et sinon RELIT jusqu'à `attenteMs` (`ATTENTE_CIBLE`, 8 s) — un recouvrement TRANSITOIRE passe : la scène de dés `div.rm-scene` couvre la fenêtre de Défense le temps du roulis —, puis LÈVE à l'échéance en nommant le DERNIER élément qui recouvre et sa boîte (« … RECOUVRE la cible, toujours après N ms » ; #2220 : une barre de groupe recouvrait l'onglet visé, et le clic partait sur elle). `bouton` (`left`, `right`, `middle`) choisit le bouton pressé, `dureeMs` le temps TENU entre l'appui et le relâchement |
| `clicDroit` | CLIC DROIT réel (`session, cible, { defiler = true, modifiers }`) — `cible` = un SÉLECTEUR, sinon le TEXTE exact d'un contrôle (même résolution pour `appuiLong`, `toucher`, `molette`, `survoler`) —, contrôlé comme `clicReel` (cible ouverte, non recouverte) : le navigateur en tire le `contextmenu`. Rend le point |
| `appuiLong` | APPUI LONG à la souris (`session, cible, ms = 800, { defiler, modifiers }`) : bouton gauche TENU `ms` millisecondes (`clicReel` à `dureeMs`), cible contrôlée comme lui. Rend le point |
| `toucher` | TOUCHER réel (`session, cible, { dureeMs = 0, defiler }`, `Input.dispatchTouchEvent` : `touchStart`, puis `touchEnd` après `dureeMs`), cible contrôlée comme `clicReel`. Rend le point. ⚠ LIMITE CONNUE (#1822) : l'émulation tactile du CDP n'émet ni `contextmenu` ni `pointercancel` pendant un appui long — l'ordre de ces événements sur Android NE SE RECETTE PAS en navigateur ; seul le test unitaire le couvre |
| `molette` | MOLETTE RÉELLE (`session, cible, deltaY, { deltaX = 0 }`, `mouseWheel`) au centre de la partie VISIBLE de la cible — sans `scrollIntoView` : c'est la molette qui fait défiler, comme celle d'un joueur. LÈVE si la cible ne montre rien dans la fenêtre. Rend le point |
| `deplierVers` | AMÈNE un champ à l'écran comme un joueur (`session, selecteur, { pasPx = 240, maxPas = 40 }`) : chaque `<details>` FERMÉ qui l'enveloppe s'ouvre, du plus extérieur au plus intérieur, par un CLIC RÉEL sur son `<summary>`, puis le champ vient par la molette — `scrollIntoView` ne ramène PAS un champ d'un `<details>` replié (#1853 L3, cinq scripts perdus). LÈVE en le nommant : élément absent, `<details>` sans `<summary>`, clic qui n'ouvre pas, boîte nulle, molette qui ne fait plus défiler, crans épuisés. Rend le centre du champ. Les ops d'effet (`details.eff-row`) et les groupes repliés du Codex s'atteignent ainsi ; un geste qui vise une boîte nulle le suggère dans sa levée |
| `ouvrirFiche` | OUVRE la fiche d'une entrée du Compendium AUX GESTES (`session, { groupe, categorie, entree }`) : bouton « Compendium » du menu si `.screen.codex` n'est pas monté, onglet du `groupe` (`[role=tab]` de `.codex-groups`), pastille de la `categorie` (`button.codex-cat`, texte sans son compteur, dépliée de son `details.fold` par `deplierVers`), frappe de l'`entree` dans `.codex-search`, clic de la rangée dont le `.lr-name` vaut `entree`. Rend `{ entree }` | l'entrée se désigne par ses LIBELLÉS visibles : le Codex ne publie aucun id au DOM. LÈVE en nommant les offertes (catégories, dix premières rangées), et si la rangée cliquée n'est pas retenue (`aria-current="true"`). Chemins des niches : § « Chemins canoniques du Codex » |
| `resoudreModales` + `CASCADE_LABELS` + `IDENTITE_FENETRE` | RÉSOUT (`session, etape = 'resoudreModales', { labels, max = 40, pauseMs, attenteMs = 30000, arret }`) toute fenêtre ouverte (`.modal-overlay`) jusqu'à ce qu'il n'y en ait plus — DÉFINITION UNIQUE partagée par les sondes. Deux gestes, dans cet ordre : (1) un bouton d'AVANCEMENT ouvert (`CASCADE_LABELS` : Lancer, Appliquer, Conclure, Poser la zone, Continuer… — aucun nom de RÈGLE n'y figure), cliqué par `cliquerPremierOffert` ; un libellé de SORTIE (`LABELS_DE_SORTIE` : « Fermer ») n'avance jamais une fenêtre à choix. L'avancement PRIME : un groupe d'options FACULTATIF sans défaut — la réaction Porte-Bouclier de la Défense (Avantages à dépenser, aucune option retenue, `useDefenseJetProps`) — n'est JAMAIS tranché à la place du joueur quand « Lancer » est ouvert ; (2) sinon, la **première option OUVERTE** d'un groupe d'options (`OptionChooser` : `.seg`, `.rm-loc-grid`) dont aucune option n'est retenue (`aria-pressed`) — une fenêtre qui ne peut avancer qu'une fois TRANCHÉE, par la FORME du contrôle, jamais par le nom d'une règle. CHOISIR N'EST PAS AVANCER (#2306 B) : après le clic d'une option, la fenêtre est RELUE ; un bouton d'avancement ouvert est pris, même si l'option reste offerte sans être retenue (« Dévier (−1 PA) » d'une Blessure critique). Contrôles lus par `SELECTEUR_CONTROLES`. RENVOIE la liste des CHOIX faits à la place du joueur, `[{ fenetre, option, offertes }]` (fenêtre = nom accessible du dialogue), et imprime chacun une fois son clic ÉMIS (un clic refusé n'est ni compté ni imprimé). Une LEVÉE porte les choix faits jusque-là (`erreur.choix`, `porterChoix`) ; `piloterCombat`, `avancerDeRounds` et `demarrer` les cumulent aussi à la levée. `piloterCombat`/`avancerDeRounds` et `demarrer` les CUMULENT et les rendent (`choix`) ; les recettes committées (`intentions-portee`, `hauteur-reelle`, `hud-clickables`, `console-pont-formes`) les impriment à leur rapport de sortie (`decrireChoix`). Une recette qui attend une option précise l'asserte sur cette liste. `{ arret(identite) }` est consulté à CHAQUE lecture avec l'IDENTITÉ de la fenêtre ouverte — `IDENTITE_FENETRE` : `{ cle, jet, etape, nom }`, où `cle` = l'entrée élue par l'arbitre des modales (`__wfrp.auto().activeModal`, registre `src/state/modalArbiter.ts`), `jet`/`etape` = le `jet` et le `kind` de l'étape de cascade courante (`defense`/`defenseJet` pour une Défense), `nom` = le nom accessible du dialogue — ; vrai = rendre la main, fenêtre laissée OUVERTE : `resoudreModales(session, 'défense', { arret: (f) => f.jet === 'defense' })`. Un GESTE SUR LA CARTE attendu (#2306 A), lu par l'observation du jeu `__wfrp.gesteCarteAttendu()`, LÈVE en le NOMMANT (`GESTES_CARTE`) : « pose de zone en cours, cliquer une case » (après « Poser la zone », la fenêtre se masque), « visée de siège en cours, cliquer une case », « choix de cibles en cours, cliquer les cibles » — le résolveur ne rend JAMAIS la main tant que la carte attend, et `piloterCombat` lui passe la main dès qu'un geste carte est attendu ; le geste est un clic réel sur la case (`__wfrp.tileScreenPos` puis `clicReel`), puis relancer `resoudreModales` (piège « Sort de ZONE » ci-dessous). La fin se juge au STORE. UNE SEULE HORLOGE D'ATTENTE : une lecture qui n'offre rien à résoudre — étape de cascade (`pendingCascade`) sans fenêtre au DOM, OU fenêtre sans option à choisir ni bouton d'avancement ouvert (roulis de 750 ms, cascade Surprise entre « Tout lancer » et « Terminer ») — est RELUE pendant `attenteMs` (30 s) — le même délai borne un bouton RECOUVERT le temps du roulis (`div.rm-scene`, rangée `clicReel`) ; à l'échéance la levée nomme la DERNIÈRE lecture : étape, fenêtre, chaque bouton et son état (désactivés compris). Lève « l'option « X » ne fait pas avancer la fenêtre » quand l'option ELLE-MÊME n'a rien changé : deux clics dont l'empreinte (état des options, longueur du journal, `pendingCascade`) est restée identique — jamais sur des boutons identiques. ⚠ `max` (40) est un BUDGET TOTAL de clics pour fermer la cascade ENTIÈRE, **pas un pas unitaire** : l'helper lève si une fenêtre reste ouverte au bout du budget, donc `{ max: 1 }` ne sert PAS à « avancer d'un cran » — il lève aussitôt. Pour avancer d'UN pas, cliquer soi-même — `cliquerPremierOffert` avec le libellé voulu, ou `cliquerSelecteur` sur l'option visée (friction mesurée en recette #1852, 2026-09-21) |
| `cliquerPremierOffert` | CLIQUE le premier des libellés (`session, libelles, { dans?, offerts?, attenteMs = ATTENTE_CIBLE }`, ordre de préférence, sous-chaîne) qu'offre un contrôle OUVERT de `dans` (`.modal-overlay` par défaut) — la primitive UNIQUE des issues de fenêtre : avancer (`resoudreModales`), quitter un jet (« Renoncer », « Annuler », « Fermer »), fermer un briefing. Rend le texte cliqué ; sans libellé offert, LÈVE en nommant les contrôles ouverts, aucun clic émis |
| `realKey` | frappe RÉELLE (`session, touche`, `Input.dispatchKeyEvent` : `rawKeyDown`/`char`/`keyUp`) — traverse les MÊMES handlers que le clavier physique (`keybindings.ts`), contrairement à un `KeyboardEvent` JS synthétique souvent ignoré. UNE forme d'argument pour toute la famille `realKey*` : la TOUCHE `{ key, code?, windowsVirtualKeyCode?, modifiers? }` — pour Échap, `session` puis `{ key: 'Escape' }` ; seul `key` est requis, `code` et le code virtuel se déduisent de lui (`scripts/recette/lib.mjs`). Un chiffre se déduit en `DigitN` (code virtuel 48-57) : `{ key: '1' }` répond au dialogue. Alias français : `frapperTouche` (même geste, même forme). ⚠ Observé en recette #1752 le 2026-09-17 : `Enter` envoyé sur un `<button>` FOCALISÉ n'a pas activé le bouton (`keydown` reçu, `defaultPrevented:false`, aucun `click`) ; `Space` l'a activé. Une frappe d'activation se mesure donc, elle ne se suppose pas |
| `realKeyDown` / `realKeyUp` + `ALT` / `MOD_ALT` | geste MAINTENU (`session, ALT` — la même TOUCHE que `realKey`, `ALT` imposant `code`/code virtuel) : l'appui et le relâchement sont deux appels, et ce qui se joue ENTRE les deux porte `{ modifiers: MOD_ALT }` (`survoler`, `clickButtonByText`) — sinon l'événement déclare la touche relâchée. C'est le pilotage d'**Alt maintenu** (`decor.reveler`) : halo + plaque de nom sur chaque utilisable visible, le survolé agrandi ; relâché, le champ redevient muet. ⚠ `__wfrp.screen('editor')` charge la scène-FIXTURE, pas la scène active — pour ouvrir un document précis, `editorOpen(id)` ; et un `querySelector` de pastille reste vrai SOUS la modale d'intro (mesurer la scène, pas le seul DOM) |
| `typeInField` | SAISIE réelle dans un champ (`session, selecteur, texte, { clear = true, attendu }`) : focus par VRAI clic CDP — et LÈVE si le champ n'a pas le focus après ce clic, aucune frappe émise (#1853 L3 : un `<input type=number>` hors focus recevait une insertion perdue) —, puis `Input.insertText` — l'insertion passe par le pipeline d'édition, donc le `onChange` React s'exécute (mesuré : `ab12cd` frappé dans `.coop-code-input` se lit `AB12CD`, la casse venant du handler React de `CoopCodeInput`). Rend la valeur relue APRÈS la frappe ; un écart AVERTIT sur `stderr` (transformation du `onChange`, ou frappe additive), `{attendu}` (chaîne ou prédicat) le durcit en ERREUR. C'est la sortie du piège « Champ CONTRÔLÉ React » ci-dessous |
| `selectOption` | CHOISIT une option d'un `<select>` AU GESTE (`session, selecteur, libelle`) — par son LIBELLÉ VISIBLE ; `{ par: 'valeur' }` vise la valeur interne : focus par VRAI clic CDP, `value` posée par le SETTER NATIF puis `input`+`change` dispatchés — un `<select>` ne s'ouvre pas en headless (popup natif, hors DOM), le geste rejouable est celui du clavier. Plusieurs options de même libellé : la PREMIÈRE, et l'ambiguïté AVERTIE sur `stderr` (`avertirAmbiguite`, comme `clickButtonByText`). Refus explicites : liste absente, aucune option ne correspond (les libellés, ou les valeurs, offerts sont remontés), option FERMÉE (`disabled`) — aucun choix émis. Rend `{valeur, libelle}` RELUS après le geste |
| `champParLibelle` | SÉLECTEUR CSS d'un champ visé par son LIBELLÉ VISIBLE (`session, 'dernier bloc'`) : il pose un `data-recette` inerte sur le champ trouvé et rend `[data-recette=…]`. Nécessaire parce que les `id` de `NumberField`/`useId` (`:r5:`, `:ra:`) ne sont PAS des sélecteurs CSS valides — `querySelector('#:r5:')` jette. `{dans}` = sélecteur RACINE où chercher, même option que `clickButtonByText` : sans elle, le PREMIER champ du document qui porte ce libellé est pris — à l'éditeur, le « Nom » de l'inspecteur passe avant celui de la modale « Enregistrer » (`{ dans: '.modal-overlay' }`) |
| `poserFichier` | PEUPLE un `input[type=file]` (`session, selecteur, chemin, {dans?}`) par les appels CDP `DOM.enable` / `DOM.getDocument` / `DOM.querySelector` / `DOM.setFileInputFiles` : l'`input` reçoit son `change` sans aucun dialogue — cliquer son `<label>` ouvrirait le sélecteur de fichier de l'OS, qu'aucun pilote ne ferme. `chemin` est résolu en absolu (et rendu). REFUSE en le nommant : racine `dans` absente, `input` absent |
| `verdictDebordement` | MESURE de la règle stricte 4 à la largeur courante (`session, { dans = 'body', marge = 1 }`) : `{ vw, docSW, debordants:[{tag, aria, droite}] }`. `{dans}` borne la mesure au CALQUE visé (même nom d'option que `clickButtonByText` ; un `{ racine }` est ignoré et la mesure retombe sur `body`) : l'éditeur monté SOUS le calque Narratif n'entre plus au verdict de ce calque (#2001, faux positifs à droite 682) ; calque absent = refus NOMMÉ, jamais un verdict vide. `docSW > vw` = la page pousse latéralement ; `debordants` nomme les contrôles clippés. Un débordement ne se voit pas sur une capture, il se mesure |
| `survoler` | SURVOL RÉEL (`session, sélecteur|texte de bouton`, `Input.dispatchMouseEvent mouseMoved`) — le geste par lequel une raison de refus se lit (arbitrage user 2026-08-24 : survol/focus/tap, jamais inline). SCROLL-AWARE comme `clickButtonByText` ; `{attenteMs}` laisse l'infobulle naître ; `{defiler:false}` survole SANS `scrollIntoView` — la cible doit être déjà à l'écran : c'est la voie d'un test « le survol ne fait pas défiler », que le défilement du helper faussait (friction #700). Rend le point survolé |
| `infobulleDe` | l'infobulle ouverte et sa POSITION relative à la cible : `{ texte, dx, dy }` (écarts entre les deux boîtes, 0 quand elles se touchent). `texte: null` = aucune bulle. Un `dx`/`dy` énorme signe un rect mesuré à 0×0 (vécu : `display: contents` sur l'enveloppe → bulle à (8, 6) pour un contrôle à (1050, 258)) |
| `evaluate` / `waitFor` | eval JS dans la page (attend les promesses) / poll jusqu'à condition vraie |
| `evaluerFn` | ÉVALUE UNE FONCTION dans la page (`session, fn, ...args`) : le corps est sérialisé tel qu'ÉCRIT et les arguments par `JSON.stringify`. C'est la sortie du DOUBLE ÉCHAPPEMENT (voir ci-dessous). La fonction ne capture RIEN de la portée du script |
| `attendreSelecteur` | attend qu'un sélecteur soit PRÉSENT (`session, selecteur, { timeoutMs = ATTENTE_CIBLE, qui = 'attendreSelecteur' }` ; `qui` nomme le geste dans la levée), et REFUSE en le nommant sinon — au lieu d'un `sleep` gonflé « au cas où » qui cache la cause |
| `rechargerEtAttendreMenu` | RECHARGE la page (`Page.reload`) et attend l'app prête, menu monté (même condition qu'`openApp`, `MARQUEUR_MENU`) — jamais l'ancienne page : un témoin posé AVANT le rechargement doit avoir disparu. `{ timeoutMs = 45000 }` ; à l'échéance, LÈVE en le nommant. La voie d'une recette de PERSISTANCE : écrire, recharger, relire |
| `appelerWfrp` | APPELLE `window.__wfrp[nom](...args)` (arguments sérialisés en JSON), en attend la promesse, et LÈVE si le résultat est un REFUS — une chaîne qui commence par « ✗ » (#2001 F3 : `editorOpen` rendait son refus, et le script continuait sur le mauvais document). C'est LA voie d'un helper `__wfrp` depuis un script : un `evaluate` nu laisse passer le « ✗ » en silence. `nom` peut porter son plafond d'évaluation, à régler AU-DESSUS du délai que le helper reçoit lui-même : `ready(timeoutMs = 15000)` borne SON attente d'entrée en scène, d'où `appelerWfrp(session, { nom: 'ready', timeoutMs: 65000 }, 60000)` — `ready` attend 60 s, l'évaluation 65 s (un `{ timeoutMs }` seul laisse `ready` à ses 15 s). Rend le résultat |
| `lireIndexedDB` | LIT, en lecture seule, le magasin `magasin` de la base IndexedDB `base` (`session, base, magasin`) → `[{ cle, valeur }]`. OBSERVATION pure : une base absente n'est jamais ouverte (`indexedDB.open` la CRÉERAIT) — refus NOMMÉ listant les bases présentes ; magasin absent, refus listant les magasins de la base |
| `mesurerProvenance` | MESURE la provenance d'un texte de campagne rendue dans `selecteur` (`ProvenanceDuTexte`, `src/ui/editor/ProvenanceDuTexte.tsx`, #2001) → `{ sujet, mode, options: [{ libelle, retenue, refus }], adresse, detacher, reference }` : `mode` = l'option retenue (`aria-pressed`), `refus` = la raison liée d'une option refusée, `adresse` = le badge de la copie ADRESSÉE, `detacher` = son bouton « Détacher » (`{ ouvert }`, ou `null`), `reference` = le libellé du champ de référence monté (« Source », « Adapté de ») ou `null`. LÈVE si `selecteur` est absent, ne porte aucune provenance, ou en porte plusieurs (viser un conteneur plus étroit). PNJ : « Chemins canoniques de l'éditeur » |
| `attendreServeur` / `causeDeServeur` / `checkServer` / `launchSession` | briques bas niveau d'`openApp` (séparément utilisables) — `attendreServeur(url, { timeoutMs = 45000, pasMs = 1000 })` ATTEND la réponse du serveur (connexion refusée retentée, requête en vol bornée par le temps restant) et la rend, ou LÈVE en nommant la dernière cause ; `causeDeServeur(e)` (PURE) dit cette cause en clair (connexion REFUSÉE, réponse LENTE, échec réseau) ; `checkServer(url, { timeoutMs })` = `attendreServeur` puis le contrôle d'arbre SERVI (`verdictArbreServi`) ; `launchSession` prend pour défaut la vue de RÉFÉRENCE `bureau` (§ « L'étalon se juge aux TROIS VUES » ci-dessus) ; Chrome n'est JAMAIS lancé `detached` (`OPTIONS_SPAWN_CHROME`) ; `close()` rend `{ profilPurge }`, purge VÉRIFIÉE (`purgerProfil`) |
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

**Ouvrir sur un port EXPLICITE et piloter un formulaire aux gestes** — l'URL est le PREMIER argument
d'`openApp`. Sans elle, `openApp` vise `DEFAULT_URL` : `WFRP_DEV_URL` si elle est posée, sinon le port de
CET arbre (`urlDev`, `scripts/port-dev.mjs` — 5173 pour l'arbre principal, port dérivé en worktree lié).
La passer EXPLICITEMENT vise un autre serveur (celui que `npm run dev` a imprimé, s'il diffère) :
```js
import { openApp, gotoScreen, selectOption, clickButtonByText, shot, vueRecette } from './scripts/recette/lib.mjs';
// URL explicite du port dérivé imprimé par `npm run dev` dans CE worktree ; `opts` = ceux de
// `launchSession` (`{ width, height, mobile, chromePath, port }`).
const { largeur, hauteur } = vueRecette('portable');
const session = await openApp('http://localhost:5182/', { width: largeur, height: hauteur });
await gotoScreen(session, 'compendium');
await selectOption(session, 'select[aria-label="Chapitre du passage"]', '21', { par: 'valeur' });
await clickButtonByText(session, '+ Fragment');
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
> (vécu en recette le 2026-09-22). Le squelette imprimé par `gabarit.mjs` (§ « Gabarit ») porte déjà
> ces imports, URL de CET arbre comprise.

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

### Session tenue — `scripts/recette/session.mjs`

Une recette se joue en UNE session tenue entre plusieurs commandes de l'agent (#2306.1) :

```
node scripts/recette/session.mjs ouvrir [url] [--vue bureau] [--inactivite <ms>]   # GARDIEN, lancé EN FOND
node scripts/recette/session.mjs etat                                              # fichier de session, gardien vivant ?
node scripts/recette/session.mjs fermer                                            # idempotent
node scripts/recette/session.mjs purger                                            # profils du kit sans session vivante
```

- Le GARDIEN tient Chrome, l'app et la console depuis l'amorçage (`tenirSession`), publie un fichier de
  session par ARBRE sous `os.tmpdir()` (`fichierDeSession`) et écrit la console, tous niveaux, dans son
  journal. Il se ferme seul après le délai d'inactivité (30 min par défaut).
- Chaque commande est un script `.mjs` CLIENT : `attacherSession()` rend une `session` de même forme que
  celle d'`openApp` ; on joue, on lit, puis `session.close()` DÉTACHE (au niveau navigateur, jamais
  `closeTarget`) sans rien tuer. Refus NOMMÉS sans pendre : aucune session, gardien mort, CDP muet.
- **La console d'un client se lit dans le journal du GARDIEN** (`session.console.errors()` /
  `.warnings()`, découpé à l'attache) — jamais par un `consoleGuard` client : un client qui active
  `Runtime`/`Log` reçoit le PASSÉ de la console.
- **La vue appartient au gardien.** Un client qui émule (`setViewport`) puis se détache laisse la
  fenêtre NATIVE ; son `close` pose le signal `vue`, et le gardien ré-impose sa vue. Le gardien ne voit
  pas ce détachement par le CDP (mesure en tête de `session.mjs`).
- **Orphelins.** Chrome n'est jamais lancé `detached`. Un gardien tué laisse son profil ; `fermer` le
  purge par son CHEMIN enregistré (purge vérifiée et comptée), jamais par une mise à mort d'un PID
  enregistré. `purger` est FAIL-SAFE : chaque profil `recette-cdp-profile-*` porte dans son nom le PID
  du process qui a lancé son Chrome (`nomDeProfil`), et ne se purge que si ce PID est MORT — et, hors
  win32 (où le job object emporte Chrome avec son lanceur), si le Chrome inscrit au `SingletonLock` du
  profil (lien `hôte-pid`) est mort sur CET hôte, ou le verrou absent. Un lanceur ou un Chrome vivant
  compte dans `vivants`. Un nom sans PID, un verrou illisible ou d'un autre hôte : le chemin est LISTÉ
  dans `sansPreuve` et laissé intact. Jamais un âge. Un humain qui a vérifié qu'aucun Chrome n'utilise
  un chemin de `sansPreuve` le retire en une commande : `rm -rf "<chemin>"` (Bash), ou
  `Remove-Item -Recurse -Force "<chemin>"` (PowerShell).

### Mise en place — `scripts/recette/setup.mjs`

`demarrer({ scenario, graine, combat, attacher, session })` ouvre l'app (ou s'attache à la session
tenue, ou reprend la `session` donnée), lance le scénario par `__wfrp.scenario`, attend l'entrée en
scène, résout les fenêtres d'ouverture, puis, si `combat` est donné, pose la rencontre (`__wfrp.fight`)
et OUVRE le premier Round au geste du joueur (`ouvrirRound`). Rend `{ session, choix }` (`choix` : ceux
des résolutions d'ouverture). Sur échec, il ne ferme que la session qu'il a ouverte ou attachée,
jamais celle qu'on lui a donnée. La console depuis l'amorçage est `session.console`. `url` et
`timeoutMs` (120 s) passent à `openApp` quand il ouvre son propre Chrome.

### Gabarit — `scripts/recette/gabarit.mjs`

`node scripts/recette/gabarit.mjs` IMPRIME le squelette d'un script de recette (#2198) : ses imports visent
le gabarit et le kit de CET arbre par leur URL `file:///` (exigée sous Windows pour un script hors de
l'arbre, encadré ci-dessus), et son corps appelle `recette(corps, { attacher = true, scenario, graine,
combat, url })`. `recette` déroule `demarrer` (session TENUE par défaut, `attacher`), puis
`corps({ session, choix })`, puis le VERDICT de console — toute erreur depuis l'amorçage (ou depuis
l'attache) fait LEVER en la citant —, puis `session.close()` (détache une session tenue, ferme un Chrome
ouvert ici) ; elle imprime les choix faits à la place du joueur et les avertissements de console, et
rend `{ choix, avertissements }`.

Le script s'écrit avec l'outil d'ÉCRITURE de fichier (`Write`), au scratchpad — jamais par heredoc, `sed`
ou `node -e` : Git Bash y casse les antislashs, les regex et l'accentué (frictions #2001, 2026-10-06).

### Écran → boutons (vérifiés au code)

| Écran | Contrôles et sélecteurs | Source |
|---|---|---|
| Menu principal | « Nouvelle partie », « Charger une partie », « Jouer en ligne », « Options », « Compendium » ; section « Atelier » (`.menu-tools`, `MARQUEUR_MENU`) : « Éditeur de niveau », « Bibliothèque de campagnes », « Scénarios de test », « Galeries d'art », « Design system » | `src/ui/MainMenu.tsx`, clés `menu.*` de `src/i18n/messages/fr.ts` |
| Scénarios de test | `[data-testid="scenario-launch-<id>"]` par scénario | `src/ui/TestScenariosScreen.tsx` |
| Compendium | `.screen.codex` ; onglets `[role=tab]` de `.codex-groups` ; pastilles `button.codex-cat` (compteur en `span.count`, certaines sous un `details.fold` replié) ; recherche `input.codex-search` ; rangées `.codex-rows button.listrow` (libellé `.lr-name`, retenue = `aria-current="true"`) — `ouvrirFiche` | `src/ui/compendium/CompendiumScreen.tsx` |
| Barre de l'éditeur | « ← Menu », « Fichier ▾ » (`aria-haspopup=menu`) ; items `.menu-item` : « Nouveau projet », « Ouvrir… », « Enregistrer… », « Importer JSON… » (un `<label>` sur un `<input type=file>`), « Exporter JSON », « Exporter ASCII (grilles carte) », « Exporter forme dépôt (dev) », « Avancé — JSON (dialogues, triggers, rencontres) » | `src/ui/editor/EditorToolbar.tsx` |
| Exploration (dock) | carte du monde : `.worldmap-btn[title^="Carte du monde"]` (« Carte du monde — voyager », ou « … voyage interrompu (reprendre) ») — monté SEULEMENT quand la scène est un lieu de la carte du monde ou qu'un voyage est en cours ; `clickButtonByText(session, 'Carte du monde', { exact: false })` le vise par son `title` | `src/ui/ExplorationDock.tsx`, condition dans `src/ui/CampaignView.tsx` |
| Portraits du groupe | fiche d'un héros : `button.ptile[aria-label^="<héros>"]` (`aria-label` = nom, suivi de « — geste secondaire (clic droit, appui long, touche Menu) : inspecter » quand le geste d'inspection est offert) ; `clickButtonByText(session, '<héros>', { exact: false })` | `src/ui/PortraitTile.tsx` |
| Carte de scène (marche) | marcher vers un déclencheur : clic RÉEL sur sa case, `__wfrp.tileScreenPos({x, y})` puis `clicReel` au centre de la boîte rendue — ZQSD/WASD bute contre les décors et n'arrive pas fiablement | `__wfrp` (`tileScreenPos`) |
| Console de combat | fin de tour `.combat-console [data-action="end-turn"]` (`finDuTour`) ; ouverture du Round `.cc-phase [data-action="round-start"]` (« Commencer le combat », `ouvrirRound`) ; cases d'action par `cliquerAction(session, actionId)` | `src/ui/CombatConsole.tsx` |

### Gabarit — Journal adressé dans un projet à copie adressée

Pour recetter une entrée de Journal dont le texte vient du livre par ADRESSE (`descRef`), un projet
minimal pose un trigger dont le flux joue l'effet `journal`. Formes validées par `effectSchema`,
`triggerSchema` (`src/data/schemas/defs-scenes/scene.ts`) et `presetPnjSchema`
(`src/data/schemas/defs-scenes/narratif.ts`) ; l'adresse est reprise d'un projet livré
(`diligence-projet.json`, `narratif.presetsPnj[3].profil.descRef`) :

```js
const descRef = { book: 'ennemi-dans-l-ombre', ch: '01', parts: [{ kind: 'blocs', sec: 'le-barman', secOcc: 2, b0: 0, b1: 0, sum: '32d9b703acdfaede' }] }
const trigger = { id: 'recette-journal', rect: { x: 2, y: 2, w: 1, h: 1 }, once: true,
  flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'journal', descRef } }] } }
const pnj = { id: 'pnj-recette', base: 'humain' }   // narratif.presetsPnj[]
```

`desc` est FACULTATIF à côté de `descRef`, mais `desc: ''` est REFUSÉ (« texte vide ») : l'omettre, ou
y mettre un texte non vide. Le projet se pose par `__wfrp.projectMinimal()`, s'édite, puis
`projectSave(entree)`.

### Lanceur de sonde (valider une forme contre le code réel)

- Un fichier de test du dépôt se lance par `npm test -- <fichier>` : la config de `vite.config.ts`
  charge `setupFiles: src/test-setup.ts`, sans quoi des modules du jeu cassent au chargement.
- Une config vitest MAISON (sans ce `setupFiles`) casse sur les cycles d'import du moteur
  (`clotureAppliers`) : ne pas en écrire.
- Le hook `scripts/hooks/codeur-gates-guard.mjs` REFUSE un `vitest run` sans filtre de fichier (suite
  entière) ; avec un ou plusieurs chemins, il laisse passer.
- Une forme de donnée (schéma zod) se sonde par un script `npx tsx <sonde.ts>` au scratchpad qui importe
  le schéma par son URL `file:///` et imprime `safeParse(v).success` — c'est ainsi que le gabarit
  ci-dessus a été validé.

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
> **W, A, S, D poussent vers le HAUT, la GAUCHE, le BAS et la DROITE À L'ÉCRAN** : c'est la table
> `EXPLORE_STEP` (`src/state/keybindings.ts`), sur les vecteurs écran `DIR_VEC`
> (`src/state/combatCursor.ts`) — pas des axes de grille, d'où des pas en diagonale de grille en vue iso.
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
côté `devtools.ts` se répercute ICI (source unique, jamais une 2ᵉ liste partielle ailleurs). Depuis un
script du kit, un helper `__wfrp` s'appelle par `appelerWfrp(session, nom, ...args)`, qui LÈVE sur un
refus « ✗ … » au lieu de le laisser passer.

### Index par USAGE (`__wfrp` et kit)

Trouver le helper par ce qu'on veut FAIRE ; son détail est à sa rangée (tables ci-dessous pour `__wfrp`,
§ « Socle » pour le kit `lib.mjs`, § « Chemins canoniques » pour les gestes du joueur).

| Je veux… | Helper |
|---|---|
| lancer un scénario, une campagne | `__wfrp.scenario(id, seed?)` · `campaign(id)` · `demarrer({ scenario, combat })` (`setup.mjs`) · squelette : `gabarit.mjs` |
| lancer un combat et l'ouvrir | `__wfrp.fight(id)` puis `ouvrirRound` (« Commencer le combat ») |
| donner des PX | `__wfrp.xp(n)` |
| donner de l'or, un objet | `__wfrp.give(co)` · `giveTrapping(heroId, trappingId, qty?)` |
| poser la faim, la soif, la Chance | `__wfrp.faim(id, etat)` · `soif(id, etat)` · `chance(id, n)` |
| poser un talent, un État, une maladie | `__wfrp.talent(id, talentId)` · `condition(id, nom, n)` · `disease(heroId, maladieId)` |
| ouvrir une Défense | `__wfrp.attaque(attaquantId, defenseurId)` |
| s'arrêter sur une modale précise | `resoudreModales(session, etape, { arret })` · `piloterCombat(session, { arret })` |
| finir un tour, avancer de N Rounds | `finDuTour` · `avancerDeRounds(session, n)` · `__wfrp.fastForward()` |
| donner le tour, placer un combattant | `__wfrp.turn(id)` · `place(id, {x, y})` |
| lire le set d'armes, les armes tenues | `__wfrp.loadout(heroId)` · `battle().combatants[].armes` |
| viser une case, un pixel, une arête | `__wfrp.tileScreenPos({x, y, z})` · `pickTileAt({x, y})` · `areteScreenPos(x, y, z, dir)` |
| savoir si la carte attend un geste (zone, siège, cibles) | `__wfrp.gesteCarteAttendu()` · levée nommée de `resoudreModales` (`GESTES_CARTE`) |
| viser une arête dans l'éditeur | `__wfrp.editorAreteScreenPos(x, y, z, dir)` |
| ouvrir une fiche du Compendium | `ouvrirFiche(session, { groupe, categorie, entree })` |
| viser une route de la carte du monde | `__wfrp.routes()` puis `clickRoute(id)` |
| compter les corps d'un acteur à chaque image | `__wfrp.echantillonner('corps', id)` puis `echantillons()` |
| ouvrir un document à l'éditeur, y préparer une entité | `__wfrp.editorOpen(id)` · `editorPatchEntity(id, patch)` |
| lire le brouillon de l'éditeur | `__wfrp.editorEntities()` · `editorWorldMap()` |
| poser un projet en bibliothèque | `__wfrp.projectMinimal()` puis `projectSave(entree)` |
| cliquer un contrôle (texte, sélecteur, case de console) | `clickButtonByText` · `cliquerSelecteur` · `cliquerAction(session, actionId)` |
| clic droit, appui long, toucher, molette, survol | `clicDroit` · `appuiLong` · `toucher` · `molette` · `survoler` |
| atteindre un champ dans un `<details>` replié | `deplierVers` |
| frapper une touche, saisir un champ, choisir une option | `realKey` · `typeInField` · `selectOption` |
| lire un téléchargement | `dernierTelechargement` |
| lire IndexedDB | `lireIndexedDB` |
| mesurer la provenance d'un texte de campagne | `mesurerProvenance` |
| recharger la page et attendre le menu | `rechargerEtAttendreMenu` |
| mesurer un débordement à 360 px | `verdictDebordement(session, { dans })` |
| capturer l'écran, un pion | `shot` · `capturerPion` |
| lire la console | `session.console.errors()` / `.warnings()` · `consoleGuard` |

### Scène / navigation

| Helper | Usage | Limites connues |
|---|---|---|
| `state()` | instantané `{screen, sceneId, partyPos, inDialogue, inCombat, party, money…}` | lecture seule ; PROJECTION CURATÉE, pas le store : **`state().battle` n'existe PAS** (`devtools.ts` n'expose que `inCombat: !!s.battle`) — pour le combat, lire `battle()` ou `store.getState().battle` ; `party` est une PROJECTION allégée (`{id, name}` seulement, `devtools.ts`) — ni `.skills` ni `.activeEffects` ; pour inspecter le détail d'un héros, lire `store.getState().party` |
| `net()` | vue RÉSEAU du siège local `{mode, mySeat, roomCode, gmSeat, ownership, seatNames, presence}` (`state()` n'expose rien de `net`) | lecture seule (copies) ; `gmSeat` `undefined` = camp ennemi à l'IA ; `presence` n'est peuplée QUE côté hôte. Pour AGIR sur le réseau (héberger, rejoindre, attribuer), passer par `store.getState()` — `net()` n'a aucun effet de bord |
| `entities()` | cartographie des entités de la scène `{id,label,kind,pos,access}` | exclut les entités `hiddenUntilCombat` |
| `screenPos('id')` | bounding box ÉCRAN (`{x,y,width,height}`) du nœud `[data-cid="id"]` | lecture seule. ⚠ **CADUC pour les JETONS depuis le monde volumique** (#1176, C5a ; mesuré en recette 2026-08-14, cf. #1296) : les corps sont peints dans le canevas WebGL et ne portent plus AUCUN `data-cid` (`stage/spritePicker.ts`, `stage/GameStage3D.tsx`) — `screenPos` y rend `null` pour un combattant ou une entité. Restent adressables par ce canal : les STRUCTURES de siège, dont l'arête porte le `data-cid` du Combattant-mur (`stage/AreteOverlay.tsx`, peuplement `state/aretes.ts`) — l'arête est ancrée sur la case du MUR (sa prise suit le lift du mur), et n'est offerte que PENDANT mon tour : hors tour, aucun contrôleur, donc `screenPos` rend `null`. Pour armer le siège d'un coup de main, `quality('id', 'Siège')` pose l'Atout sur l'arme active (table des tricheurs ci-dessous) ; pour vérifier ce qu'un 1er clic a ARMÉ, lire `battle().preview`. En **vue du DESSUS** (#1176, P3-5c), les pions redeviennent du SVG : chaque jeton y porte un groupe `[data-pion-cid="id"]` (et, dans les deux vues, son chrome porte `[data-chrome-cid="id"]`) — ces nœuds-là sont mesurables, et le pion est CENTRÉ sur sa case (viser le centre de la bbox, pas son bas). **Replis** : (a) agir par les BOUTONS réels de l'UI (HUD, ordre de tour, panneaux) ; (b) pour les raccourcis liés à `e.code`, passer par la voie CDP `realKey` (§ manette/clavier) ; (c) pour viser une CASE, `tileScreenPos` (ci-dessous), qui ne dépend d'aucun `data-cid`. Le repère de clic historique reste valable là où un `data-cid` existe : **viser `{x: x+width/2, y: y+height}` (le BAS de la bbox, pied du token)** plutôt que le centre géométrique — une bbox de créature haute est étirée vers le haut, le centre tombe hors silhouette (résidu #199). Port du serveur de dev : celui de `.claude/launch.json` (5191), pas le défaut Vite |
| `tileScreenPos({x,y,z?})` | **un SEUL argument, un OBJET** (`tileScreenPos(tile: { x, y, z? })`, `state/devtools.ts`) — ex. `__wfrp.tileScreenPos({ x: 2, y: 5 })`, ou `{ x: 2, y: 5, z: 1 }` pour un étage. ⚠ **piège mesuré** : `tileScreenPos(2, 5)` (deux nombres) ne lève RIEN — le second argument est ignoré, `tile.x`/`tile.y` sont `undefined` et la bbox rendue est un rectangle de `NaN`, que `browser_evaluate` sérialise en `{"x":null,"y":null,"width":null,"height":null}` : un `null` de forme, pas un « hors scène ». Même bounding box ÉCRAN pour une CASE, vide comprise — projetée par `diamondCorners` (`src/geometry/iso.ts`, la géométrie du rendu) puis passée par la CTM du groupe caméra, donc zoom/panoramique/rotation viennent du DOM | lecture seule ; `null` hors scène ou tant que le stage n'est pas monté. Pour un clic, viser le CENTRE (`{x: x+width/2, y: y+height/2}`) : contrairement à un token, une case n'a pas de pied. Vérifié aux 8 crans de caméra contre `screenPos` du jeton du groupe (écart ≤ 6px sur une tuile de 93px = l'ancrage propre du sprite) |
| `areteScreenPos(x, y, z, dir)` | centre ÉCRAN du trait de CHAQUE geste d'arête offert sur ce côté de case → `[{ x, y, libelle, capacite }]` (`libelle` = l'`aria-label` du trait, `capacite` = son `data-arete-cible`), du plus proche au plus éloigné de l'étage `z` — l'arête est ramenée à sa forme canonique (`canonEdge`) et projetée par la géométrie du peintre (`tileEdge`, `src/geometry/iso.ts`) sur la projection de `tileScreenPos`. C'est la visée d'un geste d'arête au clic réel (sauter par une fenêtre : le trait `[aria-label="Sauter en bas (4 m)"]`, friction #700) au lieu d'un balayage `pickTileAt` | lecture seule ; JEU seulement, aucune variante éditeur. Refus NOMMÉS (`✗`) : hors scène, stage non monté, aucune arête utilisable à cet endroit dans l'état courant (brouillard, contrôleur, étage actif). Cliquer par `cliquerSelecteur` sur l'`aria-label` rendu quand il est unique, sinon `clicReel` au point rendu ; position à relire après tout geste de caméra |
| `gesteCarteAttendu()` | le geste que la CARTE attend, ou `null` : `{ kind: 'zone' \| 'siege', label, casterId, radius, rangeTiles }` (pose de zone d'un sort ou d'un pilonnage, rayon et portée en cases depuis l'ancre `casterId`) ou `{ kind: 'cibles', label, casterId, cibles }` (cibles supplémentaires d'une incantation, `cibles` = ids déjà retenus) — type `GesteCarteAttendu`, `src/state/devtools.ts` | lecture seule, lue aux prédicats du jeu (`placingZoneOf`, `pendingCast.pickingTargets`). La fenêtre est masquée pendant ce geste : `resoudreModales` LÈVE en le nommant (`GESTES_CARTE`), le geste se fait par `tileScreenPos` puis `clicReel` |
| `pickTileAt({x,y})` | l'INVERSE de `tileScreenPos` : ce que le PICKING RÉEL résoudrait sous ce PIXEL D'ÉCRAN — `{tile:{x,y,z}|null, cid, via:'sprite'|'decor'|'meuble'|'pas-etage'|'sol'|'aucune', nature:'case'|'combattant'|'entite', geste:{entId?}}`, plus `entId` quand `nature` vaut `'entite'`. **`geste.entId` = l'entité qu'un CLIC à ce pixel traiterait vraiment** (dialogue, marchand, place à s'asseoir) : le verdict dit ce que le pixel FRAPPE, `geste` dit ce que le geste SERT — un PNJ ancré sur la case rend `nature:'case'` (aucun rayon ne nomme un personnage hors combat) et ouvre pourtant son dialogue. Les deux sortent de la fonction que le hook appelle (`stage/geste.ts:entiteDuGeste`), jamais d'une copie : `geste.entId` absent = le clic ne traite aucune entité. La CHAÎNE ENTIÈRE est PARTAGÉE par construction avec le geste (`stage/pickResolve.ts:resoudrePixel`, appelé par `stage/useStagePointer` comme par `stage/pickProbe`) : inversion du pixel (`stage/pickResolve.ts:pointStageSousPixel`) → rayon → meuble dessiné → pas inter-étages → case marchable → sol cross-couche ; la sonde n'a AUCUN étage propre, et la pose qu'elle inverse (projection, caméra du rendu, zoom) est celle que l'hôte a publiée (`stage/spritePicker.ts:CadreRendu`), jamais le store | lecture seule, ne clique RIEN. **L'outil du clic « qui ne fait rien »** : le `via` NOMME l'étage qui a tranché : `'decor'` = le rayon a touché un décor volumique, le clic part sur SA case d'ancrage ; `'meuble'` = aucun rayon ne l'a touché (plateau fin) mais c'est bien la case du meuble DESSINÉE sous le pixel ; `'pas-etage'` = un franchissement vertical voisin du groupe ; `via:'sprite'` avec un `cid` inattendu = un CORPS couvre la case visée (engin 2×2, créature haute) et le clic part sur l'ENTITÉ, pas sur le sol ; `tile:null` = aucune surface résolue à ce pixel (hors carte, ou étage sans surface). Vérifier AVANT de conclure à un bouton/overlay mort, et TOUJOURS relire après un geste de caméra. **Ne rend QUE la bbox de la CASE** : pour viser un CORPS dressé, voir « Cibler un sprite HAUT » (Pièges vécus) |
| `corps(id)` | corps VISIBLES de l'acteur `id` — seul, ou dans un couple monté — à la DERNIÈRE image rendue : le rendu déclare chaque image après `renderer.render` (`setImageRendue`, `src/gameIso/stage/GameStage3D.tsx`), la lecture est `corpsDeLActeur` (`src/gameIso/stage/corpsActeur.ts`) | lecture seule ; `null` tant qu'aucune image n'est rendue. Une lecture ponctuelle tombe ENTRE deux images : pour un geste bref, échantillonner (rangée suivante) |
| `echantillonner('corps', id)` / `echantillons()` | arme l'échantillonnage : une entrée `{ image, corps }` PAR IMAGE RENDUE, lue dans la page au moment où l'image est déclarée (`image` = `canvas.dataset.rendus`, numéro de l'image ; seul le canevas de la première image est retenu) ; `echantillons()` RELIT puis VIDE le tampon | lecture seule. Un rechargement Vite efface l'échantillonnage ; réarmer remet le tampon à vide ; sans armement, `echantillons()` rend `[]`. Mode d'emploi sous cette table |
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
| `editorWorldMap()` | LECTURE SEULE du BROUILLON de carte du monde ouvert à l'éditeur (#2306) : `{ id, label, lieux, routes }` — lieux `{ id, label, scene, pos, when? }`, routes `{ id, a, b, km, when?, refus? }` —, `null` si le projet n'en porte aucune | lecture seule. ⚠ `routes()` lit la carte du STORE DE JEU, PAS le brouillon. Même pont et même attente qu'`editorEntities` ; rejet NOMMÉ si l'éditeur ne se monte pas |
| `editorAreteScreenPos(x, y, z, dir, montageMs = 3000)` | point ÉCRAN du milieu de l'arête `dir` de la case (x, y) à l'étage `z` dans le canevas de l'ÉDITEUR, par la projection de sa vue (rotation, plan/iso, zoom, panoramique) — là où un VRAI clic de l'outil murs résout l'arête. Symétrique éditeur d'`areteScreenPos` ; `Promise` (`await`) | même voie et même attente qu'`editorEntities` ; refus NOMMÉ « ✗ canevas de l'éditeur non monté (aucune CTM) » |
| `editorPatchEntity(entityId, patch)` | PRÉPARE l'état d'une entité de la scène OUVERTE à l'éditeur : patch PARTIEL, une clé à `undefined` vaut ABSENTE. Le TYPE ne se retire PAS : le patch passe la porte d'authoring (`state/sceneEdit.ts:editEntity`, #877/#1882), qui refuse la transition « un porteur du type avant, aucun après » (`TypeNonNomme`) — l'état fautif qu'une porte doit refuser se fabrique par un type INCONNU du catalogue : `editorPatchEntity('p0', { ref: 'decor-absent' })`. Même voie qu'`editorOpen` : le pont d'INTENTION `state/editeurBridge` (commande `patcherEntite`), jamais une remontée du fiber React de `.editor-inspector` | SETUP seulement — préparer l'état, jamais déclencher le flux mesuré (c'est « Fichier → Exporter JSON » ou « Importer JSON… » qu'on clique ensuite à la main). QUATRE refus NOMMÉS : rejet si l'éditeur ne se monte pas (3000 ms, le message porte le helper appelé), `✗ « id » introuvable` listant les ids de la scène, `✗` sur une clé d'IDENTITÉ (`id`, `kind`) qu'aucun patch ne touche, et `✗` sur un type retiré, qui nomme le porteur absent. Le patch passe par le seam d'assise unique (`state/sceneEdit.ts:editEntity`) : il est ANNULABLE (Ctrl+Z) et normalisé comme une édition d'auteur. ⚠ « ABSENTE » vaut au DOCUMENT : en mémoire la clé reste présente à `undefined` (`{ ...e, ...patch }`, `state/sceneEdit.ts:patchEntity`) — `'ref' in ent` rend encore `true`, c'est la sérialisation (`JSON.stringify`) qui la fait disparaître, et le schéma qui la lit comme manquante |
| `projectMinimal(id?, label?)` | rend une entrée de BIBLIOTHÈQUE DE PROJETS (`SavedProject`) minimale et VALIDE — une scène vide (`emptyScene`) enveloppée par `documentDeProjet`, identité d'un projet d'auteur (`MAISON_PROJET_AUTHORE`) : elle passe `parseProject`. Rien n'est écrit | SETUP seulement : la recette la DÉFORME pour son cas (jamais un document recopié du schéma, où un champ oublié — `maison` — fait refuser PLUS TÔT que le refus mesuré), puis la pose par `projectSave` |
| `projectSave(entree)` | POSE l'entrée en bibliothèque par la fonction du même nom (`projectSave`, `state/projectLibrary.ts`) : le cache de `projectsLoad` est mis à jour, AUCUN rechargement de page requis (`✓ projet « id » posé…`, `✗` portant le message de l'écriture en échec) | SETUP seulement. Aucune porte : une entrée déformée se pose telle quelle. Les écrans qui listent les projets (« Ouvrir » de l'éditeur, bibliothèque de campagnes) lisent le cache à leur OUVERTURE (`useState(() => projectsLoad())`) : poser AVANT de les ouvrir, sinon les fermer et rouvrir. Setup et geste tiennent dans UNE session (`restaurerStockage` à `session.close()`, § « Pièges vécus ») |
| `roofCut(on=false)` | lève-toit ON/OFF — `roofCut(false)` débraye le dégagement de la pièce occupée : toits, façades et décors de toit RESTENT peints même quand le groupe entre dans l'empreinte, **hors le disque local de perçage autour de chaque héros** | bascule GLOBALE — remettre `roofCut(true)` avant de valider un flux de vue réel (symétrique de `fog`). Ne débraye QUE le dégagement de PIÈCE : le perçage par occlusion (#1176 M3, `src/gameIso/stage/percage.ts`) reste actif, donc un trou subsiste dans la nappe au-dessus d'un héros qu'elle cache |
| `labels(on?)` | overlay debug de coordonnées sur la carte | bascule ; zéro coût si OFF |
| `visibleCount()` | `{visible, explored, total}` sur l'état VIVANT — cases VUES (`computeStateVisible`, la dérivation du rendu, composée telle quelle), cases EXPLORÉES de la scène courante, cases construites (dimensions × étages) | lecture seule ; chiffre une révélation (cloison qui laisse voir, lampe allumée) sans lire la carte au pixel. ⚠ `fog(false)` force `visible` = `total` (REVEAL_ALL) — remettre `fog(true)` avant de mesurer |
| `walls(structure?)` | arêtes de `scene.walls` : sans argument, un DÉCOMPTE par `structure` (`Record<id, n>`, arêtes nues sous `(sans structure)`) ; avec un id de Structure, la liste `{x,y,z,side,structure,window,door,closed}` | lecture seule ; `closed` n'est rendu que pour une PORTE et vaut son état VIVANT (`doorIsOpen`, flags de scène), jamais le seul champ authoré |
| `go('scene-id', entry?)` | saute vers une scène du projet | scène inconnue → message `✗`, scène inchangée |
| `fight(encounterId?)` | sans argument : liste les rencontres de la scène ; avec id : lance le combat | le combat s'ouvre sur la pause de début de Round : « Commencer le combat » est le geste du JOUEUR qui suit — `ouvrirRound` (`lib.mjs`), ou `demarrer({ combat })` (`setup.mjs`) |
| `store` | store Zustand brut (`getState`/`setState`) | **dernier recours** (doctrine ci-dessus, §3) — ⚠ **`setState` brut peut CORROMPRE l'état sans récupération** (pas de validation/dérivations liées, contrairement aux actions du store) : un état incohérent après un `setState` direct impose un RELOAD complet, pas un simple retour arrière. `store` = LECTURE (`getState()`) ; toute mutation passe par un helper `__wfrp` ou une vraie action du store (`getState().xxx()`), jamais `setState` à la main sur un flux qu'on valide |

**Échantillonner CHAQUE image pendant un geste bref — mise en selle, descente (#2198)** : une capture ou
une lecture `corps(id)` tombe ENTRE deux images (la descente de #2097, 417 ms, n'a jamais été filmée).
L'échantillonnage lit DANS la page, à chaque image déclarée, sans dépendre du rythme du script ; le
geste reste celui du JOUEUR (« Monter », action `mount` sur la pastille de la monture ; « Descendre »,
action `dismount` — `src/data/actions.json`) :

```js
await appelerWfrp(session, 'echantillonner', 'corps', idCavalier);   // armé JUSTE avant le geste
// … le geste réel (clic de « Monter »), puis la fin du geste lue à l'état :
await waitFor(session, `!!window.__wfrp.store.getState().battle.combatants.find((c) => c.id === '${idCavalier}')?.mountId`);
await sleep(1000);                                                  // l'animation s'achève, les images s'accumulent
const images = await appelerWfrp(session, 'echantillons');           // [{ image, corps }], tampon vidé
```

Verdict : `images.every((e) => e.corps === 1)`, ET des numéros `image` CONTIGUS (un trou = des images non
vues : canevas remonté, rechargement). Réarmer `echantillonner` avant la descente (attente sur
`mountId` ABSENT) et juger chaque geste sur SON tampon — jamais un tampon commun aux deux gestes.

### Combat — lecture / ciblage

| Helper | Usage | Limites connues |
|---|---|---|
| `battle()` | snapshot combat (round, actif, modales, `preview`, `endTurnArmed`, combattants une ligne chacun — dont `armes: [{ label, trappingId, formeChoisie, formeResolue }]`, les armes TENUES) | lecture seule. `preview` = l'APERÇU ARMÉ brut du store (`BattleState.preview` : `kind`, `path`, `tile`/`targetId`, `cost`…), pas une projection de recette — c'est lui que le 2ᵉ clic commet (`state/targetingModes.ts`, `samePreview`) : un 1er clic qui n'arme pas le geste attendu se lit ICI, avant de conclure à un clic mort |
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

> **Ouvrir le Codex EN COMBAT** : par le lien de l'objet (ou de la race, de la carrière…) dans la fiche
> du héros — un `CodexRef` —, qui ouvre le Compendium en MODALE par-dessus le combat (`.codex-modal`,
> `CodexOverlay` de `src/ui/App.tsx`). Le bouton livre du coin de la console est le JOURNAL de combat,
> pas le Codex. En dev, le premier chargement du Codex prend plusieurs secondes (chunk paresseux,
> `lazy`) : attendre la modale par une CONDITION (`attendreSelecteur(session, '.codex-modal')`),
> jamais par un délai fixe.

### Combat — triche de mise en place

| Helper | Usage | Limites connues |
|---|---|---|
| `spawn(creatureId, pos?, {side?, id?}?)` | instancie une créature du REGISTRE (`creatures.json`) directement EN COMBAT — par la porte `spawnEnemy` (`src/state/spawn.ts`) du peuplement de scène, sans rencontre de scène. `spawn('gobelin')` / `spawn('gobelin', {x:12,y:8}, {side:'hero'})` | `pos` défaut : à côté du combattant ACTIF (sinon 1er combattant positionné) ; `opts.side` (`'enemy'` défaut / `'hero'` / `'npc'`) pose `kind` après coup — `'hero'` marque aussi `aiControlled` (allié PNJ piloté par l'IA, jamais un 5ᵉ héros manuel) ; `creatureId` inconnu → `✗` |
| `turn('id')` | donne le TOUR à un combattant (réinitialise Action/Mouvement) | Refus NOMMÉS (`✗`) : pas de combat, absent de l'ordre d'initiative, hors de combat, et pendant la PAUSE de début de Round (« ✗ pause de début de Round : ouvrir le Round d'abord (__wfrp.confirm()) »). Saute les bornes de Round — mise en place, pas simulation de partie. **Ne DÉCLENCHE PAS l'IA** (mesuré #1135) : positionne l'index de tour SEULEMENT (`battle.turn`), aucune logique de début de tour n'est invoquée — un ennemi conduit par l'IA reste immobile. Enchaîner `fastForward()` pour qu'il agisse. **Ne purge PAS l'armement de fin de tour** (`battle.endTurnArmed`, deux temps « Finir quand même ? ») : rappeler `turn()` sur le MÊME combattant au même Round après un cycle armé→confirmé peut retrouver l'empreinte d'économie de l'armement et afficher « Finir quand même ? » d'emblée — prendre un combattant vierge ou changer de Round (mesuré recette P2-A) |
| `attaque(attaquantId, defenseurId)` | SETUP : POSE l'attaque d'un combattant PILOTÉ PAR L'IA sur un défenseur CHOISI et OUVRE la modale de Défense de ce dernier — c'est son CONTENU qu'on recette (parade du porteur d'une arme, options offertes). La fenêtre s'ouvre par la couture de la déclaration d'attaque de l'IA (`combatFlow.ts:maybeOpenDefense`), au tour de l'attaquant, qui lui est donné si besoin : sa fermeture reprend ce tour comme après une attaque d'IA | Refus NOMMÉS (`✗`), sans rien toucher : pas de combat, combattant introuvable ou hors de combat, attaquant absent de l'ordre d'initiative ou PILOTÉ PAR UN JOUEUR (son attaque passe par la modale d'attaque), Défense déjà ouverte, PAUSE de début de Round (« ✗ pause de début de Round : ouvrir le Round d'abord (__wfrp.confirm()) »), tour en cours d'un combattant PILOTÉ PAR L'IA dont les minuteurs sont en vol (« ✗ tour de X, piloté par l'IA (minuteurs en vol) : attendre la main d'un joueur (__wfrp.fastForward()) ») ; puis, si la couture ne l'ouvre pas, la raison : défenseur non surfacé (piloté par l'IA), pas au contact (`place()` d'abord), incapable de se défendre (`cannotDefend`), aucune Défense opposable à l'arme. Ensuite : la répondre aux vrais boutons, ou `resoudreModales` avec un `arret` sur `jet === 'defense'` pour la laisser ouverte |
| `place('id',{x,y})` | téléporte un combattant | **PIÈGE COMPOSITE (corrigé)** : cible une coque à postes (`postes` non vide) ou un membre de `ShipPoste.crewIds` → déplace la FORMATION ENTIÈRE (coque + tout l'équipage des postes) du même delta, MÊME sémantique que la poussée (`pushCommitTile`). Téléporter la coque SEULE désynchronisait aperçu (postes) et portée réelle (équipage resté en arrière) — 30 % du budget d'une recette perdu à débugger ce déphasage avant fix. Retourne `{msg, moved:[ids]}` en cas composite, une chaîne sinon (combattant simple inchangé). |
| `turnShip('id','tribord'\|'babord'\|crans)` | vire le cap d'un navire (triche, sans jet) | ne déplace QUE le cap (`facing`), jamais la position — vérifier ensuite avec `aim()` |
| `maneuver('id', side?, helmsmanId?)` | manœuvre RÉELLE (Test de Navigation, peut échouer) | contrairement à `turnShip`, PEUT rater — pas une triche. Un raté rend « ✓ Test joué : <navire> rate la manœuvre (DR n) — cap <cap> inchangé » : le `✓` dit que le Test est JOUÉ, pas réussi — lire le DR et le cap |
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
| `trait('id', traitId, { arg?, value? })` | pose un Trait de créature sur un combattant, hors combat compris, par `grantTrait` (`engine/grantedTraits.ts`, le noyau de l'op homonyme et d'`attachMutation`) ; `arg` (Cible, Domaine…) et `value` (indice) ; rend l'état RÉEL relu au store | `traitId` inconnu → `✗` |
| `spell(heroId, spellId)` | MÉMORISE un sort au grimoire d'un héros par l'effet `learnSpell` — il ne le lance pas | `✗` nommé : sort inconnu, héros introuvable, sort déjà connu, aucun Talent de lanceur pour ce sort (`verdictApprentissage`) |
| `station(heroId, stationId \| null)` | POSTE un membre d'équipage à une station de navire par l'action RÉELLE `setShipStation` (celle de la fiche de bord) ; le porteur peut n'être que dans la file de combat | `✗` si le héros est introuvable (ids du groupe listés) |
| `shipCrit(location = 'greement', { hullId?, forcedCritRoll? })` | inflige un CRITIQUE DE NAVIRE à une Localisation VOULUE, par le VRAI pipeline (`applyHullCriticalToTarget`) : seul le dé de localisation est imposé. Coque par défaut : celle des HÉROS (plan de voyage, puis coque dont l'équipage porte un héros) ; `hullId` tranche | `✗` nommé : coque introuvable, PLUSIEURS coques sans celle des héros, aucune coque en jeu, Localisation absente de ce gréement. Usage : « Chute du gréement » ci-dessous |

### Groupe / campagne / règles

| Helper | Usage | Limites connues |
|---|---|---|
| `give(gold=10)` | crédite la bourse | — |
| `xp()` / `xp(n)` | `xp()` LIT les PX de chaque héros là où le jeu lit (`[{ id, label, xp }]`, combattant en combat) ; `xp(n)` donne d'abord n PX au groupe par l'effet `giveXp` (MISE EN PLACE « donner des PX »), puis lit | — |
| `faim(id, etat?)` / `soif(id, etat?)` | FAIM / SOIF d'un combattant (`Combatant.hunger` / `thirst`), lues là où le jeu lit (`actorIn`) : sans `etat`, OBSERVE ; avec, POSE d'abord l'état par `ecrireActeur` (en combat comme hors combat), puis lit. `etat` PARTIEL (`{ days, tests, failures }`), complété à zéro ; `null` = champ absent (nourri, désaltéré) | MISE EN PLACE ; `✗` si le combattant est introuvable, ou si un compte n'est pas un entier positif ou nul |
| `chance(id, n?)` | points de CHANCE d'un combattant (`Combatant.fortune`), lus avec son Destin : `chance(id)` OBSERVE → `{ id, label, fortune, fate }` ; `chance(id, n)` POSE d'abord n points par `ecrireActeur` (en combat comme hors combat), puis lit | MISE EN PLACE ; `✗` si le combattant est introuvable, ou si `n` n'est pas un entier positif ou nul |
| `loadout(heroId)` | OBSERVATION du set d'armes, lu là où le jeu lit : `set` (libellé), `principale` et `seconde` (`{ uid, trappingId, label, bouclier }`), `tenues` (armes dérivées), `armeDeParade` (la première tenue, celle que la défense prend par défaut) et `defense` (`bestDefenseMode` : `parade` ou `esquive`) | lecture seule ; `✗` si le combattant est inconnu |
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
| `rules(id?, value?)` | lit/force une règle optionnelle (`policy.ts`) | **ASYMÉTRIE À CONNAÎTRE** : `rules(id, value)` est une surcharge **RUNTIME NON PERSISTÉE** (elle meurt au rechargement), tandis que `rules(id, null)` réinitialise **ET purge la surcharge PERSISTÉE** (`resetHouseRule` → `localStorage['wfrp4.house-rules']`). Une règle cochée un jour au **panneau Options** (seule couture qui persiste, `setHouseRule`) revient donc COCHÉE à chaque ouverture tant qu'elle n'est pas réinitialisée — piège vécu (#1279 : « Jeux de taverne rapides » retrouvée active 3 runs de suite malgré deux `rules(id, false)`). **Vérifier l'état PERSISTÉ en fin de run** : `localStorage.getItem('wfrp4.house-rules')`. La CADENCE n'est plus ici (préférence de confort, cf. `prefs()`) — les règles sont VERROUILLÉES tant qu'un combat est en cours (`houseRulesMutability`) : l'écriture est refusée en silence, et `rules(id, null)` rend alors la raison |
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
| `skipToArrival(maxIters=4000)` | comme `advanceSeaDay` mais ROULE jusqu'à l'ACCOSTAGE (`openPortAt`, `travelPlan` vidé) | s'arrête aussi sur un combat (embuscade/abordage), et rend alors « ✓ voyage interrompu par un combat — voir __wfrp.battle() » (même retour pour `advanceSeaDay` et `advanceRiverDay`, `driveSeaVoyage`) — `battle` ouvert, à jouer/`fastForward` séparément ; `Promise` (`await`) |
| `dealShipDamage(n=5)` | inflige `n` Dégâts de coque HORS COMBAT — VRAI pipeline (`damageVesselHull` si un voyage est en cours sur le navire de campagne, sinon `setVesselHull` directement au port) | symétrique de `dealDamage` (combat) — voir le piège des DEUX copies de coque ci-dessous ; **NE déclenche PAS un naufrage fiable** (voir piège d'ORDONNANCEMENT ci-dessous, `forceShipwreck`) |
| `forceShipwreck(aboardIds?)` | déclenche `beginShipwreck` DIRECTEMENT (setup ASSUMÉ, PAS le pipeline de dégâts) — coque + cargaison purgées IMMÉDIATEMENT, cascade de survie à la nage (Chance/Pacte/Résilience influençable) ouverte pour les héros à bord | `✗` sans `state.vessel` ; voir piège d'ORDONNANCEMENT ci-dessous |
| `clickRoute(routeId)` | calcule un point ON-PATH CLIQUABLE d'une route depuis ici → `{x, y, etat, note}` ÉCRAN. Le tracé se vise par son id (`data-path-id` du `path` de hit de `MapCanvas`) ; un point est cliquable si `elementFromPoint` y rend un élément du groupe du tracé, sinon d'autres fractions de `getPointAtLength` sont balayées. `etat` : `ouverte` (le clic la sélectionne, départ offert) ou `fermee-consultable` (le clic la sélectionne pour la CONSULTER, départ refusé) | ne clique PAS lui-même (le VRAI clic reste un clic souris réel, `clicReel`) ; au point rendu, `elementFromPoint` peut rendre le TEXTE de la pastille de distance posée sur le tracé — le clic sélectionne bien le tracé ; `✗` NOMMÉ si route inconnue, non cliquable d'ici, tracé absent du DOM, ou si AUCUN point du tracé n'est atteignable (il nomme ce qui recouvre le milieu) — jamais un point muet |
| `forceSeaWeather({ temperature?, precipitations?, visibilite?, vent? })` | arme la MÉTÉO de mer du jour EN COURS (`travelPlan.sea.weather`) ; aucun dé n'est touché, la journée se joue ensuite (`advanceSeaDay()`) | `✗` sans traversée en cours (`travelPlan.sea`) |
| `forceOverspeed(overM = 5)` | arme la SURVITESSE du jour de mer : pose le M EFFECTIF du jour (`sea.effMToday`) et les milles parcourus, les deux entrées que lit `buildOverspeedStep` ; `overM` = l'excès VOULU au-dessus du M de conception du navire | `✗` sans traversée en cours |
| `riverDayCascade()` | (re)POSE la cascade du JOUR fluvial en cours et rend le compte d'étapes et leurs `kind` — observer les étapes sans rejouer achat, carte et départ (`forceRiverCapsize` l'appelle après avoir armé le vent) | voir « `forceRiverCapsize` arme ET reconstruit la journée » (Pièges vécus) |
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
//    faible ») — prévoir jusqu'à 3 clics de « Chance : +1 DR » pour le poser. Après le clic de
//    « Poser la zone », `resoudreModales` LÈVE « pose de zone en cours, cliquer une case » : piège « Sort de ZONE ».
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
  des scripts de sonde. Écrire les scripts de recette par `Write`/`ctx_patch`, jamais par heredoc — le
  squelette se tire de `gabarit.mjs` (§ « Gabarit »).
- **Le délai d'amorçage de l'app est RÉGLABLE** : l'option `timeoutMs` d'`openApp` (45 s par défaut,
  borne UNIQUE — serveur, Chrome, app prête, § « Socle ») et de `demarrer` (120 s) — sur machine
  chargée, un plafond court a fait perdre trois passes : le relever plutôt que relancer.

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
- **Deux `role="dialog"` SUPERPOSÉS : `querySelector` rend le PREMIER du DOM, pas celui du dessus**
  (recette #679, 2026-09-30) : la conversation et la modale de document qu'elle ouvre sont deux
  `Modal` (`src/ui/Modal.tsx`) — `querySelector('[role="dialog"]')` a rendu la conversation, sous la
  modale. Mesuré ce jour-là : le DERNIER `.modal-overlay` de `querySelectorAll` était la modale du
  dessus. Ce n'est pas une règle : l'ordre du document ne dit pas l'ordre de la pile (un portal ajouté en
  fin de `body` a déjà menti, `Modal.tsx:97-98`) ; la pile fait foi (`dialogueDuDessus`,
  `src/ui/useDismissLayer.ts:107`). RÈGLE : viser la fenêtre par son CONTENU (titre, bouton propre),
  et vérifier ce contenu avant d'y cliquer.
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
  (`.cadre-pied`) pour recetter une cascade, et se souvenir qu'un même verbe peut avoir deux hôtes.

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
- **Pas d'EXPLORATION : une touche `explore-*` MAINTENUE fait COURIR le groupe** (recette #679,
  2026-09-30) : `realKeyDown` / 350 ms / `realKeyUp` a mené le groupe de (1,2) à (4,0). La touche
  ARME une marche (`demarrerMarche`, `src/state/stageWalk.ts:90`) qui enchaîne un pas à chaque fin de
  glissement tant qu'elle est tenue ; le relâchement la désarme (`arreterMarche`, `:99`). Un TAP
  (appui suivi aussitôt du relâchement) fait UN pas. Même famille que le lacet caméra ci-dessus, mais
  sans seuil : ici, toute durée d'appui compte.
- **Le bouton de bascule de vue nomme sa DESTINATION, pas l'état courant** (même recette) :
  « Vue du dessus » affiché ⇒ on est en ISO (`src/ui/ViewControls.tsx`). L'état RÉEL est dans
  l'`aria-pressed` de SON bouton — jamais dans un `[aria-pressed]` NU : la barre de vues en porte
  PLUSIEURS (projection, POV — `ViewControls.tsx:63`, `:74`), et le premier trouvé n'est pas
  forcément celui de la projection. Le désigner par l'`aria-label` de son bouton
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
  calculé et, si un DÉCOR interpose (le point ne tombe pas dans le groupe du tracé), balaie d'autres
  fractions du tracé jusqu'à un point atteint ; si aucun ne l'est, il REFUSE en nommant ce qui
  recouvre. Une route FERMÉE se clique comme une ouverte : elle se sélectionne pour être consultée. Repli
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
  Côté kit, `resoudreModales` S'ARRÊTE sur cette étape : il LÈVE « pose de zone en cours, cliquer une
  case » (rangée `resoudreModales` du § « Socle ») et ne rend jamais la main tant que la case attend —
  cliquer la case (`__wfrp.tileScreenPos` puis `clicReel`), puis relancer le résolveur.

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
  empiriquement sur `src/state/devtools.ts:1089-1112` : la fonction mute `pos` puis
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
| **Défaut hors production — sans variable** | `npm run relay:dev` (= `npm --prefix server run dev`, wrangler dev, port 8787) dans un terminal, puis `npm run dev` dans un autre | `relayHttpUrl` (`src/net/relay.ts`) vise `http://localhost:8787` ; `POST /rooms` rend `{"code":…,"hostToken":…}` |
| Build de production sans variable | Build avec `import.meta.env.PROD` vrai | Le défaut `RELAY_URL_PROD` vise le Worker Cloudflare déployé |
| Relais explicite | Relancer Vite avec `VITE_RELAY_URL` | La variable prend priorité dans tous les modes ; une URL locale convient aussi à un build de production |

`VITE_RELAY_URL` est lue via `import.meta.env` **au démarrage de Vite** : la poser après coup ne
change rien, il faut relancer le serveur de dev. Syntaxe PowerShell :

```powershell
$env:VITE_RELAY_URL = 'http://localhost:8787'; npm run dev
```

(bash : `VITE_RELAY_URL=http://localhost:8787 npm run dev`). L'URL WebSocket en est DÉRIVÉE
(`http`→`ws`, `roomWsUrl`) — une seule variable pour les deux.

Pour éprouver le refus de connexion hors production, arrêter le relais local, ou relancer Vite avec
une URL locale sur un port fermé (par exemple `http://localhost:8799`). Héberger refuse ; rejoindre
rend « Connexion impossible — réessayez. » après 15 secondes et conserve le mode local. Sans
variable, aucune de ces tentatives ne vise le Worker de production.

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
sauvegarde (`Enregistrer •`). `clickButtonByText` compare par défaut le texte ENTIER (`exact: true`,
`clickButtonByText` de `scripts/recette/lib.mjs`) et n'y matche donc rien. Sur ces boutons, DEMANDER la
sous-chaîne (`{ exact: false }`), et lever l'ambiguïté par `dans` ou `rangee`.

## Chemins canoniques du jeu — combat, équipement, carte du monde

Gestes du JOUEUR, re-mesurés au code (frictions des recettes #2177, #2199, #2001 et #2097, 2026-10-05/06).

### Combat

- **Ouvrir le combat** : `__wfrp.fight(id)` (ou la rencontre déclenchée au pas) pose la PAUSE de début
  de Round ; « Commencer le combat » est un geste du joueur — `ouvrirRound` clique la case de phase
  `data-action="round-start"` (`.cc-phase`). La pause d'un Round SUIVANT (« Commencer le round N »,
  `pendingRoundStart`) tient la main de la même façon (`src/state/modalArbiter.ts`, entrée `roundStart`) :
  aucun tour ne commence tant qu'elle n'est pas confirmée.
- **Cibler une attaque** : le PORTRAIT de la frise d'initiative (`button.ptile` d'une `.is-cell`,
  `src/ui/InitiativeStrip.tsx`) route son clic comme le pion de la carte (`onStripPortrait`,
  `src/ui/CampaignView.tsx`) ; pendant un ciblage, son `title` se lit « <nom> — cibler » :
  `cliquerSelecteur(session, '.is-cell button.ptile[title="Gobelin — cibler"]')`. Deux combattants de
  même nom : résoudre l'id d'abord (piège « Roster du HUD » ci-dessus).
- **Finir le tour** : la plaque porte le crochet STABLE `data-action="end-turn"`
  (`src/ui/CombatConsole.tsx:1395`) dans ses DEUX états — « Fin du tour » et sa note (« Action non
  dépensée », « Tour fini », « ESPACE »), puis, ARMÉE (`battle().endTurnArmed`), « Finir quand même » et
  sa note « Finir quand même ? » (`:1107`, `:1404`). Son texte change : jamais un
  `clickButtonByText('Fin du tour')`. `finDuTour` clique la plaque et confirme l'armement au second
  clic ; `cliquerAction(session, 'end-turn')` est le clic unitaire.
- **Ouvrir une Défense** : `__wfrp.attaque(attaquantId, defenseurId)` (table « Combat — triche de mise
  en place ») ; en pilotage, un `arret` sur `fenetre.jet === 'defense'` (`piloterCombat`,
  `resoudreModales`) laisse la fenêtre ouverte.
- **Avancer** : `piloterCombat` / `avancerDeRounds` franchissent pause de Round, fenêtres et fins de tour
  au geste du joueur (§ « Socle »).

### Équiper à la souris

Fiche du héros → panneau d'équipement (`src/ui/EquipmentPanel.tsx`) :

- **En combat, l'équipement est VERROUILLÉ** (`VERROU_SETS`, `EquipmentPanel.tsx:19`) : chaque emplacement,
  « Activer », « + Set d'armes » et la suppression d'un set sont des contrôles REFUSÉS (`aria-disabled`,
  jamais `disabled`), dont la raison se lit au survol — « Équipement verrouillé en combat (changez de set
  depuis la barre d'action). » ; `clicReel` LÈVE en la citant. Équiper se recette HORS combat ; en
  combat, le changement de set passe par la barre d'action.
- **Le picker d'emplacement** : cliquer la cellule ouvre un `MediaSelect` (changer, retirer). Ses options
  se lisent « <arme> », suffixée « (2M) » pour une arme à deux mains (« Filet lesté (2M) »), « <armure>
  · PA n[ · zones] » pour une armure (`weaponOpt`, `armourOpt`), et l'option vide « — mains nues — »,
  « — vide — », « — (2 mains) — » ou « — retirer — » selon l'emplacement. Une cellule vide sans candidat
  est refusée (« Rien à porter à cet emplacement (…). »).
- **Après « Activer »**, les cartes de sets gardent l'ordre de `hero.loadouts` (`loadoutSetActive`,
  `src/engine/items.ts:896`, ne touche que `activeLoadoutId`), mais le bouton CHANGE de carte : seul un
  set INACTIF porte « Activer », l'actif porte la puce « Actif ». « Le premier Activer » désigne donc
  une autre carte après le geste : viser par la carte, `clickButtonByText(session, 'Activer', { rangee:
  '<libellé du set>' })`.
- **Les onglets de la fiche passent SOUS le party-dock** aux vues `bureau` et `portable` (#2220, ouvert) :
  le clic sur « État » tombe sur `party-dock`/`.pd-track`. `clicReel` le DIT (« … RECOUVRE la cible —
  aucun événement émis ») au lieu de cliquer le dock.

### Carte du monde

- **Le bouton de la carte du monde n'existe qu'à un LIEU de la carte**, ou en voyage : la console
  d'exploration le monte si la scène courante est un lieu de la carte du projet (`placeOfScene`) ou si un
  voyage est en cours (`src/ui/CampaignView.tsx:307`). C'est un bouton à GLYPHE, sans texte, titré
  « Carte du monde — voyager » (`src/ui/ExplorationDock.tsx`) :
  `cliquerSelecteur(session, '.worldmap-btn[title^="Carte du monde"]')`. Exemple : Arène,
  `__wfrp.go('arene-hub')`.
- **Cliquer une route** : `__wfrp.routes()` puis `clickRoute(id)` → point ÉCRAN, cliqué par `clicReel`
  (piège « Cliquer une ROUTE » ci-dessus). Une route FERMÉE se clique comme une ouverte (`etat:
  'fermee-consultable'`) : elle se sélectionne pour être CONSULTÉE, départ refusé.

## Chemins canoniques de l'éditeur

Pièges vécus À L'ÉDITEUR (deux recettes, 2026-09-21) — tous re-mesurés au code :

- **Préparer l'état d'une entité passe par `__wfrp.editorPatchEntity`**, jamais par une remontée du
  fiber React de `.editor-inspector` pour atteindre `setScene`. Voir sa rangée à la table `__wfrp`
  ci-dessus.
- **L'`evaluate()` du kit CDP n'accepte pas un `await` EN TÊTE d'expression** : la voie est
  `Runtime.evaluate` (`evaluate` de `scripts/recette/lib.mjs`), sans `replMode` — `await __wfrp.ready()` y est
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
- **`browser_file_upload` de Playwright-MCP refuse tout chemin hors de la racine de la session** :
  copier d'abord le fichier sous `.playwright-mcp/`, puis l'uploader depuis là.
- **Les boutons de zoom répondent à `onPointerDown`, pas à `click`**, et n'ont pas de texte : les
  cibler par leur `title`/`aria-label` EXACT — « Zoom arrière » (`src/ui/ViewControls.tsx:100`),
  « Zoom avant » (`:106`), « Réinitialiser le zoom » (`:110`). Un `.click()` de pilote qui n'émet
  pas `pointerdown` ne fait RIEN, sans erreur.
- **Écran « Scénarios de test » : chaque carte porte un bouton au libellé générique « Lancer »** —
  viser par texte amène le premier venu. L'ancrage est
  `[data-testid="scenario-launch-<id>"]` (`src/ui/TestScenariosScreen.tsx:50`, verrouillé par
  `TestScenariosScreen.test.tsx:25`).
- **Hors combat, `__wfrp.state()` n'expose PAS la scène** : il ne rend que `sceneId`/`sceneName`
  (`state` de `buildApi`, `src/state/devtools.ts`). Les entités se lisent par `__wfrp.entities()`
  (`entities` de `buildApi`, `src/state/devtools.ts`), qui rend id, libellé, nature, position et ce que l'entité OFFRE.
- **« Tester la scène » refuse sans groupe** (« Mise à l'essai refusée : aucun aventurier au groupe… »,
  `src/ui/editor/Editor.tsx:812`) : poser un groupe AVANT d'ouvrir le document — `__wfrp.scenario(id)`
  puis `__wfrp.editorOpen(docId)` —, jamais l'inverse.
- **Menu « Type : … » d'un effet ou d'une op** (`TypeMenu` → `AddMenu`, `src/ui/editor/AddMenu.tsx`) :
  son sommaire se lit « Type : <type courant> » — `clickButtonByText(session, 'Type')` (EXACT) ne le
  trouve pas ; viser le texte entier, ou `{ exact: false }` sur « Type : ». Ses items sont des
  `button.listrow` rendus SEULEMENT une fois le `<details>` ouvert, dans une `BoiteAncree` portée HORS du
  `<details>` (`createPortal`) : ouvrir le sommaire, puis viser l'item dans `{ dans: '.eff-add-menu' }`,
  jamais dans le `<details>`. Même structure pour « + Bloc » (ci-dessous).
- **Le montage d'un PNJ n'a PAS de « Détacher »** : sa provenance (`src/ui/editor/NarratifEditor.tsx:820`)
  est celle du PRESET, posée en `copie` ; le bouton « Détacher » n'est rendu que sur un site SANS `copie`
  qui reçoit une adresse — réplique, ligne de journal (`src/ui/editor/ProvenanceDuTexte.tsx:53`). Quand
  la description du profil est la copie adressée du livre, c'est l'option « Adapté » qui est REFUSÉE,
  avec sa raison (« La description du profil est la copie adressée du livre. ») : `mesurerProvenance` y
  rend `detacher: null` et le `refus` de cette option.

Une op mécanique ne s'atteint pas depuis la Scène : elle vit dans un bloc d'effets de trigger.
Chemin mesuré en recette (2026-09-18, #1789) jusqu'à l'éditeur d'une op :

Éditeur → onglet **Triggers** → **+ Nouveau trigger** → **+ Bloc** → **Afflictions** → « Effets
mécaniques (Blessures / État / buffs… — vocabulaire des sorts) » → menu « Type : … » → l'op
(`offTerrainMod` est sous *Séquelles & mobilité*).

Le libellé de l'entrée est cité COMPLET (`src/state/combatEffects.ts:1535`) : viser « Effets
mécaniques » en `{ exact: true }` rate (piège du suffixe ci-dessus) — soit le texte entier, soit
`exact: false`.

Un effet **Journal** (texte et provenance, #2001) suit le même chemin, mesuré au code :

Éditeur → onglet **Triggers** (`src/ui/editor/LogicDock.tsx:85`) → **+ Nouveau trigger** (`:174`, qui
sélectionne le trigger et ouvre son détail) → **+ Bloc** (`src/ui/editor/FlowEditor.tsx:226`) →
**Journal** (`src/state/combatEffects.ts:1308`).

- « + Bloc » est le `<summary>` d'un `<details>` (`AddMenu`, `src/ui/editor/AddMenu.tsx`) : le cliquer
  ouvre le menu, aucun bouton ne porte ce texte. Le menu s'ouvre avec TOUTES ses sections dépliées
  (`AddMenu.tsx`, un `mini-title` par groupe, jamais cliquable) : « Narration » n'est qu'un titre, on
  clique « Journal » directement.
- La ligne d'effet posée est un `<details class="eff-row flow-node">` REPLIÉ (`open` n'est posé que pour
  un nœud `if`/`test`, `FlowEditor.tsx:263`) : ouvrir son `<summary>` avant de viser la zone de texte —
  `deplierVers(session, '<sélecteur du champ>')` le fait au geste (clic réel du `summary`, puis molette).
- Depuis la CARTE, un trigger sélectionné ouvre le même détail par le bouton **Effets (n)…** de
  l'inspecteur (`src/ui/editor/Inspector.tsx:910`).

**Mesurer un rognage** : sur le CONTENEUR qui clippe (celui qui porte `overflow: hidden`, ex. `.seg`),
jamais sur l'élément clippé. Comparer `scrollWidth` à `clientWidth` du conteneur ; la largeur de
l'élément rogné reste la sienne et ne dit rien du masquage.

## Chemins canoniques du Codex (niches ouvertes récemment)

Une recette ne doit pas redécouvrir l'arborescence du Compendium à l'aveugle : les niches nichées sous
un cluster de `Tables` ne sont PAS sous `Monde`, et le chemin ne se devine pas depuis le nom du
fichier de données. Chemins vérifiés au registre (`src/ui/compendium/registry.ts`) :

| Donnée | Chemin dans le Compendium |
|---|---|
| `weather` (table de tirage d100 par saison) | Tables › Voyage terrestre › **Météo de voyage** |
| `weatherConditions` (effets par météo) | Tables › Voyage terrestre › **Conditions météo** |
| `mutations` | Effets › **Mutations** (`registry.ts:1576`) — pas sous `Personnage` |
| `talents` | Compétences › **Talents** (`registry.ts:1441`) — pas sous `Personnage` |

Les deux niches météo éditent le MÊME fichier (`src/data/weather.json`) sous deux catégories Codex : une
recette qui vérifie l'édition d'une météo doit dire LAQUELLE des deux elle a ouverte.

En Atelier, les ops d'une mutation ou d'un talent sont des `<details class="eff-row">` REPLIÉS
(`src/ui/editor/GameOpEditor.tsx:1347`, l'éditeur d'ops que compose `CodexEdit`) : un champ d'op
s'atteint par `deplierVers` (clic réel du `summary`, puis molette) — `scrollIntoView` ne le ramène pas.

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
