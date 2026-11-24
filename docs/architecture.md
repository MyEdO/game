# Architecture — où trouver quoi (référence vivante)

> À lire quand on cherche où vit un module, avant de créer un fichier, ou pour l'état courant des
> systèmes. La table des primitives partagées vit dans `docs/primitives.md` (GÉNÉRÉ depuis
> `src/data/primitives.manifest.json`, `npm run docs:primitives`).

## Politique de `docs/`

Ce dossier ne contient que des **références vivantes**, maintenues au fil du code. Les plans de
refonte et sorties de brainstorming sont des artefacts **DATÉS** : ils vont dans `docs/plans/`,
portent leur date en tête, et sont supprimés une fois exécutés (git porte l'historique). Ne JAMAIS
s'appuyer sur un doc de plan pour décider de l'architecture actuelle — le code et les références
vivantes font foi.

Garde `npm run docs:check` (`scripts/docs/check-doc-refs.mjs`) : chaque chemin `src/…`/`scripts/…` et
chaque symbole backtiqué cités par `docs/*.md` (hors `docs/plans/` et `docs/raw/`) doivent exister,
et chaque `label` de `src/data/primitives.manifest.json` doit être un EXPORT réel — exit 1 avec la
liste `fichier:ligne` sinon. Un renvoi à une DOC, lui, se juge partout : tout chemin `docs/….md`
écrit sous `src/`, sous `scripts/` ou dans la prose d'une doc — les pages de l'Atlas comprises, à
toute profondeur — doit désigner un fichier existant (exclusions structurelles : `docs/plans/`, qui a
sa garde dédiée, et les épreuves DATÉES, qui disent l'arbre de leur jour). La garde vérifie aussi les
liens relatifs de ces pages, les chemins cités par les hooks et le contexte permanent, ainsi que les
suites nommées dans les commentaires du code et dans les raisons des gates qui déclarent leurs lectures
et écritures. Une référence vivante qui ment ne se tague pas, elle se corrige.

**Dérivés PURS, jamais commités** (#2203) : une cible que son générateur écrit EN ENTIER (`targets`
de `GENERATORS`, `scripts/docs/build-all.mjs` — docs générés, catalogues de l'Atlas, `*.generated.ts`,
`docs/.sources-lues.json`) est ignorée par git (bloc de `.gitignore`, garde
`scripts/docs/cibles-pures.test.mjs`) et se PRODUIT là où on la lit : les cibles de code par `npm run gen`
(aussi `postinstall`, hooks `post-checkout`/`post-merge`/`post-rewrite`, la préparation du pont Godot), les docs
par `npm run docs:build`. Aucune ne se fusionne.

Après tout commit, toute fusion ou tout rebase : les hooks examinent l'attestation des cibles
(`scripts/git-hooks/docs-rebuild.mjs`). Les cibles de code périmées se produisent par
`build-all --code --perimes` ; la reconstruction documentaire se demande en fond
(`scripts/git-hooks/reconstruction.mjs`) une fois l'arbre libre de toute opération Git.
Les sources, sondes, listings, outils et sorties mesurés décident de la fraîcheur. Tout mode
d'écriture mesure et certifie ; une sortie identique laisse son lecteur frais.
Les générateurs rendent leurs textes pour les lecteurs et proposent leurs sorties au lanceur commun
`scripts/docs/lib/ecriture-derives.mjs`. Les commandes individuelles et `build-all` passent par ce port.
Il vérifie les destinations selon les cibles pures de `targets`, applique les rendus et les amorces
sous époque, et compare les sorties en `--check` sans écrire de cible. Une amorce sert au chargement
du registre sur un arbre neuf. Seul le rendu final compte comme cible produite. Les écrivains
partagent `scripts/docs/lib/ecrivain-derives.mjs` : une production de code préempte la passe courante,
dont toute écriture suivante est refusée, puis la passe est rejouée.

**Miroirs d'agents** (#2578, `DESTINATIONS` de `scripts/agents/compat-core.mjs`) : produits sur
l'INDEX par l'unique producteur `runCompat` (`scripts/agents/compat-cli.mjs`). Le `pre-commit` les
produit dans le commit ; les post-hooks (`scripts/git-hooks/miroirs-d-agents.mjs`) rattrapent ce que
le `pre-commit` ne joue pas (fusion, rebase, `--no-verify`) — le `post-commit` seulement si l'index
s'écarte de HEAD sur une destination, ou si le commit a touché une destination, une entrée non-JS du
producteur (`ENTREES_DU_PRODUCTEUR`) ou un membre, données JSON comprises, de la clôture d'imports de
son code (`RACINES_DU_PRODUCTEUR`, `clotureDImports`, spécificateurs mémoïsés par contenu :
`specificateursMemoises` de `scripts/test/perimetre.mjs`) — et annoncent sur stderr « À COMMETTRE » ce que HEAD ne porte pas. La finalisation du train les commet ; un `.claude/settings.json` sale n'y est dérivé que si seule sa clé
`hooks` s'écarte de HEAD (`estMiroir`, `scripts/ops/etapesDuTrain.mjs`).

**Fusion des stocks de sites** (`.gitattributes`, section « Stocks : fusion par groupe de site »,
pilote `scripts/git-hooks/merge-stocks.mjs` déclaré par `npm run postinstall`, `merge=stocks`) :
chaque version est lue par le format de son extension (`FORMATS`, `scripts/guards/lib/stockDeSites.mjs`)
et la fusion se fait au niveau du GROUPE de site, donc deux soldes de groupes disjoints d'un même stock
ne se heurtent pas. Une version qui n'est pas un point fixe de son format, ou un fichier sans collection
de sites, retombe sur la fusion 3-voies ordinaire, `scripts/git-hooks/three-way.mjs`, utilisée par le pilote. Un stock se régénère par `npx tsx scripts/guards/lib/regenStock.mts <module qui
mesure>`. Le type `Site` de `src/lib/stock.d.mts` porte `fichier` et `ref` du balayage à l’entrée.
`sitesEnEntrees` ajoute l’occurrence dans l’ordre du balayage, avec les mesures du site.

**Fusion des imports** (`.gitattributes`, `merge=imports` sur `.ts`, `.tsx`, `.mts`, `.mjs`, pilote
`scripts/git-hooks/merge-imports.mjs` déclaré par `npm run postinstall`, #4178) : la fusion 3-voies
ordinaire d'abord, rendue telle quelle quand elle est propre. En conflit, chaque suite de lignes faite
seulement de déclarations `import` / `export` de premier niveau entières (`declarationsDImport`,
`scripts/guards/lib/declarationsDImport.mjs`, sur l'arbre syntaxique de `dialecte.mjs`) est fusionnée par
ensemble : chaque liaison, sous le nom qu'elle lie, prend la valeur du côté qui l'a changée depuis
l'ancêtre. Une liaison changée des deux côtés, un nom que le module lie déjà ailleurs, deux imports d'effet
ajoutés chacun d'un côté, un commentaire dans la région, une version qui ne se parse pas laissent le
conflit ordinaire, comme tout conflit hors des imports. La sortie de `merge-file --diff3`
se lit par `segmentsDeFusion` (`scripts/guards/lib/blocsDeFusion.mjs`), partagé avec
`scripts/ops/synchroniser.mjs`. GitHub n'exécute aucun pilote : le gain est à la fusion locale et dans le
train.

## Frontière orchestrateur · machinerie · data-driven

Un Trigger doit fonctionner pour TOUT kind d'entité (maladie, talent, trait, sort, état, mutation)
**sans code spécifique**. Données = `effects`/`passive` sur l'entité, dispatchées par l'unique
`fireTriggers` ; machinerie = hooks de la table `crochetsDeCombat`, règles universelles de l'arène qui ne
nomment AUCUNE entité. « Difficile à exprimer » n'autorise JAMAIS la machinerie : on étend le
vocabulaire (`GameOp`, `Formula`, `Condition`). Détail et cas limites : `docs/combat-events-coherence.md` §3bis.

## Pistes de mutualisation ÉVALUÉES puis ÉCARTÉES

Sites trop divergents pour une source unique propre — ne pas « globaliser » de force.

- `confirmPending` : les corps de clôture (`CloturesDuJet`) divergent par leur garde de résultat et réutilisent `battle`
  localement ; un wrapper ne raccourcirait rien.
- `useMasterDetail` : le rejet portait sur le HOOK D'ÉTAT partagé (marchand ⇄ carte divergent après
  sélection) et reste valide. Le GABARIT DE LAYOUT (slots liste/détail, aucun état) en a été extrait
  en primitive sous #330 → `MasterDetail` dans `docs/primitives.md`.
- `StatChip` / `itemStatParts` : trois formes de données différentes (chaîne d'`ItemInstance`,
  `Combatant.weapons` résolues, table par famille).
- Sweep `actorIn` dans les fabriques d'actions du noyau : `battle` y reste en portée pour le `set` final.
- Une porte unique du noyau pour les zones de `src/` : elle réexposerait quelque 400 symboles à 258
  importeurs (#2882), tous dans des zones qui ne survivent pas à la bascule sauf `scenes`. Les zones de
  `src/` importent le module qui déclare ; seuls les hôtes passent par `src/noyau/index.ts`.
- Le découpage en paquets npm (`workspaces`, `exports`) : `COUCHES` tient la même frontière sans déplacer
  3 000 fichiers ni réécrire les chemins des gardes (#2882). À réévaluer si un mur se révèle contournable.

## Couches (#2882)

Le dépôt se range en zones dont les sens d'import sont tenus par le lint, pas par une garde : un
branchement hors du chemin prévu est refusé par `murs/purete-imports`. La table `COUCHES`
déclare les seules zones du dépôt.

| Zone | Rôle | Importe |
|---|---|---|
| `lib`, `geometry`, `i18n` | feuilles | rien d'autre sous `src/` |
| `engine` | règles WFRP pures | `data`, feuilles |
| `data` | base app-owned et son chargement | `engine`, feuilles |
| `noyau` | orchestration pure : (état, intention) → (état, journal, événements) ; modèle du monde (`noyau/monde/`) ; outils d'auteur purs que lisent le contenu et l'éditeur ; modèles-vues que tout hôte dessine | `engine`, `data`, feuilles |
| `scenes` | contenu de campagne | `noyau`, `data`, `engine`, feuilles |
| `hote` | module commun aux hôtes du noyau, et leurs services d'hôte : entropie, stockage web | la porte du noyau, `scenes`, feuilles |
| `texte` (`hotes/texte/`), `godot` (`hotes/godot/`) | affichages : hôte texte (MCP), hôte Godot | les droits de `hote`, et `hote` |
| `roguelite` (`projets/roguelite/`) | projet : le roguelite | les droits d'un projet (`DROITS_D_UN_PROJET` : ceux des affichages, sans `scenes`), plus ses ouvertures : `engine` (#4932), `data` et `scenes` (#4933), le `noyau` hors de sa porte (#4931) |
| racine de `src/` | tests transverses et leur préparation | toutes les zones, hors des projets |

- **Un projet est fermé** (#4903 H3) : aucune autre zone ne l'importe, ni en exécution ni en type, ni par
  `importe: '*'`, ni en production (`fermeture`, `ouvertes`) ni dans une suite (`murs/tests-survivants`), ni par
  un motif joker d'`import.meta.glob` qui peut l'atteindre (`dossierJoker`, `couchesLint.mjs`), ni en transit par
  un module hors des zones (`scripts/corpus/guards/clotureDesZonesQuiSurvivent.test.mjs`), par la nature de la zone
  (`fermeParLeProjet` : son dossier est sous `projets/`). Sa ligne se construit
  (`ligneDeProjet`) : les droits d'un projet, plus ses `ouvertures`, chacune nommée par son ticket ; ouvrir une
  zone l'importe et retire sa porte. Le banc refuse une ligne qui nomme un autre projet et une ouverture morte.
- **Un hôte du noyau ne nomme aucun verbe** (`src/hote/derive-du-noyau.hors-store.test.ts`) : la garde juge
  chaque zone de `HOTES_DU_NOYAU`, projets compris, sauf celle dont la ligne ouvre le noyau hors de sa porte
  (`ouvertures.noyau`, posée par `ligneDeProjet`) : une zone qui lit encore le noyau hors de sa porte ne dérive pas
  encore de lui. Le roguelite y entre quand son ouverture du noyau se résorbe (#4931), après les vues des gestes
  hors combat (#4938) et le lecteur de la dépense de PX (#4870).

- **Le noyau ne lit de l'hôte que ce que l'hôte lui fournit** (mur `murs/sans-hote`) : la graine du RNG de
  bataille, la cadence, les règles maison, l'appel différé (`programmer`, `src/noyau/plateforme.ts`), le héros
  persisté (`persisterLeHeros`, le roster de l'hôte qui a un stockage : `src/hote/roster.ts`), et,
  pour `validateScene`, les pistes de musique que l'hôte sait jouer.
- **La cadence après une approche** (#3839) dépend du parcours présenté. L'autorité du combat arme le geste
  depuis le noyau et le reprend une seule fois. Son jeton donne les identifiants des porteurs dont le déplacement
  précède le délai de tenue.
  Le pont expose ceux du même appel dont le chemin est visible. Godot compte le délai après la fin des parcours
  effectivement joués, y compris s'ils sont accélérés ou abandonnés. L'hôte texte rejoue le jeton à l'horloge
  virtuelle, sans attente de présentation. Le miroir coop applique les instantanés de l'autorité.
- **Registres fermés** : au noyau, un registre d'effets ou de crochets est une table statique typée par une
  union fermée (une entrée manquante ne compile pas), jamais une fonction d'inscription appelée à l'import.
- **Les données s'éditent au Compendium Godot** (#4020) : sa session vit au noyau
  (`src/noyau/codex/session.ts`), son formulaire se tire du schéma de chaque catégorie
  (`src/hote/compendium.ts`), et `src/compendium-field-editability-guard-*.test.ts` exige que chaque
  chemin du schéma s'écrive par un geste joué, jamais par une saisie JSON.
- L’atelier de cartes Godot utilise le calage du noyau (`src/noyau/edition/calage.ts`).

## Arborescence

Zones du dépôt (#2882, #2928, § Couches) : une zone est un dossier,
`src/<zone>` sauf déclaration (`dossier`), et les fichiers posés à même `src/` forment la zone `racine`. Hors de
`src/`, chaque dossier de `hotes/` est un affichage et chaque dossier de `projets/` un projet, chacun sa zone
(#4903). La
table `COUCHES` (`scripts/guards/lib/couches.mjs`) est la seule source des zones, de leurs dossiers
(`dossierDe`, `zoneDe`) et de leurs sens d'import : par zone, ce qu'elle importe librement, ce qu'elle ne lit
qu'en type (`import type`), ses portes : pour une zone importée, le seul module qu'elle en lit (`portes`), et
si elle survit à la bascule vers Godot (`survit`) : une telle zone n'ouvre que des zones qui survivent, ne
charge aucun paquet de l'hôte web (`PAQUETS_DE_L_HOTE_WEB`), n'écrit aucun JSX et ne lit aucun module de code hors
des zones, sauf, pour un script d'outillage de la zone (lancé par Node, jamais chargé par l'hôte), les modules que
sa ligne déclare (`outillage`), et, pour un outillage, les paquets de l'hôte web qu'elle lui ouvre
(`paquetsDOutillage`) : l'évaluateur d'assets (`hotes/godot/asset/evaluateur/`) charge `three` comme outillage de
construction, sans dépendre de l'hôte web, et aucun module de la zone hors de lui ne l'importe, même pour un type
(`outillageAtteint`) ; une clé d'outillage finie par `/` vaut un dossier, sinon un fichier (`couvre`).
Les murs de couche la lisent (`scripts/guards/lib/couchesLint.mjs`), sous chaque racine des zones
(`RACINES_DES_ZONES` : `src`, `hotes`, `projets`) : `murs/zone` refuse un fichier dont le dossier n'est celui
d'aucune zone (un sous-dossier `godot` ou `racine` de `src/`, un dossier de `hotes/` ou de `projets/` sans ligne, un
fichier posé à même `hotes/` ou `projets/` compris) ; `murs/purete-imports` refuse, à tout fichier d'une zone qui
n'est ni suite ni banc (`estFichierVitest`), un arc d'import qu'elle n'ouvre pas ou qui manque une porte, sur toutes
les formes d'arc de `scripts/guards/lib/arcsDImport.mjs`, un paquet de l'hôte web, du JSX ou un module de code hors
des zones et hors de son `outillage` dans une zone qui survit, et un motif d'`import.meta.glob` dont le dossier de
zone est un joker ; `murs/tests-survivants` (#3058) refuse, à une suite ou un banc d'une zone qui survit, tout arc
vers une zone qui n'y survit pas (`fermeParLaSurvie`), même pour un type, un paquet de l'hôte web, du JSX, un
motif joker, et tout chargement que la lecture des arcs ne suit pas : spécificateur ou motif calculé, chargeur
(`vi`, `require`, `createRequire`, `module`) renommé, lié comme valeur ou lu par un accès calculé. Les deux règles
se partagent les fichiers des zones. Le mur de clôture `scripts/corpus/guards/clotureDesZonesQuiSurvivent.test.mjs`
marche la clôture d'imports de tout module d'une zone qui survit, production et instruments compris (`clotureDImports` :
les formes d'arc de `arcsDImport.mjs`, motifs d'`import.meta.glob` et spécificateurs `/…` compris), et refuse qu'un
de ses membres, hors des zones compris, soit d'une zone qui n'y survit pas ou charge un paquet de l'hôte web que la
zone ferme au module (`paquetFerme`) : l'`outillage` déclaré ouvre un module hors des zones, jamais une zone qui ne
survit pas (#3337). Il
suit `tsImport` de `tsx/esm/api`, et chaque acquisition calculée d'un membre en forme FERMÉE (`valeursDAcquisition`,
`racinesBalayees.mjs`, #3058) : un littéral, `join`/`resolve` de `node:path` sur un chemin du dépôt, le chemin du
module, `pathToFileURL(x).href`, l'élément d'une constante gelée (`Object.freeze(<tableau>.map(Object.freeze))`) et la descente directe d'un
dossier listé (`listerEntrees`) entrent dans la clôture jusqu'au point fixe ; toute autre forme, une valeur vide et
un chargeur que la lecture ne suit pas (renommé, déstructuré, atteint par un espace, ou qui fuit) sont rouges. Ces murs lisent le
code. La configuration unique de Vitest prépare le noyau par `src/test-setup-noyau.ts`.
`murs/suite-jouee` refuse une suite absente de cette configuration (`racinesDeLaSuite.mjs`).
`murs/reexportation` refuse, en production de `src/noyau/` et `src/scenes/` (`ZONES_SANS_REEXPORTATION`), toute réexportation hors de la surface
du noyau ; `murs/quarantaine` refuse, aux fichiers que la config nomme, tout arc vers une cible de ses `cibles`
(le batch générique de cascade et le domaine naval, #328). Banc : `src/eslint-ordre-total-et-purete.test.ts`. Les outils qui lisent le code des zones en dérivent :
les murs d'oxlint, le périmètre des gardes et les lectures des gates (`RACINES_PRESENTES`, les racines que l'arbre
porte) ; `tsconfig.json` et `knip.json`, du JSON, ont pour témoin `src/racines-des-zones-json-guard.test.ts`.

Hôtes du noyau (#2898, #2928, #4903 H3) : une zone bâtie sur les droits d'un hôte ou d'un projet, dont la ligne
importe chaque zone des droits d'un projet (`HOTES_DU_NOYAU`) ; un hôte lit le noyau par sa porte `src/noyau/index.ts`. Le module commun `hote` (`src/hote/`) importe la porte du noyau, `scenes` et les
feuilles ; un affichage (`texte`, `godot`) a ces mêmes droits plus `hote`, lus d'une seule constante de
`COUCHES` (`DROITS_DES_HOTES`). Les affichages vivent sous `hotes/` (#4903), un dossier et une zone chacun :
leur règle est leur ligne de la table, rien d'autre, et aucun n'importe un autre affichage. Un projet (un jeu ou un
outil) vit sous `projets/`, un dossier et une zone chacun ; un dossier de `projets/` naît avec sa ligne. Aucune
zone qui survit ne lit un module de `projets/` sans ligne (« hors zone »). Vitest joue les suites TypeScript des hôtes. La garde
`src/hote/derive-du-noyau.hors-store.test.ts` refuse, dans leur code, un verbe ou une fenêtre nommé en dur.

Convention `X/interne/` (#2724) : un fichier sous `X/interne/` n'est importable que depuis `X/`, et ne
se réexporte jamais hors de `X/interne/` : la porte de `X/` expose des fonctions qu'elle écrit
elle-même. Le mur `murs/interne` la tient (`scripts/guards/lib/interneLint.mjs`, câblé dans
`oxlint.config.mjs`), par la place du fichier dans l'arbre, sans liste, sur les formes de `scripts/guards/lib/arcsDImport.mjs` et les limites que son en-tête
énumère. Hors de sa portée : le spécificateur calculé, le motif de glob joker sans segment `interne`,
la liaison réexportée en valeur (`export const p = b`), le requireur renommé ou réaffecté
(`createRequire as cr`, `var req = require`) et l'accès calculé (`module['require']`).

Murs de lint (`murs/*`, greffon `scripts/guards/lib/mursLint.mjs`) et directives (#2724) : une directive
`eslint-`/`oxlint-disable` ou un commentaire de configuration ne nomme un mur que s'il figure dans
`MURS_EXEMPTABLES_AU_SITE` (même module), et à SA ligne (`-next-line`, `-line` ; ni forme bloc ni
commentaire de configuration) ; aucune ne nomme une restriction native
(`no-restricted-syntax|imports|properties|globals`), aucune n'est globale (sans règle nommée). Les noms
d'une directive se lisent comme oxlint les lit (`directivesLintCiblees`, `lint.testkit.mjs`). Garde :
`scripts/corpus/guards/directivesMurs.test.mjs`, sur tout fichier de script (`EXTENSIONS_DE_SCRIPT`)
qu'arme un mur ; son banc confronte chaque forme à oxlint. Le test IGNORES de
`scripts/corpus/guards/lister.test.mjs` lance la commande de la gate `npm run lint` en découverte, une fois,
sur une copie des fichiers SUIVIS armés et de leurs fichiers d’ignore (`.gitignore`, `.eslintignore`) : chaque fichier de script suivi armé est lu
(ni `.gitignore`, ni `.eslintignore`, ni ignore de la config, ni ignore implicite d'oxlint, tel `*-min.ts`), aucun autre dialecte
ne l'est (`.vue`, `.svelte`, `.astro`). Les fichiers générés non suivis (`/src/**/*.generated.ts`) sortent de
cette mesure.

```
Source/                     Livres en .md (vérité citable : FR + Core Rulebook 5e, AGENTS.md § Sources VF)
src/data/                   NOTRE base APP-OWNED (JSON commité, éditable au Compendium Godot) + index.ts (accès typé), pregens.ts
                            EXCEPTIONS manuscrites (tables verbatim sourcées) : criticals.ts, oups.ts,
                            mutations.ts (Tableaux de Corruption LDB 19). Les métadonnées de résolution
                            des sorts vivent dans SpellData (spells.json) — l'ancien registre spellspecs/
                            et le repli regex sont SUPPRIMÉS (Migration #5)
                            UNION d'ids GÉNÉRÉE (`icones.generated.ts`, `IconIdGenerated`) : écrite par
                            `npm run gen` à part du registre `src/data/icons/defs/`, par l'option
                            `idUnion.out` (`scripts/docs/lib/cibles-registres.mjs`), jamais éditée
                            VOCABULAIRES D'ART GÉNÉRÉS (`_vocabulaires-d-art.generated.ts`) :
                            l'option `vocabulaire` d'un registre TS d'art (même fichier) projette ses
                            defs en table `id → libellé`, espace `vocabulaire:<nom>` de l'index des ids
                            (`src/data/schemas/grammaire/vocabulaires.ts`) que `TYPES` déclare (#2968 P-art)
                            SEAM d'ÉCRITURE (`overrides.ts`) : `setDataset`/`setObjectDataset`/`resetData`
                            remplacent le CONTENU d'un dataset sans réassigner son binding (`splice` en
                            place), `setEnTete` écrit l'EN-TÊTE d'une collection nichée (les champs de
                            ses ANCÊTRES, nommés par préfixe de suite, hors pas de collection), et tous VERSIONNENT
                            l'écriture (`bumperDataset`, module FEUILLE
                            `versionDataset.ts`) — l'identité du tableau ne bougeant jamais, cette version
                            est le SEUL témoin qu'un lecteur indexé peut consulter. Tout index de niveau
                            module se bâtit donc par `indexParId`/`indexParChamp`/`memoParVersion`
                            (#1692) ; deux gardes structurelles le tiennent : `index-vivant-guard.test.ts`
                            (aucun index figé à l'import sur un dataset du seam) et
                            `seam-ecriture-guard.test.ts` (aucun `push`/`splice` hors `overrides.ts`)
                            VUES TS de dataset (`<dataset>.types.ts`) : elles portent aussi les types
                            que la donnée compose sans dépendre du rendu
                            (#2884) — `materials.types.ts` (`DetailRecipe`, `MaterialRef` lus par le
                            rendu ; `Grade`, lien vertical lu par le noyau pour le déplacement),
                            `structureAppearance.types.ts` (`WALL_PARTS`),
                            `ambiance.types.ts` (`Visibility`)
                            VALEURS NEUVES de l'atelier qui ne lisent que schémas et donnée
                            (`valeursNeuves.ts`) : le défaut d'une union fermée est son premier membre, lu au schéma
  schemas/                    CONTRAT de la donnée. Chaque dataset a UN def (`defs/<nom>.ts`,
                              `defs-scenes/<nom>.ts`) qui DÉCLARE son document par la fabrique
                              `document()` (`grammaire/document.ts`) : enveloppe commune posée par la
                              fabrique (id/type/label, provenance source ∨ maison quand elle est exigée,
                              exclusive si le def le déclare, comme `reglesOptionnelles`), emballage
                              du fichier par famille (entite/table/config/record), méta d'édition et exposition
                              Codex/éditeur. Registres GÉNÉRÉS (`_registry*.generated.ts`,
                              `_ids.generated.ts`) par `npm run gen` — jamais édités à la main.
                              Le nom FR d'une VALEUR d'enum vit sur le NŒUD (`enumNomme`,
                              `grammaire/valeurs.ts`, lu par `valeursDe`/`libelleDeValeur` de
                              `grammaire/meta.ts`), donc à toute profondeur et pour tous les
                              consommateurs — jamais un Record de libellés côté UI (cliquet
                              `grammaire/records-de-libelles.test.ts`).
                              Détail : `docs/donnees.md` §E-bis
  source/                     Parseur de DÉCOUPE des chapitres de `Source/` (`decoupe.ts` : sections,
                              blocs, folios, empreinte `sumOf`, résolution d'une adresse `DescRef`) +
                              `normalize.ts` (normalisation de citation, source unique partagée avec
                              `scripts/raw/_lib.mjs`). Module PUR : chargé tel quel par Node nu
                              (`scripts/source/*.mjs`) et par vitest — d'où les imports internes à
                              extension explicite ; sans entrée/sortie, donc chargeable par le navigateur.
                              Le chemin JOUEUR ne résout RIEN : la prose adressée est MATÉRIALISÉE au
                              build par le plugin Vite `scripts/source/prose-source-plugin.mjs`, qui
                              l'injecte sous `desc` dans le module JSON servi. Invariant « hors Vite =
                              forme disque » : un script Node lit une entrée adressée SANS `desc` — les
                              consommateurs Node de prose sont inventoriés par
                              `scripts/source/inventaire-consommateurs-prose.mjs` et câblés sur
                              `materialiser` (`scripts/source/resoudre.mjs`) à la migration de leur famille.
                              Godot sert les chapitres à son éditeur d’adresses.
  hash.ts                     Hachage déterministe partagé (`hash32` FNV-1a, `seedStream`) : empreinte
                              de découpe et flux de graines.
scripts/source/             Le côté NODE de la chaîne d'adressage de prose — entrées/sorties seulement,
                            le parsing vit dans `src/data/source/decoupe.ts` (PUR). `lecteur-fs.mjs` rend
                            le chemin d'un chapitre (`cheminChapitre`), le lit et le mémorise, résolu à la
                            racine du dépôt d'où que le processus soit lancé ; `resoudre.mjs` porte les deux
                            portes FAIL-CLOSED (`resoudreProse` pour UNE entrée, `materialiser` pour une
                            racine de document) ; `derive-decoupes.mjs` DÉRIVE une adresse
                            d'une `desc` existante et rend le verdict d'adressabilité (`judge`, consommé
                            par les migrations) ; `adresses.mjs` est L'INVENTAIRE des adresses du dépôt
                            (walk unique des deux racines par `listerArbre`, lu par la garde de
                            re-résolution, par la sonde de matérialisation et par l'outil de réparation) ;
                            `reecriture-ancree.mjs` remplace un fragment de TEXTE à sa place exacte
                            (`remplacerAncre`/`compterAncre` — indentation et ordre des clés du document
                            authoré préservés, ancre non unique = refus), consommé par les migrations et
                            par `reparer-adresses.mjs` ; `reparer-adresses.mjs` relocalise une adresse
                            cassée par son texte d'origine (`git show <ref>:<chapitre>`) et n'écrit que
                            ses `RECALÉE` (geste humain : `docs/ajouter-un-livre-source.md` §7) ;
                            `mesurer-prose-inline.mjs` et `inventaire-consommateurs-prose.mjs` mesurent
                            le stock qui reste à adresser et ses consommateurs Node ; `decoupe-cli.mjs`
                            inspecte un chapitre à la main ; `prose-source-plugin.mjs` est le plugin Vite
                            `wfrp:prose-source` (matérialisation au build, service des chapitres en dev)
scripts/migrations/         Migrations de donnée REJOUABLES (une par lot, datée) : rejouées sur l'arbre
                            courant elles ne réécrivent RIEN. `npm run migrations:replay` (replay.mjs)
                            les rejoue dans l’ordre par unités de code, EN PLACE, et mesure l'arbre par git diff
                            (suivi) ET git status (non suivi) — toute donnée réécrite ou tout fichier
                            neuf est ROUGE et NOMMÉ. Sur un arbre en WIP ce rejeu est destructif :
                            `npm run migrations:replay:head` (replay-head.mjs) le joue sur un EXPORT
                            jetable de la tête, mesuré par EMPREINTE (`lib/empreinteRejeu.mjs` —
                            hors dépôt, `git diff` bascule en `--no-index` et rend un faux vert), et
                            le hook `pre-push` l'arme dès que la plage poussée touche le périmètre
.claude/skills/<mod>/       Mod Claude Code (une racine qui porte `.claude-plugin/plugin.json`) : `hooks/**`
                            en `.ts`, couture `hooks/ops.ts` ; chargé par le moteur, jamais par le produit
                            (§ Mods Claude Code)
scripts/mods/               Garde `mods:check` (`verifier.mjs`) : validation stricte, types posés par le
                            moteur, `tsc` et bancs de chaque mod, sur une copie sous os.tmpdir() ;
                            racine d'un mod (`racines.mjs`) ; banc du mur des mods (`murDeMod.test.mjs`)
scripts/hooks/               Répartiteur des hooks d'appel d'outil (`repartiteur.mjs`, `repartition.mjs`) : gardes de
                            `registre.mjs` par événement. `regles-projection-guard.mjs` projette les
                            `.claude/rules/*.md` à `paths:` sur les lectures lean-ctx et `ctx_patch` (#2683),
                            `regles-projection-oubli.mjs` en efface l'état au SessionStart d'une compaction
src/lib/                     Couche NEUTRE, feuille de `COUCHES`, en amont de toutes les zones : ce que
                            plusieurs couches emploient sans qu’aucune ne le possède. `normalize.ts` :
                            normalisation d'un nom (`norm`), nom de fichier sûr (`fileSlug`).
                            `entityId.ts` : id PUR et unique dans une collection, plus petit suffixe
                            libre parmi les ids pris (`nextEntityId`) — scène, entité, faveur, set d'armes.
                            `regex.ts` : échapper une chaîne pour une regex (`echapperRegex`), alternation
                            de chaînes ou de fragments de regex (`alternationDe`, `alternationDeRegex`),
                            `espacesExtensibles`. Module PUR, sans import : Node nu le charge aussi, par
                            son chemin relatif, extension comprise.
                            `garanti.ts` : une valeur que son producteur garantit, absente, lève un
                            défaut interne qui nomme ce qu'on cherchait et sous quel id (`garanti`, #1906).
                            `stockage.ts` : les ports `Stockage` (sous-ensemble synchrone de `Storage`) et `Base` (base
                            asynchrone de documents : `lire`, `lireTout`, `ecrire`, `supprimer`), les accès protégés
                            `lireLeTexte` et `retirerLaCle`, et les lecteurs JSON appliqués à un `Stockage` : `lireDictionnaire`
                            et `lireTableau`, avec `lesChaines` (#2404) ; `stockage.testkit.ts`, ses stockages de test (en mémoire, qui lève,
                            posé en `localStorage`).
                            `base64.ts` : le base64 des octets dans les deux sens (`enBase64`, `depuisBase64`),
                            seul site de `btoa` et `atob` (`murs/base64`, #3948).
src/geometry/                Géométrie/simulation PURE, feuille de `COUCHES` (#161 : `state` en a
                            besoin pour SA PROPRE logique — curseur de combat, IA —
                            pas seulement le rendu ; zéro dépendance framework). `iso.ts` : projection
                            isométrique (Dims, tileCenter, rotTile…) — `noyau/monde/iso.ts` la ré-importe pour
                            ses dérivés qui ont besoin du MONDE (WALL_H_M/isoPxToM, via noyau/monde/relief).
                            `dir8.ts` : Dir8 (8 caps grille) et son sous-ensemble cardinal Dir4 +
                            géométrie associée : rotateDir8, DIR8_DELTA, facingToward (#161, #2884 : la
                            géométrie de cap grille n'est ni du rendu ni du monde ; `data`, `noyau`, `ui` et
                            `gameIso` l'importent, ce dernier pour l'orientation écran).
src/engine/                 Règles WFRP4, PUR + testé, sans hôte (mur `murs/sans-hote`,
                            `oxlint.config.mjs`) : ni entropie, ni horloge murale, ni service du
                            navigateur ; un tirage prend le `RNG` que l'appelant nomme, une quantité
                            lue avant le jet est une `FormuleSansTirage` évaluée sans RNG.
  types.ts                    Caractéristiques, Combatant, Weapon, ItemInstance, Difficulty…
  authoringAppearance.ts      types d'APPARENCE (`EntityAppearance` authorée, `Appearance` résolue,
                              `EspeceDApparence`) : portés par le
                              Combatant (#187, #2884)
  tests.ts                    Tests & Degrés de Réussite (DR), tests opposés.
                              **INVARIANT — `base` = le Niveau de Compétence NU (Caractéristique +
                              Augmentations, LDB 09 l.17), PARTOUT.** Tout modificateur (Avantage,
                              États, Soutien, ward, Difficulté…) voyage dans le `modifier`/la cible,
                              jamais fondu dans une « value » : c'est cette valeur nue que
                              `resolveOpposed` compare à DR égal (LDB 12 l.160). Source UNIQUE de la
                              formule : `skillBaseValue` (`castingBaseValue` n'en délègue que la
                              variante Domaine) ; deux points d'étranglement la relisent à la source
                              pour le chemin magie (`evaluateCasting`, `counterspellOutcomeFrom`).
                              Corollaire de NOMMAGE : une fonction dont le nom promet une valeur mais
                              qui y fond des modificateurs est un bug (`castingValue`, #1150) — le
                              site qui a besoin de la nue APPELLE l'accesseur, il ne soustrait pas.
  combat.ts                   touche/localisation inversée/dégâts/critique/initiative
  characteristics.ts          bonus, Blessures (BF+2×BE+BFM)
  character.ts                création de personnage (espèce+2d10, 40 augmentations, talents…)
  creation.ts                 tables de création LDB 04/05 : d100 espèce/carrière, bonus PX,
                              100 Points, Richesse initiale, âge/taille/yeux/cheveux
  careerSlots.ts              spécialisations & emplacements « (Au choix) » des carrières :
                              parsing, désignations par carrière, Maxi des talents
  talentEffects.ts            talents à effet création/attributs (+5 carac de départ, addSkill,
                              Dur à cuire/Chanceux/Obstiné/Véloce)
  advancement.ts              coûts PX, complétion de Niveau, changement de carrière (validé)
  items.ts                    inventaire/équipement : itemFromTrapping, recomputeLoadout, encombrement
  skills.ts                   valeur d'un test de compétence (partyBest) hors combat
  conditions.ts               États (+ durées d'États de sort, États récurrents)
  ops.ts                      **`GameOp` = LA langue UNIQUE de tout EFFET mécanique** (soin, retrait/pose
                              d'État, octroi de trait/talent/arme, dégâts, modificateurs, corruption…),
                              exécutée par `applyOps(target, ops, ctx)` et éditée au Compendium Godot.
                              AVANT de modéliser un effet en type/champ ad hoc → l'exprimer en `GameOp[]`.
                              Consommée par : sorts, Imparfaites (miscast), mutations, traits, qualités
                              (`passive`), effets déclenchés (`Flow`/`Trigger`), CONSOMMABLES. Jalon 2.6 :
                              PerSL (échelle par DR), onlyGroups, grantTrait/grantTalent/augmentWeapon/…
                              CATALOGUE GÉNÉRÉ des ops (+ `Condition`/`Flow` de flowCore.ts,
                              `EffectTrigger` de son schéma) : `docs/vocabulaire-mecanique.md` (`npm run docs:vocabulaire`)
                              — index par CONCEPT en français, résolution mesurée (« exécutée » /
                              « inerte au switch » / « hors switch » : les deux dernières = impur résolu
                              par le noyau, ou passif lu par un collecteur — jamais « inutilisable »),
                              usages réels en donnée. À CONSULTER avant de conclure à un manque du moteur.
  spellspec.ts                spellSupport : classification mécanique/partiel/narratif d'un sort depuis
                              SpellData (duck typing — l'interface SpellSpec, le registre spellspecs/ et
                              le repli regex fallbackSpec sont supprimés, métadonnées en donnée)
  magic.ts                    incantation/Focalisation/Péché/ZdE/portée/armure (« Repousser les Vents »)
  miscast.ts                  tables d'Imparfaites & Colère des dieux (d100 → GameOps, verbatim)
  corruption.ts               Corruption & mutations (LDB 19 : expositions, seuil, limites → damné)
  grimoire.ts                 apprentissage/mémorisation des sorts (coûts par Talent) + lecture au livre
  travel.ts                   voyage RAW (#T2) : vitesses km/h, 6 h/jour, marche forcée, coûts diligence/barge
  provisions.ts               rations & Faim (LDB 18 l.337-342) : consommation/jour, Tests, malus, Brouet ; lots datés de la cale (MDG 14 l.238)
  axes.ts                      axes de forces/faiblesses (#409, mécanique MAISON) : axisScore/axesProfile/
                                partyCoverage/dominantAxes depuis `data/axes.json` (`derivation` en ids de
                                skills/talents) — SOURCE UNIQUE du mini-radar, du rail de composition (#417)
                                et des « rôles » de carte (`heroRoles`, `ui/CharCard.tsx`, réconcilié dessus)
src/noyau/                  ORCHESTRATION du jeu, sans hôte : la fermeture d'import de chaque module
                            n'atteint que `engine`, `data` et les feuilles ; `state` lui est fermé, même
                            pour un type (`COUCHES`). Modules : `etat.ts` (le type de l'état du jeu,
                            `Jeu`, et ses valeurs initiales), `actionsDuNoyau.ts`, `plateforme.ts`
                            (services que l'hôte pose : appel différé et état de son jeton, persistance d'un héros), `triggeredEffects.ts`,
                            `cascade.ts`, `rollSeam.ts`, `sieges.ts`, `slotsDeJet.ts`, `stepBrand.ts`,
                            `fixedDieMark.ts`, `recapLine.ts`, `partyWipe.ts`, `voyageCadence.ts`,
                            `battleRng.ts`, `bus.ts`, `combat/flowEval.ts`, `combat/advantagePool.ts`,
                            `reglesMaison.ts` (verrou des règles maison en partie, lu par tout hôte, et leur pose : jeu
                            persisté élagué, surcharge sous le verrou), `preferences.ts` (la table des préférences
                            de confort : forme, défaut, lecture et écriture de leur valeur du moteur), et les flux
                            de jeu ci-dessous. Outils d'auteur purs, lus par l'éditeur et par les tests du
                            contenu : `validateScene.ts` (un projet avant le runtime ; l'hôte y passe ses
                            pistes de musique), `mapQC.ts` (harnais d'atteignabilité d'une carte),
                            `planDefects.ts`, `dialogueLibelle.ts` (le libellé d'une réponse qui recopie
                            ce que la fenêtre annonce, lu aussi par `scripts/guards/lib/dialogueLabelTest.mjs`).
                            Modèles-vues que tout hôte dessine : `poste.ts` (l'assignation à un poste),
                            `stations.ts` (les stations d'une scène pour la vue du dessus). Sans hôte (mur `murs/sans-hote`) : le RNG de bataille
                            (`battleRng.ts`) naît de la graine fixe `GRAINE_INITIALE_DE_BATAILLE`, que
                            l’hôte ré-ensemence (`seedBattleRng`). Les ACTIONS de jeu (`ActionsDuNoyau`) naissent de fabriques
                            `(get, set) => actions`, une par concept, rangées dans le module du concept
                            (`createCombatSlice`, `creerActionsDuMarchand` de `merchantFlow.ts`…) ou dans
                            un module propre : `entreeEnScene.ts` (partie neuve, changement de scène,
                            `EVT.ARRIVEE_EN_SCENE`), `marcheDuGroupe.ts` (pas, saut, porte),
                            `interactionsDExploration.ts` (offres, assise, fouille), `conversation.ts`,
                            `testsDeScene.ts`, `issueDeCombat.ts`, `campagne.ts` (indices, documents, héros
                            désignés), `orientation.ts`, `horloge.ts`, `journal.ts` ; `fabriquesDuNoyau.ts`
                            (`creerActionsDuNoyau`) les compose pour la partie avec la
                            machinerie (`machinerieDuNoyau.ts`, #3370) : les écritures que le noyau, l'éditeur ou
                            un test appellent et qu'aucun hôte ne joue, hors de `Intention` et de `VERBES`.
                            `partie.ts` (`creerPartie`, #2817 D9) porte l’état de la partie. Chaque `envoyer`/`lancer`/`reprendre`/`relever`/`recevoir`
                            rend `{ issue, evenements, journal }` (`recevoir` y joint `neuve` et `autreScene`),
                            et `abonner` suit chaque écriture. `lancementDeScenario.ts` (#2898) : le lancement d'un
                            scénario de test et sa séquence unique, jouée par la partie.
                            `index.ts` : la SURFACE du noyau pour un hôte et sa seule réexportation admise
                            (`murs/reexportation`). Ailleurs, chaque importeur nomme le module qui déclare.
                            `npm test` joue les suites du noyau, des scénarios et des hôtes. Les imports
                            des suites et bancs suivent les murs décrits dans la section Couches.
  pendings.ts                 types Pending*
  combatLog.ts                CombatEvent/CombatEventKind + CombatTone/toneOf/isImportantEvent/
                              lastEventTone (#161 : cadence des beats, `gameIso/combatNarration` les
                              réutilise pour l'icône/la coloration par camp, hors du périmètre `state`)
  worldMap.ts               SCHÉMA DE CARTE DU MONDE (#T2) : lieux/routes au niveau projet + format projet
                            (`ProjectDoc`, porte `parseProject` : `projetSchema` SEUL contrôle de forme, aucun
                            numéro de version, toute autre forme REFUSÉE — #2404 ; `activeAxes?: string[]` #409 — axes de forces/faiblesses ACTIFS de
                            la campagne, conservés comme ids facultatifs de `data/axes.json`).
                            DONNÉES DE LIEU (#343) : le nœud `MapPlace` est LA source des services d'un lieu —
                            `port` (schéma riche + catalogue `naval-ports.json`), `market` (LandMarketProfile) et
                            `services[]`, ses ÉTABLISSEMENTS (#4277) : `id` STABLE unique dans le lieu, `kind` =
                            entrée du catalogue `lieux-services.json` (auberge/temple/forgeron/guilde…), plusieurs
                            d'un même type par lieu. API UNIQUE `placeServices(place, scene?)` : compose ces trois
                            sources + l'auberge (offre PROPRE à l'établissement OU dérivée de l'offre de repos de
                            la scène liée) en une liste `ResolvedPlaceService[]` (`id` de routage, `kind` du
                            catalogue) — payloads RÉFÉRENCÉS, jamais recopiés. Lue au lieu du groupe par
                            `servicesDuLieu` (`lieuFlow.ts`) : écran du lieu, repos (`reposDuLieu`), rumeurs,
                            échoppe ; chaque geste du lieu porte l'id de l'établissement. Un point d'intérêt du
                            plan (`poi[]`) mène à une scène (son `label`) OU vise un service résolu du lieu par son
                            id, dont il prend le nom (`nomDuPoi`).
  worldMapEdit.ts           ÉCRIVAINS PURS de la carte du monde (WorldMap → WorldMap) que l'éditeur appelle :
                            patchs, ajout de lieu (bornes `BORNES_DE_CARTE`, décalage, libellé de la semence),
                            liaison dédoublonnée par sens, suppressions en cascade (routes, `suite` des billets).
                            Ses valeurs neuves (péripétie, port, marché) : `peripetieNeuve`, `portNeuf`, `marcheNeuf`.
  valeursNeuves.ts          VALEURS NEUVES de l'atelier qui lisent le moteur ou le monde : `newOp`,
                            `formulaForShape`/`shapeOf`, `newEffect`. Celles qui ne lisent que schémas et
                            donnée vivent dans `data/valeursNeuves.ts` (`recast`,
                            les blocs neufs d'un Flow authoré `noeudTestNeuf`/`blocNeuf`, `emptyStatblock`).
  combatFlow.ts               flux de combat tour par tour (IA, attaques, effets, fin de combat).
                              Les clusters FEUILLES extraits sont des modules séparés, que chaque importeur
                              nomme directement : monde/combatGeometry.ts (géométrie pure),
                              combatPlacement.ts (gestes de placement qui écrivent la bataille),
                              combatEffects.ts (effets de scène/campagne : applyEffects, butin attribuable,
                              checkTriggers, pushReveal), combatManeuvers.ts, combatHooks.ts, combatSetup.ts,
                              combat/. Un module feuille n'importe RIEN de combatFlow (tout passe par
                              get().xxx / modules feuilles). NE PAS extraire le preview
                              (previewAttack/Defense) : il partage attackEnv/bestDefenseMode avec la
                              résolution → cycle. La cohésion preview↔résolution est voulue.
  rollFlowFactory.ts / rollFlowSpecs.ts  FABRIQUE générique des flux de jet différé (« une situation = une modale ») +
                              specs des flux (attack/defense/cast/disengage/run/focus/psych/
                              frenzy/approach/test/heal + reload/recover/activity/corruption/appraise/
                              bargain) — un nouveau jet = 1 spec + 1 corps de clôture. Résilience « Je ne
                              faillirai pas ! » (LDB 17 l.68, GLOBALE) : mécanisme UNIQUE (factory
                              `forcerLaReussite`/`imposerLeResultat` + UI `ForcedRollPicker`). Un flux qui
                              l'offre déclare `caps: { forced: true }` ; son `resolve(s,p,actor,get,
                              forced?)` porte alors LES TROIS cas dans UN seul résolveur : `forced`
                              absent = jet normal (RNG) ; `{}` = `forcerLaReussite` (dé par défaut : 01→DR
                              max, ou opposé→jet courant forcé à ≥ DR+1) ; `{ roll }` = `imposerLeResultat`
                              (dé choisi, doit rester une réussite). PLUS de dérives `force`/`forceRoll`
                              séparées (l'ancien « code dérivé ») — la résolution forcée VIT dans le
                              résolveur du Test, à côté du jet normal. La localisation suit le dé inversé
                              (attaque LDB 13 l.142, Projectile magique LDB 46 l.156) : choisir le dé la
                              re-dérive — il n'y a PAS de « coup ciblé » libre pour un Projectile (RAW).
  corruptionFlow.ts           gainCorruption (seuil → mutation → damnation, révélation 🧬) + cibles
  partyFlow.ts                équipement, avancement PX, consommables de fiche, butin
  merchantFlow.ts             marchand : réassort, panier, achat/vente/réparation, Marchandage, Évaluation
  travelFlow.ts               voyage jour par jour (temps, fatigue, péripéties d10+auteur, interruption/reprise)
  evenementDuJour.ts          l'événement raconté du jour d'un trajet, tous milieux : `noteEvent`, seul écrivain de
                              `TravelPlan.evenements`, et `rangerLesEvenements`, appelé par chaque sortie de jour
  billetFlow.ts               billet d'un passage payant : offre de départ (estimation = débit), billet en main, Marchandage du billet
  upkeep.ts                   entretien QUOTIDIEN (#T3 cascade : rations/faim + maladies + convalescence
                              des critiques, jours CALENDAIRES) + purge des effets a duree d'horloge
                              (castPenalties/ActiveEffect.untilTime) — anti-double-comptage lastUpkeepDay
  monde/                    MODÈLE DU MONDE, dossier de lecture (aucune zone de `COUCHES` ne le tient) :
                            `flow.ts`, `sceneRules.ts`, `sceneMemo.ts`, `relief.ts`, `terrain/`,
                            `wallIndex.ts`, `decorIndex.ts`, `footprint.ts`, `path.ts`, `lineOfSight.ts`,
                            `zones.ts`, `usable.ts`, `combatants.ts`, `combatGeometry.ts`, `porteurs.ts`
                            (`sourcesEnVue` : les combattants en Ligne de Vue d'un porteur, que lisent les Tests de
                            Psychologie, la Condition `cibleEnVue`, `foeInLoS` et la cible de Frénésie ;
                            `sourcesPsyEnVue` : ces combattants et l'étiquette de la scène, `etiquetteDeScene`), et les modules qui
                            ne lisent ni ne posent d'état de combat ni de flux : IA (`ai.ts`), apparition
                            (`spawn.ts`), navires (`ship*.ts`), narratif de
                            campagne, pièces, vision, authoring ASCII (`asciiMap.ts`, et son export inverse `sceneToAscii.ts`).
  monde/scene.ts            SCÈNE : fonctions PURES (tuiles, murs, portes, relief) + 36 types exportés,
                            dont 23 `z.infer` des schémas de `data/schemas/defs-scenes/`. Restent 13
                            MANUSCRITS : `Scene`, `SceneEntity`, `SceneDuVolume` (la scène vue par son
                            volume, tirée de `CHAMPS_DU_VOLUME`), `SceneDesToits`, `SceneDuBati` et
                            `SceneDesCouronnes` (la scène vue par ses nappes de toit, par les ornements de
                            son bâti et par ses couronnes, tirées de `CHAMPS_DES_TOITS`, `CHAMPS_DU_BATI`
                            et `CHAMPS_DES_COURONNES`),
                            `AuMoinsUnPorteurDeFiche` (au moins un porteur de fiche, dérivé de
                            `PORTEURS_DU_TYPE`), `ActionAuthoree` (geste authoré d'une instance de décor),
                            `SceneEffectZone` (corps du document), `Layer` (l'infer du schéma dont `tiles`
                            est ÉLARGI à l'alias de terrain de `defs-scenes/scene.ts` : `idDe('terrain')`
                            brande l'id qu'il rend, et l'authoring TS n'est pas parsé), `WallOverlay` (ce
                            qu'un char de légende d'arête ÉCRIT sur une arête : `structure`/`appearance`),
                            `Atterrissage` (où l'on atterrit en quittant une surface,
                            `surfaceDAtterrissage`), `CellSide` (alias primitif). Comptes
                            et liste GATÉS par `src/scene-field-editability-guard.test.ts`.
                            Les types que la donnée lit vivent avec leurs schémas : l'union `Effect` et
                            ses deux annotations du `z.lazy` (`DelayedEffect`, `PetitePriere`) dans
                            `defs-scenes/effets.ts` ; `Terrain`, `ReliefDefaults` et `SceneRoofDefaults`
                            dans `defs-scenes/scene.ts`.
                            `CellSide` = l'ARÊTE d'une case (quel bord porte un mur) ; le CAP, lui, vit
                            au foyer des caps (`geometry/dir8.ts`)
  monde/seating.ts            ASSISE — source UNIQUE des places assises d'une Scène : `seatSlotsOf`
                              (places déclarées par le TYPE de décor → abord EFFECTIF, jamais partagé
                              avec une autre place de la scène), `seatIsOccupiable`/`seatPoseOf`,
                              `assignSeat`/`releaseSeat` et l'élagage (`pruneSeatAssignments`,
                              `releaseUnavailableSeats`). PUR : aucun store, aucun rendu, aucun `gameIso`
  monde/campaignNarratif.ts NARRATIF VIDE d'un paquet de campagne (#765) : `emptyNarratif` pose une liste vide par
                            registre (`REGISTRES_NARRATIFS`). Le bloc (`NarratifBlock` et ses types frères) vit
                            avec son schéma, `data/schemas/defs-scenes/narratif.ts` : EMBARQUÉ dans le JSON du
                            projet, jamais copié dans `src/data` global (`narratifSchema` refuse toute
                            collision d'id).
  monde/resolveursDuNarratif.ts COUTURE UNIQUE de résolution de la couche de campagne (#767, #2817), sans store : chaque
                            résolveur prend son narratif en ARGUMENT (celui de la partie, `campaignNarratif`, ou celui du
                            projet édité) et lit par id STABLE. `presetDuNarratif`/`indiceDuNarratif`/`documentDuNarratif`
                            = COUCHE-SEULEMENT (n'existent pas au global) ; `objetDuNarratif` chaîne campagne-D'ABORD puis
                            règle globale (`trappingDesObjetsPuisDuCatalogue`). Tables mémoïsées par identité du narratif.
                            Le moteur reste PUR : `engine/items` reçoit ce résolveur d'objet injecté aux sites d'état
                            `giveTrapping` — il n'importe jamais le store.
                            PNJ nommés (#671) : `resolvePresetCreature` résout un `presetId` de scène en créature mergée
                            (`mergeCreatureProfile`, base globale + surcharges du preset) + apparence embarquée ; câblée au
                            spawn de rencontre (`combatSlice` → `ficheDEntite` → `spawnEnemy` canal `{ presetCreature, presetId }`, `monde/spawn.ts` reste sans
                            import de cette couche).
  monde/spawn.ts            apparition des entités de scène et de rencontre (`spawnEnemy`)
  edition/                  L'ÉDITEUR DE CARTE sans hôte (#3508) : `pointeur.ts` (appui, glissé, relâché d'un point de la carte
                            routés vers les écrivains de `sceneEdit.ts` selon l'outil, avec le cran d'annulation et la
                            sélection que le geste porte), `historique.ts` (annuler, rétablir, crans bornés), `session.ts`
                            (la session d'édition et son réducteur `editer` sur l'union des gestes) ; l'éditeur web
                            appelle le pointeur et l'historique, l'éditeur Godot joue la session par le pont (`editer`).
  creation/                 BROUILLON DE CRÉATION de personnage (LDB 04/05), sans écran : `brouillon.ts` (état pur :
                            tirages figés, bonus PX, validation, `buildHero`), `defauts.ts` (`fillDraftDefaults`)
  persistance/              documents PERSISTÉS, sans stockage : `elagage.ts` (`elaguerLePersiste`, seul élagage
                            des ids hors registre — règles, États, Cible d'un Trait psychologique hors
                            `groups.json`, Trait retiré entier —, #1463 LD.1), `roster.ts` (le roster `RosterStocke` et l'export
                            `ExportDeHeros` : lecture contrôlée et élaguée, écriture, mise à jour d'une entrée,
                            export/import d'un héros), `bibliotheque.ts` (l'entrée de la bibliothèque de campagnes
                            `savedProjectSchema` : relecture prouvée, refusée ou indésignable, ce qu'une écriture en
                            garde, nom d'affichage, campagne lancée d'une entrée), `save.ts` (la sauvegarde : `SaveGame`, dont le `data` est
                            `EtatDeJeu` moins `HORS_SAVE`, jamais l'état d'affichage d'un hôte ; `snapshotSave`,
                            `metaDeSave`, la forme texte `lireSave` (la save ou la cause de son refus,
                            `ObsoleteCause`, lecture d'un emplacement comme import) avec `exporterLaSauvegarde`,
                            `chargerLaSave` qui rend l'état de jeu à ouvrir élagué, ses règles
                            maison et ses retraits, `refusDeSauvegarde` ; règles maison du snapshot coop) et
                            `formats.generated.ts` (FORMATS PERSISTÉS, gitignoré) : la sauvegarde, le roster et
                            l'export ne se lisent qu'à leur format courant.
  coop.ts                   LA COOP sans hôte (#3041) : `buildDeLaCoop` (le `build` comparé au `hello`),
                            `instantaneDeLaCoop` (l'instantané de l'état de jeu que l'hôte diffuse : clés de la
                            sauvegarde, paquet de campagne en stub, hors `LOCALES_AU_CLIENT`, règles maison jointes),
                            `appliquerLInstantane` (son application à l'état de l'invité, qui garde son identité réseau)
src/hote/                   COMMUN AUX HÔTES du noyau (#2928) : ce qu'un hôte fait d'une partie, sans écran ni
                            horloge. `partie.ts` (l'erreur structurée d'un geste et sa catégorie, l'en-tête d'une
                            partie, son ouverture : la partie du noyau, le scénario de test lancé, la tenue des jetons
                            programmés, numérotés : un jeton ne traverse pas JSON), `geste.ts` (un geste écrit en
                            JSON, son verbe et ses arguments contrôlés, son intention, l'issue de son envoi en
                            catégorie d'erreur ; l'hôte y joint ses pistes de lecture), `projection.ts` (la projection de
                            l'état en données, chaque liste aux bornes de l'hôte, les cases atteignables),
                            `formes.ts` (la forme JSON d'un paramètre de verbe), `verbes.generated.ts` (les
                            paramètres des verbes, `scripts/gen-verbes.mjs`), `gestes.ts` (`fenetreADessiner` : la
                            fenêtre qui tient la main, chacun de ses verbes en geste prêt à saisir et à rendre),
                            `elements.ts` (l'union fermée des éléments de la vue, nommés par forme de
                            donnée, et les gestes de la fenêtre en éléments), `ecran.ts` (`zonesDeLEcran` : chaque zone
                            de l'écran d'un hôte qui dessine la partie et ses éléments, leurs textes tirés du catalogue
                            et des lecteurs du noyau), `editeur.ts` (`zonesDeLEditeur` : les zones de l'éditeur de carte,
                            lues de la session d'édition du noyau, et la surcouche du geste en cours, #3508),
                            `roster.ts` (la procédure du roster
                            sur le `Stockage` que l'hôte fournit : charger, ajouter, retirer, mettre à jour — le
                            service `persisterLeHeros` d'un hôte qui a un stockage ; le chargement REND ses témoins de
                            retrait et d'élagage, que `avisDuRoster` dit ; `rosterAMontrer` rend les héros et l'avis
                            qu'un hôte montre tant que le groupe se compose, zones `groupe.roster` et `groupe.avis` ;
                            `engagerLeHeros` écrit l'entrée du héros créé et rend l'intention que le noyau en bâtit ;
                            `fichierDuHeros` rend le fichier d'export d'un héros, `importerAuRoster` en importe un),
                            `reglesMaison.ts` et `preferences.ts` (leur persistance sur le même
                            `Stockage` ; un chargement de règles maison qui élague cumule son témoin sous sa propre
                            clé, que `prendreLeTemoinDesReglesMaison` consomme au montage du panneau des règles ;
                            `reposerLesReglesMaison` repose celles du joueur avant une partie du jeu),
                            `reglages.ts` (les préférences et les règles maison en zones `reglages.*`, chaque entrée
                            rendue par la forme de son contrôle, et `jouerUnReglage`, le geste qui en règle une et
                            la persiste), `accueil.ts` (les entrées de l'hôte avant toute partie, zone
                            `accueil.gestes`), `salon.ts` (`zonesDuSalon` : le salon de la coop en zones `salon.*`,
                            pur de l'état, de l'ouverture que l'hôte tient et du réseau ; les attributions de siège
                            sont les offres du noyau, `siegesOfferts` ; et `lireUnGesteDuSalon`, le geste de salon
                            lu dans les zones d'avant le geste, ou refusé),
                            `sauvegardes.ts` (les emplacements de sauvegarde sur le même `Stockage` : écrire, lire, retirer,
                            lister ; une save illisible ou d'un format refusé est rejetée et retirée à la lecture,
                            son retrait cumulé dans le témoin, que `prendreLesRetraitsDeSauvegardes` consomme pour
                            le message au joueur), `temoin.ts` (le témoin persisté d'un chargement : cumul au témoin déjà posé, prise unique ;
                            la relecture et l'union des retraits sont à `noyau/persistance/elagage.ts`), `bibliotheque.ts`
                            (`ouvrirLaBibliotheque` : la procédure de la bibliothèque de campagnes sur les ports `Base`
                            et `Stockage` de l'hôte, relus à chaque appel, sous les réglages de l'hôte (borne du miroir
                            par entrée, causes d'un stockage indisponible) ; la poignée porte le cache, les tombes en
                            attente et les refus au geste), `coop/` (la coop sur le `Transport` que l'hôte fournit :
                            `protocol.ts`, les messages et leur validation, `session.ts`, `HostSession`/`GuestSession`
                            hôte-autoritaires, l'instantané pour seul état diffusé, scènes de la campagne comprises
                            (`campaignDoc`, `appliquerLInstantane`). `salon.ts` lit les arguments des intentions
                            admises par `gesteDuVerbe` sur l'état de l'hôte au nom du siège du transport, avant de
                            les transmettre au noyau. `transport.ts`, le port `Transport`, et sa paire en mémoire
                            de test `transport.testkit.ts`),
                            `stockageWeb.ts` (accès protégé au `localStorage` et au `sessionStorage`, `stockageWeb`,
                            pour la page de l’hôte Godot ; un dictionnaire persisté s'y relit par
                            `lireDictionnaire` de `lib/stockage.ts`, chaque VALEUR validée par son lecteur contre son
                            registre, #2404 ; les clés de stockage ne portent aucun numéro de version : `wfrp4.prefs`,
                            pas `wfrp4.prefs.v1`), `entropie.ts` (le seul site de `Math.random` des zones, mur
                            `murs/entropie`, #2817 : entier de présentation `entierDEntropie`, graine
                            `graineDEntropie` — RNG de bataille posé par `seedBattleRng` au branchement du store,
                            dés d'une partie que le pont Godot ouvre ou charge, brouillon de création, générateur de
                            nom —, id d'entité unique d'un projet à l'autre `idDEntropie` : scène, carte, projet, lieu,
                            trajet, héros de roster, que `emptyScene(id)`/`emptyWorldMap(id)` reçoivent de l'hôte ;
                            `src/engine` et `src/noyau` n'en tirent jamais). `ouvrirLaPartie` (`partieDeTest.ts`) reçoit le `persisterLeHeros` de l'hôte. Entrée d'un hôte
                            servi ou bâti par
                            Vite : `scripts/entree-d-hote.mjs`.
hotes/texte/                HÔTE TEXTE du noyau (#2898, zone `texte`) : une partie pilotable par un serveur MCP, sans store
                            ni écran (`docs/hote-texte.md`). N'importe du noyau que sa porte `src/noyau/index.ts`
                            (`portes` de `COUCHES`), plus `scenes`, le module commun `src/hote/` et les feuilles.
                            `partieTexte.ts` (fichier de partie, rejeu, reprise des jetons sur une horloge
                            virtuelle), `vue.ts` (projection à ses bornes et rendus bornés), `outils.ts` (les trois
                            outils et leur schéma), `serveur.ts` (ce qu'ils font) ; servi par
                            `scripts/hote-texte.mjs` (SDK MCP, stdio), déclaré par `.mcp.json`.
hotes/godot/                HÔTE GODOT du noyau (#2928, zone `godot`) : le pont JSON que Godot appelle, dans la page de
                            l'export web ou, hors d'une page, par un processus Node (`processus.mjs` : `vivant.mjs`
                            sous l'éditeur, #3945, que `npm run godot:ouvrir` ouvre sur le projet ; `embarque.mjs`,
                            empaqueté à côté de l'exécutable de bureau, #3951).
                            `pont/pont.ts` (une méthode = une chaîne JSON en entrée, une en sortie, jamais une levée ;
                            gestes par le module commun, vue faite des lecteurs du noyau, jetons tenus par numéro ; la
                            porte `appelerEnOctets` des transports de Godot passe les tableaux de `morceaux` en un
                            tampon de `Float32`, `pont/octets.ts`, #3948), `pont/entree.ts` (`globalThis.wfrpPont`),
                            contrat `pont/CONTRAT.md` ; `construire.mjs
                            --pont-seul` bâtit le bundle iife par Vite (`npm run pont:godot`, étape de la CI).
  asset/                    le contrat d'asset d'un personnage 3D (lecteur GLB, manifeste, import par `importer.mjs`) ;
                            le manifeste d'élément du schéma 3 et sa validation contre la base et la donnée du jeu (`asset/element.ts`) ;
                            les GLB vivent dans les Releases `modeles-3d-<c>`, nommés par leur SHA-256 dont `<c>` est le premier caractère (#4823), que la provenance
                            commitée épingle (`asset/release.ts` : `recupererModeles` avant Godot, `publierAssets` à l'import) ;
                            depuis le cloud, une branche `transfert/<nom>` qui porte les fichiers et leur provenance
                            (`asset/transfert.ts`, `npm run godot:transfert`) les y verse au push
                            (`.github/workflows/transfert.yml`, `epingles.mjs`), puis s'efface.
  projet/                   le projet Godot 4.7 (GDScript, scènes, manifestes et provenances des modèles 3D, leurs licences) : il dessine la
                            vue et rend chaque geste en intention, sans règle, l'arithmétique de la mise en page dans
                            le seul `hotes/godot/projet/scripts/mise_en_page.gd` (gardes `src/hote/derive-du-noyau.hors-store.test.ts`,
                            `scripts/guards/lib/gdscriptSansRegle.mjs`) ;
                            jetons armés en minuteurs. `construire.mjs --sonde` importe une copie du projet, contrôle
                            chaque script puis exécute les recettes sous `recettes/` déclarant au premier niveau
                            `const RECETTE_AUTONOME := true`, avec `--pont=<vivant.mjs>` pour seul argument, chacune
                            jugée hors des erreurs qu'elle déclare attendre (`const ERREURS_ATTENDUES`, chacune dite
                            autant de fois que déclarée, `erreursDeLaRecette`) ; une recette à rendu réel
                            ne porte pas cette déclaration. L'éditeur est épinglé (`npm run godot:sonde`,
                            étape scripts et recettes autonomes de la CI). `--export --sortie <dossier>` produit
                            l'export Web et, à côté, chaque modèle en scène que l'éditeur fabrique de son GLB
                            (`projet/outils/fabrique_de_modeles.gd`, textures compressées avec mipmaps, #3946), et
                            sous `licences/` l'avis de licence de chaque œuvre tierce embarquée (`avis.mjs`, #4063), que
                            `recette.mjs --web` joue au navigateur : un tour complet, l'atelier, ou les vues
                            nommées d'une scène (`--parcours cadrages`, `cadrages/`). `recette.mjs --natif` (#3945) joue
                            les mêmes parcours sans export ni navigateur : le jeu lancé sur une copie importée du projet,
                            sans rendu ou, pour un parcours qui lit l'image, en rendu réel sur un écran virtuel
                            (`--rendu`), piloté par `projet/recettes/pilote.gd`, son pont et son serveur dans le
                            processus de la recette (`pilotage/`). Le lot natif prépare le projet importé et le
                            bundle du pont une fois. Chaque jeu clone le projet, évalue son pont et garde ses
                            ports, son stockage et ses sorties. La file joue `combat`, `editeur` et `compendium`
                            (`npm run godot:recette`). Le canari joue le lot natif entier (`lot-de-recettes.mjs --natif`).
                            `--bureau --sortie <dossier>`
                            (`npm run godot:bureau`, #3951) produit l'exécutable de bureau de la plateforme, son noyau
                            embarqué (`noyau/` : Node, le bundle, le point d'entrée), ses modèles en scène et ses avis
                            de licence, Node compris, puis lui
                            fait jouer une partie ; le workflow `bureau.yml`, lancé à la main, le fait sous Linux et
                            sous Windows et en garde le dossier en artefact. Deux rendus dessinent les mêmes scènes : Forward+ hors d'une page,
                            le rendu de compatibilité dans la page ou en repli ; `--rendus` (`npm run godot:rendus`,
                            étape de la CI) joue en rendu réel, sous chacun des deux, les recettes déclarant
                            `const RECETTE_RENDUE := true`. `--coop` (`npm run godot:coop`, étape de la CI, #3009)
                            lance le relay local (`npm run relay:dev`) et joue la coop par deux processus Godot sans
                            écran, l'hôte et l'invité (`projet/recettes/coop-hote.gd`, `coop-invite.gd`).
  etalons/                  l'étalon de chaque planche (`<nom>.png`, sa capture) et `valides.json` (l'empreinte des
                            étalons validés). Une planche (un état de partie figé par le pont, que le jeu montre à
                            `?planche=<nom>`) est un dérivé de l'export, jamais commitée : `construire.mjs --export`
                            la dépose sous `<export>/planches/` (`planches.mjs`). `npm run godot:etalons` exporte le
                            jeu et refuse tout pixel d'écart entre une planche et son étalon, dans le seul Chromium
                            épinglé (`EPINGLE`, `planches.mjs`) sous Linux x86-64 ; le canari le joue (#3935,
                            `.claude/rules/ecrans-godot.md`).
src/scenes/                 Documents de scène + campaign.ts (campagne = l'Arène, `arene/arene-projet.json`,
                            projet {scenes, worldMap}, scènes listées par `build()` de `scripts/arene/generate.mjs`).
                            Ce GÉNÉRATEUR (cartes ASCII → JSON) est le propriétaire EXCLUSIF du paquet : le JSON
                            committé est l'octet de son `build()` (`src/scenes/generateurs-byte-stables.test.ts`),
                            une édition à l'éditeur est écrasée au prochain `generate`, ou refusée par cette garde.
                            L'Arène déroge ainsi à `user-doctrine-campagne-jamais-generee-par-script` : #1601.
                            + test-fixture.ts (fabrique de scène neutre `testScene()` + rencontre `enc-mutants` des tests de combat)
src/noyau/intentionsDeSiege.ts  Allowlist coop : la classe de chaque action du noyau (invité, hôte,
                            local), `GUEST_INTENTS` que `reseau.ts` enrobe chez l'invité, `refusChezLInvite`
                            que `Partie.envoyer` lit chez l'invité, et `appliquerLIntentionDUnSiege`, seul point
                            d'entrée d'une intention chez l'hôte.
src/noyau/monde/asciiMap.ts       AUTHORING de map en ASCII pour les scénarios de TEST et les GÉNÉRATEURS (un
                            paquet de campagne MANUSCRIT pose sa carte à l'éditeur, skill `creer-une-map`)
                            plutôt que poser les tuiles une à une. `parseAsciiRows(rows,
                            base, legend)` → {w,h,tiles} (1 char = 1 tuile) ; `parseWalledAscii` (box-drawing
                            (2W+1)×(2H+1) : tuiles + MURS d'arête, `:` = porte). Légende de base : `#`mur
                            `~`eau `D`porte `_`fosse `=`planches (surchargeable). Garde-fou : lignes de
                            largeurs inégales / char inconnu → throw. Entités/props/départ : poser des
                            MARQUEURS custom dans l'ASCII (ex. `@BFLr`), nettoyer avant le parse (`replace`)
                            puis scanner leurs positions.
src/hote/coop/              Coop en ligne, plateforme injectée : protocol.ts, session.ts, relay.ts (RelayClient
                            heartbeat/backoff, RoomHost = un Transport virtuel par siège, RoomGuest), salon.ts
                            (politique de session), page.ts (ports de la page : adresse du relay, `fetch`,
                            socket, stockage du jeton), compression.ts (CompressionStream, port `Compression`) ;
                            Le pont Godot compose le transport, la minuterie et la reprise.
                            L'attribution des sièges (héros, emplacement, rôle MJ) n'y vit pas : trois verbes
                            `hôte` du noyau (`src/noyau/reseau.ts`, `affecter…`) sur les fonctions pures
                            de `src/noyau/sieges.ts`
                            — codes de room 6 chars, reconnexion auto par token (grace 2 min)
                            Reprise du lien invité ou retour de l'hôte (host-up) : GuestSession.rejoin
                            relance le handshake, puis reçoit un snapshot autoritaire frais.
server/                     Worker Cloudflare du relay coop (Durable Object « Room », hibernation WS,
                            TTL 30 min) — npm run relay:dev / relay:deploy
art-ref/                    Illustrations extraites des PDFs + mapping.json (GITIGNORÉ — droits Cubicle 7)
```

## Mods Claude Code (#2278)

- **Chargement** : un mod vit sous `.claude/skills/<mod>/` avec `.claude-plugin/plugin.json` ; le
  moteur Claude Code le charge seul, pour chaque session et chaque worktree (voie skills-dir, sonde S1 :
  https://github.com/MyEdO/game/issues/2278#issuecomment-5983827521). Il n'a ni Node ni DOM : il voit le
  dépôt par `$.process.run(argv, init)` et rien d'autre.
- **Un mod REND, les scripts MESURENT.** La couture `hooks/ops.ts` est PURE : `appel(racinePlugin,
  script, args)` forme le tuple `[argv, init]` d'un script `scripts/ops/<script>.mjs` lancé avec
  `--json`, et `lire(resultat)` en valide la sortie. Un module de fonction lance le script par
  l'idiome UNIQUE `$.process.run(...appel($.plugin.root, …)`. Raison, `claude plugin validate` 2.1.289 :
  « $ is followed only into a function declared in this same file, never across an import ; $ is
  always spelled $.noun.event(...) at the call site » — la couture ne peut pas recevoir `$`. Le
  régime se lit par un LECTEUR `--json` en lecture seule ; l'outil du suivi s'obtient par
  `suivi.mjs --outil --json`, son schéma dérivé de la donnée (`scripts/ops/suiviDonnee.mjs`).
- **Mur** `murs/mod-sans-regle` (`VERROU_MOD` d'`oxlint.config.mjs`, joué par la garde `lint`, banc
  `scripts/mods/murDeMod.test.mjs` sur la config résolue) : son périmètre est l'`include` du tsconfig
  que pose le moteur (`hooks`, `types`, `tests` de chaque `.claude/skills/<x>/`, en `.ts`/`.mts`),
  hors bancs `*.test.ts` ; le reste de `.claude/` reste ignoré, et tout module hors `.ts` (`.js`, `.mjs`,
  `.cjs`, `.cts`, `.jsx`, `.tsx`, bancs compris) y est refusé.
  Un import relatif n'en sort pas (`claude-code`, `./x`, `../types` et `../hooks` restent permis).
  Hors couture, `$` n'a que ses places : objet d'un accès ni calculé ni optionnel à liste blanche
  (`ui.resolve`, `ui.log`, `ui.invalidate`, `ui.status`, `ui.toast`, `state.*`, `session.id`,
  `session.root`, `tool.register`, `clock.every`) ou de l'idiome, argument d'une
  fonction appelée par son nom,
  paramètre, `typeof $.x` en type. Il reste `$` dans la fonction qui le reçoit : `any` est refusé, et
  une liaison typée `EngineInterface` ou `typeof $` (paramètre, cast, alias, contrainte) se nomme `$`
  sans déstructuration ; le tsconfig posé par le moteur est `strict`, donc `tsc` refuse un paramètre
  sans type. Y sont refusés : un `appel` qui ne soit l'import de `./ops` ; le seuil (opérateur
  relationnel, arithmétique sur un non-littéral, `+` unaire ou entre deux non-littéraux, affectation
  composée, égalité ou `case` numérique, `Math`, `++`/`--`) ; le parsing (appel d'une méthode de
  découpe ou de recherche de chaîne, `parseInt`, `parseFloat`, `Number`, `RegExp`, littéral regex,
  `Date.parse`, `new Date(x)`, `new URL(x)`, `JSON.parse`) ; `ask` en clé ou en littéral ;
  `$.ui.invalidate` hors de `'ui.render'` (`RenderEventName`, types 2.1.289) ; `$.session.append`, l'écriture
  dans l'historique de la session, qui réécrit le cache de prompt au tour suivant (#2596). Dans la couture : aucun
  `$`, et les mêmes refus, sauf `JSON.parse`. Le mur NE GARDE PAS l'évasion délibérée (`'a' + 'sk'`,
  clé calculée, type dérivé de `On`) ; l'appelé IMPORTÉ qui reçoit `$` (le moteur le refuse, la garde
  `mods:check` le prouve par `claude plugin validate --strict`) ; un `../x` depuis un sous-dossier de
  `hooks/` ; ni les prédicats que seul le type du receveur distingue (`.every`, `.length === x`,
  `Object.is`, `t[0]`, la déstructuration d'une chaîne).
- **Garde** `mods:check` (`scripts/mods/verifier.mjs`, job `corpus`) : un mod sans banc
  `*.test.ts` est rouge ; sur une COPIE sans les artefacts du moteur (`.claude-plugin/types`,
  `tsconfig.json`), validation stricte, types posés par `claude -p` à la version exacte, `tsc`, bancs ;
  le CLI tourne sous un env en liste blanche (`ENV_HERITE`) et un HOME temporaire, lancé par l'hôte
  de processus (`scripts/guards/lib/spawnResilient.mjs`). Une racine de mod est du PRODUIT pour le
  classement du push (`classer`, `scripts/gates/classerPush.mjs`) ; les `lit` de `lint` et de
  `mods:check` couvrent `.claude/skills/`, elles ne sont jamais sautées.
- **knip** ne mesure pas les mods (`ignore` de `knip.json`, périmètre du mur) : projet à part, dont le
  module `claude-code` est fourni par le moteur, vérifié par la garde `mods:check`.
- **Version épinglée** : `VERSION_CLAUDE` de `scripts/mods/verifier.mjs`. L'API des mods est
  « EARLY ACCESS » : elle se monte avec Claude Code, à la main, garde rejouée.

## Coop en ligne — limitations connues (traçabilité #254)

Deux restrictions posées en 0cd24a01 (#232/#91) sans ticket au moment du commit — RESTENT en l'état
(lever = travail coop futur, hors #254 qui ferme sur DOCUMENTATION seule) :

- **Cadence COMMANDÉE désactivée hors mode local** — `src/noyau/voyageCadence.ts` (`cadenceAUnEffet`,
  source unique de « locale », lue par `traverseeCommandee`, source unique de « commandée ET locale ») garde la
  résolution d'un bloc du jour (`jouerLaJournee` commandée, dans `travelFlow.runTravelDays`,
  `riverVoyageFlow.resolveRiverDay` et, avec `seaDayAllRoutine`, dans `seaVoyageFlow.jouerLesEtapesDuJour`,
  commune aux deux entrées du jour `runSeaDay` et `continueSeaDayFromPostProgression`) ET la porte d'un jet sous ordres
  (`rollSeam.surfaceDesTenus`, via `resoluSousOrdres`). En coop, la cadence reste JOUR-PAR-JOUR quels que
  soient les ordres : chaque jet de route ouvre la fenêtre de son porteur. Raison technique : la résolution
  immédiate est un bloc synchrone HÔTE-SEUL qui ne passe par AUCUN owner/intent du registre de modales
  (`modalArbiter.ts`) — elle piloterait donc silencieusement les Tests de routine des postes tenus par des
  PERSONNAGES D'INVITÉS sans leur passer la main (contradiction avec le gating spectateur/ownership,
  `netOwnership.controlsActive`). Garde : `src/noyau/jets-sans-classe.hors-store.test.ts` (coop × commandée),
  `src/noyau/voyage-cadence.hors-store.test.ts` (jour sous ordres par route). Lever ⇒ router les Tests de routine par
  owner de poste comme le fait déjà le registre de modales pour les interruptions.
- **Conseil de bord (paie hebdomadaire + Moral, #229) hostOnly** — `CHOIX_DES_FENETRES.conseil`
  (`src/noyau/choixDesFenetres.ts`, `qui: 'hote'`) : décision de bourse PARTAGÉE (argent du groupe) → seul
  l'hôte la tranche, comme les autres actions à l'argent du groupe (achat/vente marchand…) ; le choix d'un
  invité se refuse à la frontière (`choix.refus.hoteSeul`). Lever ⇒ un vote ou une délégation de la paie.

## Systèmes clés (état actuel)

- **Schéma de Scène + Effets** (`data/schemas/defs-scenes/`) : `Effect` = setFlag, poserEtat/designerHeros (états de
  campagne du registre `narratif.etats`, formes `defs-scenes/formes-d-etat.ts`), journal, document, **giveTrapping**
  (donner un objet — `trappingId` = id du CATALOGUE → objet à stats ; `custom` = nom libre hors-base → objet
  `misc` ; il n'y a PLUS de `giveItem`/inventaire de groupe), giveMoney, giveXp, startCombat, **transition**
  (scène+entry), startDialogue, **test** (compétence + difficulté + `onSuccess`/`onFailure`),
  endDialogue. Tout est appliqué par `applyEffects` dans le store. Les sites de Condition et d'Effet d'un paquet
  s'énumèrent par UN module (`defs-scenes/sites-de-paquet.ts`), que lisent les références narratives et la
  garde « lu ⇒ produit » (`src/scenes/drapeau-lu-produit.test.ts`).
- **Moteur de campagne** : transitions de scènes (registre depuis `campaign`), tests de
  compétence interactifs (modal + branches), inventaire/argent/handouts (state party-level).
- **Inventaire et équipement.** `recomputeLoadout` compose les armes actives et les PA des objets et mutations du
  porteur. L’état de l’arme autonome d’un Trait et l’usure de son Armure appartiennent à l’instance du Trait.
  `armourPhysiqueAt` lit ses PA nets avec les autres PA physiques. La fiche se compose dans `src/noyau/ficheDuPorteur.ts`.
- **Rendu et éditeur**. Godot dessine les entités et le décor. Le noyau porte la géométrie du monde
  (`src/noyau/monde/volume/`). L’éditeur Godot joue les gestes de la session du noyau pour les
  scènes, cartes et narratifs.
- **Passifs unifiés + corruption data-driven** (réf. **`docs/systeme-passifs.md`**) : tout modificateur
  PASSIF continu (trait/mutation/qualité/trauma/maladie/faim/sort) = une liste de `GameOp` lue par UN
  collecteur `passiveMods(c)` (`engine/trauma.ts`), emballée en `PassiveMod{op, kind}` — le `kind` porte
  l'annulation ; la combinaison suit la SOURCE (`intrinsèque` = Σ dans la base ; États = pool LDB 16 l.13 ;
  Sorts = pool LDB 46 l.119 ; même Prière = pool LDB 40 l.19 ; le reste = Σ, LDB 14 l.95). `charMod` =
  SEUL op de modif de carac (passif ET sort) ; `moveMod` pour le Mouvement (≠ carac : `M` ∉ `CharKey`).
  Traits de profil appliqués `spawn→live` (`Combatant.liveTraits` + `baseWithTraits`, sans double-compte
  du profil bestiaire imprimé FINAL). **Édité en DONNÉES au Codex** : `TraitData`/`QualityData`/`Mutation`
  ont `passive: GameOp[]`, édités dans le Compendium Godot. **Mutation découplée de sa table** : `mutations.json` (entités) ⊥
  `mutationTables.json` (plages d100 → réf mutation) → plusieurs tables (une par dieu du Chaos, Compagnon T1)
  sans collision.

## Rigueur compilateur (tsconfig.json / server/tsconfig.json)

- `strict: true` (racine + serveur) + `noUnusedLocals`/`noUnusedParameters: true` (les deux
  configs) — le code mort ne compile plus en silence (#300 cran 1).
- `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` restent **désactivés** — verdict
  mesuré #300 cran 2 (2026-07-11) : essai en ligne de commande (`tsc --noUncheckedIndexedAccess`
  / `--exactOptionalPropertyTypes`, hors config commitée) sur la racine → **3732** et **960**
  erreurs respectivement, réparties dans QUASIMENT tous les dossiers au prorata de leur taille
  (`state` 2094, `gameIso` 697, `src/engine` 441, `ui` 270, `src/scenes` 142 pour le
  premier flag) — aucun dossier propre à cliqueter isolément. Activation = chantier dédié
  multi-session (refonte des accès indexés / des types optionnels site par site), pas une purge
  mécanique comme le cran 1. Différé, pas écarté.
- **Second projet tsc : les mods** (`.claude/skills/<mod>/`). Leur `tsconfig.json` n'est pas commité :
  le moteur le pose avec ses types (`claude -p --plugin-dir`), et il active `noUncheckedIndexedAccess`
  que la racine désactive. `mods:check` le joue sur une copie (`scripts/mods/verifier.mjs`).

## Direction visuelle & apparence

Le noyau fournit la géométrie du monde (`src/noyau/monde/volume/`). Le projet Godot compose la scène
et résout les ressources visuelles par identifiant. Un même monde sert les vues du jeu. Les maquettes
validées et les étalons d’écran guident le rendu. Voir `.claude/rules/ecrans-godot.md` et
`.claude/rules/rendus-godot.md`.
