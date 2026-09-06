<!-- GENERATED: agents:sync; source=CLAUDE.md -->
# AGENTS.md — RPG Warhammer Fantasy v4 (web)

Guide pour Codex sur ce dépôt. Le **credo de travail**
(`.codex/credo.md`, injecté à chaque session par hook) prime sur tout réflexe : zéro dette,
réutiliser l'existant, data-driven, ne rien croire sans vérifier le RAW.

## Ce qu'est ce projet

Un **jeu de rôle vidéoludique 100 % web, en français**, type *Neverwinter Nights / Baldur's
Gate* (tactique tour par tour, vue isométrique), basé sur **Warhammer Fantasy Roleplay 4e**.
On contrôle un groupe de 4 aventuriers à travers la campagne **L'Ennemi Intérieur**.

> ⚠️ **Ce dossier `Foundry/Game` EST un vrai projet logiciel** (dépôt GitHub `cgauche/game`).
> Le `Foundry/AGENTS.md` parent (« ceci n'est pas un projet logiciel, ne pas committer »)
> **ne s'applique PAS ici**. Ici : commits + push attendus (remote `origin` = cgauche/game).
> Branche de travail : `main` (trunk-based — le tronc reçoit tout ; une branche ne se crée que
> pour du travail risqué et isolable, et fusionne le JOUR MÊME en fast-forward).

> **Mémoire persistante committée** : `.claude/memory/` (index `MEMORY.md` + fiches). En session
> LOCALE le harness l'injecte déjà (junction depuis `~/.codex/projects/…/memory`) — ne pas la
> relire. En **session cloud** (Codex cloud), rien n'est injecté : LIRE `.claude/memory/MEMORY.md`
> en début de session et suivre ses liens au besoin ; les écritures mémoire faites en cloud ne
> persistent pas (VM jetable) — toute leçon durable apprise en cloud se consigne dans une fiche
> committée. Les fiches se committent comme du code ; jamais de git destructif dessus (c'est la
> mémoire vivante de la session locale).

## Table de routage — lire le bon doc AU MOMENT du déclencheur

| Déclencheur | Lire |
|---|---|
| Chercher où vit un module / comprendre un système / AVANT de créer un fichier sous `src/` | `docs/architecture.md` + table « Primitives partagées » ci-dessous |
| Quels systèmes existent / qui compose quoi (matrice primitives × systèmes GÉNÉRÉE) | `docs/systemes.md` (`npm run docs:systemes`, sources `src/data/systemes.manifest.json` + `src/data/primitives.manifest.json`) |
| **« Est-ce que le moteur sait faire X ? »** — chercher une op / une Condition / un déclencheur AVANT de conclure à un manque et de figer une donnée en « narratif » | `docs/vocabulaire-mecanique.md` (GÉNÉRÉ, `npm run docs:vocabulaire` — `GameOp` + `Condition`/`Flow`/`EffectTrigger`, index par concept FR, résolution & usages mesurés) |
| **« Existe-t-il une couture qui fait X ? »** — chercher où vit la fonction qui fait X (nom anglais inconnu), ce qui lit/produit Y, AVANT de conclure à une absence | `docs/index-moteur.md` (GÉNÉRÉ, `npm run docs:index-moteur` — les exports publics de `src/engine`, `fichier:ligne` + JSDoc, index par concept FR) |
| **« Par où passe CE jet ? »** — chercher la porte d'un Test, ou vérifier si un site de jet est déjà inventorié, AVANT d'en ouvrir un nouveau à la main | `docs/registre-jets.md` (GÉNÉRÉ, `npm run docs:registre-jets` — familles canoniques d'ouverture, stock des pendings fabriqués au call-site, stock des roulages délégués au moteur, population authorée) |
| **« Comment chacun UTILISE le système de jet ? »** — voir quelles zones de la coquille un consommateur remplit, ou quels consommateurs porteraient une évolution du contrat d'affichage, AVANT d'ajouter une prop ou une Nᵉ modale | `docs/usages-jets.md` (GÉNÉRÉ, `npm run docs:usages-jets` — matrice consommateur × zones de `RollShell`/`RollRowProps`, particularités mécaniques déduites, angles morts du scan) |
| Question RAW (« que dit la règle ? ») | Atlas `docs/raw/00-index.md`, puis `Source/` pour **citer** |
| Détail d'un livre source (chapitres LDB, périmètres autorisés, historique d'extraction) | `docs/sources-vf.md` |
| Valider une feature UI dans le navigateur (`__wfrp`, scénarios de test) | `docs/recette-navigateur.md` + `docs/test-scenarios.md` |
| Toucher un passif / la corruption | `docs/systeme-passifs.md` (GÉNÉRÉ, `npm run docs:passifs`) |
| Toucher les triggers / événements de combat | `docs/combat-events-coherence.md` |
| Ajouter une créature (rig) | `docs/creer-une-creature.md` |
| Ajouter/curer une donnée dans `src/data/*.json` (hors sort/créature/effet/icône) | `docs/donnees.md` (carte + conventions, GÉNÉRÉ) + `docs/ajouter-une-donnee.md` (déroulé, GÉNÉRÉ, `npm run docs:ajouter-donnee`) + skill `ajouter-une-donnee` |
| Authoring de map | `docs/map-authoring.md` (GÉNÉRÉ, `npm run docs:map-authoring`) |
| Créer/modifier une campagne (projet multi-scènes + carte du monde) | `docs/campagne-authoring.md` + skill `creer-une-campagne` |
| Créer ou retoucher un écran UI (CSS, densité, responsive) | `docs/charte-ui.md` + règle stricte 4 |
| Ajouter un flux de jet différé (une situation = une modale — Piétinement, Course, Focalisation, Soin, Marchandage…) | `docs/ajouter-un-flux-de-jet.md` (GÉNÉRÉ, `npm run docs:flux-de-jet`) |
| Intégrer un nouveau livre source VF au projet (pipeline complet) | `docs/ajouter-un-livre-source.md` |
| Ajouter ou curer un sort / une Prière / une Bénédiction / un Miracle / un Rituel | `docs/ajouter-un-sort.md` (GÉNÉRÉ, `npm run docs:sort`) |
| Ajouter une icône (ou remplacer un emoji par une affordance UI) | `docs/ajouter-une-icone.md` (GÉNÉRÉ, `npm run docs:icones`) |
| Ajouter une mécanique à une entité (trait, talent, qualité, mutation, maladie, atout…) | `docs/ajouter-une-mecanique.md` (GÉNÉRÉ, `npm run docs:mecanique`) |
| Toucher le rendu du monde (pivot `SceneEl`, builders, peintres, ambiance, matériaux) | `docs/rendu-pipeline.md` (GÉNÉRÉ, `npm run docs:rendu-pipeline`) |
| Le Codex doit-il exposer une nouvelle relation inverse / un nouvel index / un auto-liage ? | `docs/codex-relations.md` (GÉNÉRÉ, `npm run docs:codex-relations`) |
| Quel code lit ce champ JSON, avant de le renommer ou de le supprimer ? | `docs/consommateurs-de-champs.md` (GÉNÉRÉ, `npm run docs:field-consumers`) |
| **« Quelle forme a ce concept dans chaque dataset ? »** — comparer la structure d'une référence / d'une valeur / d'une enveloppe entre documents, AVANT de poser une Nᵉ graphie ou de croire une forme unique | `docs/structures-donnees.md` (GÉNÉRÉ, `npm run docs:structures` — observé × déclaré sur les 2 racines `src/data` + `src/scenes`, lexique fermé `scripts/docs/lib/structures-lexique.mts`, stock décroissant `scripts/guards/lib/structuresStock.mjs`) |
| Une entrée de `src/data/*.json` est-elle orpheline (jamais référencée) ? | `docs/orphelines-donnees.md` (GÉNÉRÉ, `npm run docs:orphelines`) |
| **Une race/carrière/table est ABSENTE à l'écran — est-elle gatée par une règle optionnelle ?** — AVANT de rapporter un manque | `docs/regles-optionnelles.md` (GÉNÉRÉ, `npm run docs:regles-optionnelles` — le registre complet, le défaut de chaque règle, et ce qu'elle change) |
| Un sprite/rig est-il reconnaissable au premier coup d'œil (QC) ? | `docs/qc-reconnaissabilite-sprites.md` |
| Reprendre un chantier après une pause (nouvelle machine, clone frais) | `docs/reprise-apres-pause.md` (GÉNÉRÉ, `npm run docs:reprise`) |
| Quel est l'état RÉEL d'implémentation des sorts/miracles (écart catalogue vs code) ? | `docs/sorts-implementation.md` (GÉNÉRÉ, `npx tsx scripts/gen-sorts-doc.mts`) |

> **Politique `docs/`** : ce dossier ne contient que des **références vivantes**, maintenues au fil
> du code. Les plans de refonte / sorties de brainstorming sont des artefacts **DATÉS** : ils vont
> dans `docs/plans/`, portent leur date en tête, et sont **supprimés une fois exécutés** (git porte
> l'historique). Un plan périmé qui traîne à la racine de `docs/` est du poison : ne JAMAIS s'appuyer
> sur un doc de plan pour décider de l'architecture actuelle — le code et les références vivantes font foi.
> Garde `npm run docs:check` (`scripts/docs/check-doc-refs.mjs`) : chaque chemin `src/…`/`scripts/…` et
> chaque symbole backtiqué cités par `docs/*.md` (hors `docs/plans/` et `docs/raw/`) doivent exister —
> exit 1 avec la liste `fichier:ligne` sinon. Une référence vivante qui ment ne se tague pas, elle se corrige.
> **Fusion des docs DÉRIVÉS** (`.gitattributes`, trois familles) : `merge=docs-generes` pour les docs
> 100 % générés, `merge=docs-catalogue` pour `docs/raw/catalogue-*.md` (dérivés sauf leurs blocs
> `<!-- X-INTEGRATION -->`, correctifs manuels), `merge=docs-fiche-raw` pour les fiches `docs/raw/*.md`
> mixtes (prose manuscrite + champ `**Implémente :**` dérivé). Pilote `scripts/git-hooks/merge-docs.mjs`
> (déclaré par `npm run postinstall`) : famille générée = version courante retenue ; fiche = fusion
> 3-voies de la PROSE seule, chaque champ étant réinjecté PAR IDENTITÉ (heading porteur), donc une
> section ajoutée par l'entrant garde SON champ ; un conflit restant est un vrai conflit humain.
> Après toute fusion / tout rebase : `npm run docs:build` (`scripts/docs/build-all.mjs`) régénère et
> nomme ce qui a bougé — les hooks `post-merge`/`post-rewrite` le lancent, le commit reste à toi.

## Règles strictes (NE PAS déroger)

1. **Aucune invention de règles.** Toute règle/valeur vient des livres autorisés (§ Sources VF).
   Ne pas utiliser tes connaissances WFRP. **Point d'entrée = l'Atlas RAW [`docs/raw/`](docs/raw/00-index.md)** :
   22 fiches de règles par domaine + 6 catalogues de données mécaniques, consolidant les 15 livres
   (couverture **⬜1** — `LDB 81` « Vouivre », fragment de bestiaire sans crédit catalogue (#1279 S4-a) ;
   gardes rejouables `node scripts/raw/coverage.mjs` & `node scripts/raw/reconcile.mjs`).
   **Y chercher d'abord** « est-ce RAW / que dit le RAW ». `Source/` reste la vérité
   **citable** (`LDB <chap> l.<ligne>`) et le recours ultime — **devoir rouvrir `Source/` = un défaut
   de l'Atlas à corriger** (amender la fiche/le catalogue, puis re-vérifier avec les deux gardes).
   ⚠ Les champs **`Implémente`** des fiches sont **GÉNÉRÉS** (`npm run raw:implemente`, #487/#434) —
   jamais édités à la main ; un commit qui ajoute/déplace des réfs RAW (code, commentaires, `source:{book,page}`
   de données) régénère les fiches dans le MÊME commit (`docs:check` le gate en CI et au pre-commit).
   Dette/blocage d'un topic = entrée `src/data/raw.manifest.json` (topic non implémenté sans entrée = CI rouge).
2. **Tout le contenu de campagne est éditable** dans l'éditeur (schéma de Scène unique).
   Pas de scène codée « en dur ».
3. **Le moteur de règles (`src/engine`) reste pur et testé.** Le store, l'UI et le rendu en
   dépendent, jamais l'inverse.
4. **UI en français**, et qui **scale** : dès qu'un panneau dépasse ~2 sections → onglets.
   **Tout nouvel écran est responsive dès sa création** (utilisable à 360px) : composer les
   primitives globales de `styles.css` — `.layout-sidebar` (colonne latérale, s'empile ≤900px),
   `.panel-grid` (1 colonne ≤700px), `.bar` (s'enroule ≤700px), cibles tactiles via
   `pointer: coarse`. Breakpoints canon : 900 / 700 / 560 px.
5. **Aucune retranscription des textes sources dans les `.json`.** Une description (`desc`, et tout
   champ de prose : effet, règles…) est un **copié/collé verbatim** de la source — JAMAIS une
   reformulation, un résumé ou une paraphrase. Le formatage est **conservé en Markdown** (la source
   est en Markdown → on recolle tel quel : `**gras**`, `*ital*`, listes `-`, sauts `\n\n`), **jamais
   en HTML**. Corollaire de la règle 1 : le texte affiché doit pouvoir être recollé tel quel dans
   `Source/`. Rendu par l'unique primitive `<Prose>` (`src/ui/Prose.tsx`, `react-markdown`, HTML brut
   neutralisé + auto-liage des règles) ; garde-fou `src/data/no-html-in-prose.test.ts`.
6. **Les commentaires ne font pas autorité — et trois familles sont interdites.**
   (a) La *paraphrase de règle* (version « allégée » du RAW) : un commentaire porte la réf nue
   (`LDB 13 l.142`), la règle vit dans l'Atlas/Source ; toute paraphrase rencontrée = poison
   présumé, à vérifier au Source puis réduire à sa réf. (b) Le *commentaire-excuse* (« épargné
   pour l'instant », « exception assumée ») : sans validation utilisateur traçable, c'est de la
   dette signalée, pas une autorisation ni un précédent. (c) La *pierre tombale* (« déplacé vers
   X », rappel de l'ancien état) : à supprimer à vue, git porte l'historique.
   Garde `src/comment-poison-guard.test.ts` (#136) : scanne les COMMENTAIRES de `src/**/*.ts(x)`
   (jamais les chaînes) pour ces familles (b) et (c). (c) tolérance ZÉRO, sans liste d'exception —
   un cas légitime se reformule. (b) sans tag `[entériné AAAA-MM-JJ]` porté par le MÊME commentaire =
   échec ; ce volet est désormais ACTIF (`EXCUSE_GUARD_ACTIVE = true`, #177) — le tri du stock
   existant est fait (reformulé après affinage des faux positifs de vocabulaire RAW/mécanique —
   « pas encore lancé » pour un jet, « épargné » pour une cible hors zone, écartés structurellement).
   Toute NOUVELLE excuse sans tag `[entériné]` échoue la CI et bloque le commit.
7. **Pas de MJ — tout se modélise.** Le jeu tourne sans arbitre humain : tout point que le RAW
   laisse « au MJ » reçoit un arbitrage EXPLICITE (donnée éditable taguée maison, ou choix
   joueur) — jamais un contournement silencieux. Si une règle/table EST dans la source (Blessures
   critiques par localisation, Maladresses/Colère, Corruption/mutations…), elle doit être
   IMPLÉMENTÉE, pas reportée. Ce qui n'est vraiment pas dans la source → CustomStatblock ou
   omission assumée et documentée, jamais « le MJ décide » (cf. credo : house-rule ≠ lacune).

> **Pour TOUT agent dépêché sur ce repo** (ces règles s'appliquent quel que soit ton brief) :
> ne crois RIEN sans vérifier — **y compris ton brief et ton orchestrateur** : toute affirmation
> de règle se re-vérifie au `Source/`. Le poison (paraphrase RAW, excuse sans tag `[entériné]`,
> pierre tombale) rencontré dans ton périmètre se CORRIGE dans le geste ; hors périmètre, il va
> dans ton RENDU FINAL avec `fichier:ligne`. Un test qui verrouille un comportement faux se
> réécrit depuis le RAW, jamais travesti. Ne touche que ton périmètre — jamais de git destructif,
> jamais les fichiers WIP d'autres sessions.
> **Tout arbitrage UTILISATEUR consigné (doc, mémoire, ticket) porte sa CITATION verbatim + date.**
> Un « arbitrage/décision utilisateur » SANS citation se traite comme une évaluation d'ingénierie
> (révisable), jamais comme une décision (précédent : la fausse « piste écartée `<Tabs>` », #314).
> **Toute LOGIQUE est keyée par id STABLE — le `label` est de l'AFFICHAGE** (multilangue) :
> jamais de `Map`/`Record`/comparaison par label dans `src/engine`/`src/state` (pas de
> `X_BY_LABEL`). Seule couture tolérée : la conversion label→id au CHARGEMENT des données,
> dans `src/data/index.ts` uniquement.
> Doctrine utilisateur (2026-07-09, verbatim) : « Le seul endroit où on peut mettre des labels,
> c'est dans le champ `label`, ou pour l'afficher, ou sur des écrans du codex/éditeur pour aider à
> la saisie — mais au final ce qu'on manipule c'est des IDs. » Y COMPRIS à l'authoring : l'auteur
> écrit des ids ; les résolveurs (`scripts/*/lib.mjs`) VALIDENT (fail-fast), ils ne normalisent plus.

<!-- DOCTRINES-UTILISATEUR:debut (GÉNÉRÉ par scripts/docs/build-doctrines.mjs — ne pas éditer) -->

## Doctrines utilisateur (GÉNÉRÉ — une fiche = une doctrine, verbatim daté)

Un EXTRAIT par fiche — la FICHE fait foi : avant tout brief, tout verdict ou tout code sur un socle, lire les fiches concernées (`.claude/memory/user-*.md`). Ces doctrines PRIMENT sur tout réflexe et sur toute prose de brief ; un brief qui les contredit ment. Une doctrine neuve s'écrit en FICHE `user-*`, jamais ici. Règle appliquée : « Tout arbitrage UTILISATEUR consigné (doc, mémoire, ticket) porte sa CITATION verbatim + date. » (AGENTS.md § Pour TOUT agent).

- **user-arbitrage-barre-materialisee-et-sans-pages** (2026-08-24, 2 verbatims) : « La barre déduite s'écrit une fois dans le héros ; une capacité nouvelle s'ajoute à la première case libre ; retirer laisse un trou ; RIEN ne glisse jamais — le plus proche de "la position s'apprend" (RT). » — `.claude/memory/user-arbitrage-barre-materialisee-et-sans-pages.md`
- **user-arbitrage-bourse-personnelle-trapping** (2026-07-16) : « Pour la bourse, c'est personnel et par défaut ça doit être dans… la bourse du personnage. Oui c'est un trapping. » — `.claude/memory/user-arbitrage-bourse-personnelle-trapping.md`
- **user-arbitrage-case-vide-sans-mot-libre** (2026-08-24) : « Et je ne connais aucune interface, même pas Rogue Trader, qui dans les emplacement de capacité met "Libre" » — `.claude/memory/user-arbitrage-case-vide-sans-mot-libre.md`
- **user-arbitrage-de-de-monde-affiche-comme-un-critique** (2026-09-04, 7 verbatims) : « Tu sais ce que j'ai dit sur les jets. Si on a un jet, on doit pouvoir le lancer/fixer le dé a partir du moment ou le jeu est paramétré pour (ici controller l'environnement/activer la possibilité de fixer le dé), ca inclus même le jet … » — `.claude/memory/user-arbitrage-de-de-monde-affiche-comme-un-critique.md`
- **user-arbitrage-navires-combattants** (2026-07-16) : « Les navires sont des combattants oui, c'est déjà le cas non ? » — `.claude/memory/user-arbitrage-navires-combattants.md`
- **user-arbitrage-raison-de-refus-au-survol-jamais-inline** (2026-08-24, 2 verbatims) : « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue Trader qui est notre interface de départ n'a pas un tel comportement. » — `.claude/memory/user-arbitrage-raison-de-refus-au-survol-jamais-inline.md`
- **user-arbitrage-round0-forme-rt-et-splash-conserve** (2026-08-24, 2 verbatims) : « Ca c'est le round 0 de Rogue Trader. On a peut etre pas le "Combat !", car RT aime mettre des "cinématiques" pour présenter ses combats, mais non on a pas ca donc c'est "Combat !". » — `.claude/memory/user-arbitrage-round0-forme-rt-et-splash-conserve.md`
- **user-arbitrage-saves-reset-pas-migration** (2026-08-17) : « **L'application n'est pas en prod, si tu perds du temps a faire ces migrations, je prefere que tu supprimer les données plutot que tu les migre** » — `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`
- **user-arbitrage-stations-a-bord-deux-rosters-empiles** (2026-09-05, 7 verbatims) : « J'ai du mal a comprendre. Le role de marche comme les postes et les activités, que ce soit terrestres, fluvial, maritime, tout ca c'est le même système non ? Pourquoi ca ne marche pas pareil ? » — `.claude/memory/user-arbitrage-stations-a-bord-deux-rosters-empiles.md`
- **user-arbitrage-survol-rt-strict-refus-au-clic** (2026-08-24, 3 verbatims) : « c'est mettre sa souris sur des cases non higtlighté ou sur des ennemies, ca te met un message genre "Charger marchin", c'est quoi ce délire ? Y'a des jeux qui font ca ? » — `.claude/memory/user-arbitrage-survol-rt-strict-refus-au-clic.md`
- **user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier** (2026-08-24, 3 verbatims) : « Quand l'adversaire joue, la console basse se transforme : le portrait du fronton laisse place à un médaillon rond contenant l'icône de l'arme ennemie, les PV passent en rouge, la grille carrée de capacités devient une rangée de médaillons … » — `.claude/memory/user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier.md`
- **user-arbitrage-vocabulaire-campagne** (2026-07-16, 2 verbatims) : « Le joueur n'a aucun contrôle dessus ni de valeur maison » — `.claude/memory/user-arbitrage-vocabulaire-campagne.md`
- **user-arbitrages-2026-09-04-echelle-ia-structures** (2026-09-04, 6 verbatims) : « Drole de recommandé. On peut mettre des actions sur le décors non ? Tu sais quoi, quand tu te pose ce genre de question, regarde l'état de l'art avant » — `.claude/memory/user-arbitrages-2026-09-04-echelle-ia-structures.md`
- **user-arbitrages-2026-09-05-materiaux-1686** (2026-09-05, 8 verbatims) : « Malgres mes choix, ne pas oublier que rien ne doit etre en dure, tout doit etre éditable. » — `.claude/memory/user-arbitrages-2026-09-05-materiaux-1686.md`
- **user-art-delegue-autre-session** (2026-08-04) : « Je demanderais a un autre agent de faire tout ce qui est lié a l'art, donc ne les touches pas » — `.claude/memory/user-art-delegue-autre-session.md`
- **user-barre-art-relevee-2026-07-16** (2026-07-16, 5 verbatims) : « il faudra le faire aussi sur les 88 anciennes pour que le jeu soit cohérent. C'est la vague massive que ton gel budget du 2026-07-12 interdit » — `.claude/memory/user-barre-art-relevee-2026-07-16.md`
- **user-contrainte-cout-rigs-2026-07-12** (2026-07-12) : « Malheureusement je ne pourrais plus lancer de rigs, ca coute maintenant trop chere. » — `.claude/memory/user-contrainte-cout-rigs-2026-07-12.md`
- **user-direction-art-epure-echelle-jeu** (2026-08-06) : « Franchement c'était mieux avant. Juste ces plaques moches qui n'existaient pas avant notre refonte la ... pourquoi on se les traine ? » — `.claude/memory/user-direction-art-epure-echelle-jeu.md`
- **user-direction-fusion-json-par-type** (2026-09-01) : « Si a terme on peu fusionner des .json et juste rajouter un "type" pour des systèmes similaires » — `.claude/memory/user-direction-fusion-json-par-type.md`
- **user-doctrine-adaptation-livre-vers-jeu-regime-propre** (2026-09-01, 3 verbatims) : « on a pas commencer reellement EDO, ces décisions viendront quand on aura deja plus avancé » — `.claude/memory/user-doctrine-adaptation-livre-vers-jeu-regime-propre.md`
- **user-doctrine-campagne-jamais-generee-par-script** (2026-08-31, 2 verbatims) : « la diligence a été créé principalement pour s'assurer que le moteur sache construire ce batiment. » — `.claude/memory/user-doctrine-campagne-jamais-generee-par-script.md`
- **user-doctrine-etat-de-lart-avant-invention** (2026-08-16) : « Nouveau moteur, on peut se poser maintenant les vrais questions. Ce n'est pas le premier moteur 3D jamais créé avec ce type de vue, ces questions ont deja leurs solutions non ? » — `.claude/memory/user-doctrine-etat-de-lart-avant-invention.md`
- **user-doctrine-forme-canonique-unique-jets** (2026-08-20, 8 verbatims) : « On migre tout vers une forme canonique, genre si demain on change le fonctionnement des jets, ses calcules, les affichages ou que sais je, je n'ai qu'un seul et unique endroit a modifier » — `.claude/memory/user-doctrine-forme-canonique-unique-jets.md`
- **user-doctrine-gardes-schema-unique-manifeste** (2026-08-23, 4 verbatims) : « C'est un besoin global de s'assurer que tous ces éléments soient documentés et suivant un schéma unique. Triste qu'il soit possible de faire un peu n'importe quoi aujourd'hui » — `.claude/memory/user-doctrine-gardes-schema-unique-manifeste.md`
- **user-doctrine-nouveau-moteur-liberer-le-produit** (2026-08-10, 7 verbatims) : « De toute facon pas mal d'élément de l'existant ne me vont pas, et le nouveau moteur va surement permettre de faire tout en mieux, sans avoir les limitant qui ont poussé a faire les choses différament » — `.claude/memory/user-doctrine-nouveau-moteur-liberer-le-produit.md`
- **user-doctrine-reference-rt-par-defaut-deviation-validee** (2026-08-24) : « Franchement, on part d'une interface de Rogue Trader, on fait un jeu vidéo RPG, pourquoi on réinvente des trucs qui n'existent même pas dans notre interface cible ni dans aucun jeux video du genre ? » — `.claude/memory/user-doctrine-reference-rt-par-defaut-deviation-validee.md`
- **user-doctrine-ui-coherente-par-primitives-comme-les-donnees** (2026-09-04, 6 verbatims) : « N'oublie pas les concepts lié a l'UI et les primitives. Le but est toujours d'avoir une interface cohérente dans toute l'application, comme on fait avec notre structure de donnée. » — `.claude/memory/user-doctrine-ui-coherente-par-primitives-comme-les-donnees.md`
- **user-doctrine-un-hote-jamais-duplique** (2026-07-29, 4 verbatims) : « Le concept de "conséquence" m'a toujours échappé et n'a aucun sens. Un jour j'ai parlé de "conséquence", et depuis c'est devenu un mot qui justifie un design qui n'aurait jamais du naitre. » — `.claude/memory/user-doctrine-un-hote-jamais-duplique.md`
- **user-doctrine-verrou-par-construction** (2026-08-10, 3 verbatims) : « Tout ca car tu ne veux pas régler le vrai problème, que je tente de régler depuis 1 mois, a savoir que chacun fait ce qu'il veut. » — `.claude/memory/user-doctrine-verrou-par-construction.md`
- **user-mandat-chef-de-produit** (2026-07-09, 5 verbatims) : « On est parti d'un attendu vs réalité — ce n'est pas 2-3 mineurs, c'est des systèmes entiers à modifier/améliorer/refacto/refaire. Aujourd'hui les combats navals, demain le voyage terrestre/fluvial/siège/combat de masse. » — `.claude/memory/user-mandat-chef-de-produit.md`
- **user-ressource-licence-chatgpt** (2026-08-31, 2 verbatims) : « Je n'ai pas autant de ressource pour faire une review ou reprendre le travail » — `.claude/memory/user-ressource-licence-chatgpt.md`

<!-- DOCTRINES-UTILISATEUR:fin -->

## Sources VF — l'essentiel

Tout est en **français** sous `Source/`, dossiers préfixés `Warhammer v4 - …` / `WH - V4 - …`.
Les dossiers SANS ce préfixe (Enemy Within…, Altdorf…) sont la **VO** du dépôt parent MJ —
**ne jamais les lire/citer ici**. Atlas `docs/raw/` = couche de lecture ; `Source/` = vérité
citable. ⚠ Ré-extraction Marker 2026-06-22 : le **chapitre** des réfs `l.<ligne>` reste juste,
la **ligne** a dérivé.

Livres de RÈGLES autorisés (chemins exacts, périmètres, chapitres clés : **`docs/sources-vf.md`**) :
**LDB** (livre de base) · **ADE I/II** (Archives de l'Empire) · **EDO/EDOC** (T1 + Compagnon) ·
**Middenheim** · **AA** (Aux Armes) · **ZI** (Zoo Impérial) · **MDG** (Mer des Griffes) ·
**ACE** (Altdorf, Annexe I) · **T2C** (Compagnon T2, navigation fluviale/personnalisation/maladies d'eau) ·
**NADJ** (gnomes, jeux de taverne) · **VDM** (Les Vents de Magie : incantation révisée, sorts par domaine,
carrières de sorcier, artefacts, élémentaires/familiers) — chacun pour son périmètre. **Arbitrage 2026-07-10 : tout livre FR de
`Source/` peut fournir des règles** (même ~90 % scénario, il en porte souvent quelques-unes) — le périmètre
s'établit par PASSAGE, documenté dans `docs/sources-vf.md`, au MÊME standard : verbatim citable, réf
chap/ligne, extraction FR présente (sans extraction, pas de mécanique). `src/data/*.json` est la **SOURCE
app-owned** (commitée, éditable au Compendium), curée à la main, chaque entrée taguée à sa `source`.

## Pile technique

- **Vite + TypeScript + React** (UI). **Monde rendu en volumique three.js** (seul backend, `backends/webgl/`) ; grille, murs au trait, pions-disques et chrome sont des surcouches SVG React posées sur son canevas.
- **Zustand** (store global). **Vitest** (tests du moteur). Le RNG est **seedable**
  (`makeRNG`) pour des tests déterministes et une future coop réseau.

## Commandes

```bash
npm install           # pose les hooks git (core.hooksPath) et les pilotes de fusion des docs dérivés. La FERMETURE d'un ticket suit la PUBLICATION, jamais le commit : le job `fermetures` de .github/workflows/ci.yml joue `node scripts/ops/fermer-depuis-main.mjs <before>..<sha>` après un `build` vert sur `main` — il poste le solde emporté par le commit et ferme l'issue ; en local, `npm run ops:fermer -- <plage>` fait le même geste à la main
npm run dev          # serveur de dev — http://localhost:5173 sur l'ARBRE PRINCIPAL, port dérivé strict en worktree lié (`scripts/port-dev.mjs`, imprimé au lancement) ; src/data/*.json est la SOURCE app-owned (commitée)
npm test             # tests Vitest du moteur
npm run typecheck    # tsc --noEmit
npm run typecheck:fast # typecheck INCRÉMENTAL (~7-10 s), sortie complète dans node_modules/.cache/typecheck-last.txt — la porte de vérité des gates reste `npm run typecheck` (full)
npm run gates        # joue les gates de ci.yml manquantes pour le contenu de HEAD et écrit leurs justificatifs — régime : commit FINAL → gates → push (le pre-push refuse sans justificatif vert sur le contenu poussé). une phase SÉRIE (`AVANT_LES_LANES` : les trois gates qui écrivent dans l'arbre) puis TROIS LANES parallèles (suite · types · docs, table `LANES` de scripts/gates/toutes.mjs : les lanes ne portent que des LECTEURS, et la table `ECRIT_LU` dit de chaque gate ce qu'elle écrit et lit) ; la suite y est bornée par `WFRP_TEST_COEURS` ; série mesurée AVANT T1d = 1020,8 s. Résumé dans l'ordre de ci.yml, une sortie par gate sous node_modules/.cache/gates/
npm run gates -- --serie   # les mêmes gates en UNE lane, dans l'ordre de ci.yml (diagnostic — même verdict, coût plein) ; `--tout` rejoue même ce qui est justifié, `--liste` n'imprime que le plan
npm run galleries              # (re)génère toutes les galeries QC -> public/galeries.html (hub)
# package-lock.json : régénérer TOUJOURS avec npm 10 (`npx --yes npm@10.9.3 install --package-lock-only`) — npm 11 ampute les hoistées @emnapi/*, garde pre-commit #528

# Coop en ligne (relay WebSocket — Worker Cloudflare, dossier server/)
npm run relay:dev      # Worker relay en local (wrangler dev, port 8787) ; côté client : VITE_RELAY_URL=http://localhost:8787 npm run dev
npm run relay:deploy   # déploie le Worker (compte Cloudflare) → URL dans RELAY_URL_PROD (src/net/relay.ts)

# Déploiement en PRODUCTION (GitHub Pages → https://cgauche.github.io/jeu/)
gh workflow run deploy.yml --ref main     # déclenche le workflow « Déploiement prod » (ou bouton « Run workflow » sur GitHub → Actions)
```

**Déploiement** : le déploiement est un **workflow GitHub Actions** (`.github/workflows/deploy.yml`,
déclenchement manuel) qui build le **COMMIT** de `main` sur un runner propre et pousse `dist/` (hors
`qc/`) vers `cgauche/cgauche.github.io` sous `jeu/` → **https://cgauche.github.io/jeu/**. Il n'embarque
JAMAIS le working tree local : seul le travail commité+poussé part en prod.
Prérequis (en place) : secret Actions `PROD_DEPLOY_KEY` dans `cgauche/game` — clé privée SSH dont la
publique est une deploy key en écriture sur `cgauche.github.io`. **Ne déployer que sur demande explicite de l'utilisateur**,
après suite complète verte, et après `git push` (le workflow build le commit distant).

**Vérification** : après une feature UI, valider dans le navigateur — flux complet dans
**`docs/recette-navigateur.md`** (outils `window.__wfrp`, scénarios de test, piège closure-sync).

## Architecture — carte rapide

```
src/engine/   règles WFRP4 PURES + testées (types, tests/DR, combat, ops.ts = GameOp, magic, corruption…)
src/state/    store Zustand + flux (combatFlow barils, rollFlowFactory/Specs, scene.ts = SCHÉMA, upkeep…)
src/gameIso/  rendu du monde : builders/ (géométrie PURE) → backends/webgl/ (three) montés par stage/ (GameStage3D, viewPolicy) ; authoring/ peintres SVG (plan, éditeur), pov/, rig/, IsoStage, fx/
src/ui/       React (RollShell, OptionChooser, editor/ v2, creator/, compendium/)
src/data/     base APP-OWNED (JSON commité, éditable au Compendium) + exceptions manuscrites sourcées
src/scenes/   documents de scène + campagne Arène (arene-projet.json) ; asciiMap.ts = authoring ASCII
src/net/      coop relay WS (client) · server/ = Worker Cloudflare · art-ref/ = illustrations (gitignoré)
```

Rôle détaillé de chaque module, conventions (baril combatFlow, résolution forcée, GameOp…) et
état courant des systèmes : **`docs/architecture.md`**.

## Primitives partagées (RÉUTILISER — ne JAMAIS réécrire à la main)

Source UNIQUE de motifs récurrents. **Avant d'écrire un segmented control, une paire de boutons de
choix, une rangée d'influence, un calcul « base + mods », un onglet, un lookup de table d100, ou une
recherche de combattant par id : utiliser la primitive ci-dessous.** Chaque ajout d'option/bouton se
fait DANS la primitive, pas dans une nième copie.

| Besoin | Primitive (source unique) | Fichier |
|---|---|---|
| Coquille d'**écran plein-champ** (carte du monde, port/escale, marché, dossier de navire, négoce) — voile + en-tête (titre/actions/fermeture) + corps, a11y de dialogue, barre d'outils `.screen-toolbar` optionnelle (y poser `<Tabs>`), prop `body` (`'full'` canevas / `'centered'` panneaux borné-960px) + slot `backdrop` (bande d'ambiance) | `ScreenShell` (jamais recopier `.worldmap-overlay`/`.worldmap-head`/`.port-body`) | `src/ui/ScreenShell.tsx` |
| **Menu** (menu PRINCIPAL hors partie ET menu SYSTÈME plein écran/pause EN jeu, ses sous-écrans Coopération/Options compris) : carte + sections de grands boutons pleine largeur icône+libellé + séparateurs titrés + interrupteur de menu — *réflexe avant tout `.menu-card` ou `<button className="btn">` de menu recodé* | `MenuCard` (+ `MenuSection`/`MenuButton`/`MenuToggle`) | `src/ui/MenuCard.tsx` |
| **Méta d'en-tête** date+bourse `{time?, money?}` (`.hud-clock` + `.port-purse`) — partagée en-tête d'écran plein-champ ET en-tête du menu système (date seule, sans bourse) | `ScreenMeta` (composée par `ScreenShell` et `GameMenu`) | `src/ui/ScreenMeta.tsx` |
| **Onglets** (fiche, écran plein-champ, dock repliable, sous-onglets) — *réflexe avant tout `role="tablist"` recodé* | `Tabs` (`variant` : `flat`/`pill`/`sub`/`dock`) — role=tablist/tab, `aria-selected`, roving tabindex (flèches/Home/End) | `src/ui/Tabs.tsx`, `src/ui/styles/tabs.css` |
| **Roving tabindex** (flèches + Home/End, selection-follows-focus — tablist/listbox/radiogroup) — *réflexe avant tout `onKeyDown` de navigation par flèches recodé* | `rovingKeyDown` (fonction PURE, aucun hook interne — le conteneur est une simple réf fournie par l'appelant ; couvre les sites HTML ET SVG) | `src/ui/rovingFocus.ts` |
| **Appui LONG** (geste secondaire d'une alvéole, tactile ET souris — 450 ms, annulé par déplacement >10 px ou relâchement, `consomme()` avale le clic/`contextmenu` qui suit dans une fenêtre de 700 ms) — *réflexe avant tout minuteur `pointerdown` recodé* | `useLongPress` (composé par les alvéoles de `CombatConsole`) | `src/ui/useLongPress.ts` |
| Modale de jet (Lancer→Chance→Pacte→Résilience→Appliquer) — la **proéminence** d'une action se DÉDUIT de sa `key` (rôle→style DANS RollShell : `cancel`/`break`/`ack`=ghost, reste=primary) ; les appelants ne portent PLUS de champ de style | `RollShell` (props=contrôles, slots=métier) | `src/ui/RollShell.tsx` |
| Modale de jet **MULTI** (N contributeurs, influence PAR participant, coop) — *réflexe avant toute « 2e modale multi-jets »* | la MÊME coquille `RollShell` (le **mono = N=1** : plusieurs `RollRow`) + `makeRollFlow` mode `spec.multi` (`RollParticipant` `interactive`/témoin) ; ex. `ForceDoorModal`/Manœuvre | `src/ui/RollShell.tsx`, `src/ui/RollRow.tsx`, `src/state/rollFlowFactory.ts` |
| Choix d'**options de jet** (Parade/Esquive, menu de désengagement, Calme/Résistance) | `OptionChooser` (`seg`/`grid`/`actions`) | `src/ui/OptionChooser.tsx` |
| Paire/triplet de **boutons de décision** (Renoncer, Destin, Piège à lame…) | `ChoiceButtons` (= `OptionChooser layout='actions'`) | `src/ui/OptionChooser.tsx` |
| **Rangée de READY-CHECK coop** (pause de Round dans la bande de phase, écran de Victoire, nuit de repos) — n'affiche QUE les sièges requis (`siegesRequis`, source unique du quorum dans `src/state/netOwnership.ts`), nomme le siège à l'écran, état prêt/attendu par siège — *réflexe avant toute rangée « Prêt » par siège recodée* | `ReadyRow` | `src/ui/ReadyRow.tsx` |
| **Panneau-PARAMÈTRE borné** ANCRÉ à son déclencheur (spec HUD zone 10 : munition d'une arme, localisation, objets d'UNE pastille, Sort à dissiper d'UN porteur) — liste BORNÉE de candidats, un clic = commit + fermeture, Échap/clic-dehors = annulation GRATUITE. *Réflexe avant tout tiroir/liste déroulante de console recodé — et jamais pour un choix EXHAUSTIF (ce n'est pas un menu : le paramètre est borné par ce que la situation offre)* | `PanneauParametre` (compose `OptionChooser layout='grid'` + le placement pur `computePopoverPos` de `CodexRef`) | `src/ui/PanneauParametre.tsx` |
| Valeur effective d'une option (`base + mods` plafonné) | `optionValue` | `src/ui/breakdown.ts` |
| Ligne pré-jet `{ label, base, mods }` | `optionPending` / `testPending` | `src/ui/breakdown.ts` |
| Rangée « influencer le jet » (Chance/Pacte/Résilience/Détermination) | `InfluenceRow` (+ `ResilienceButton`/`DeterminationButton`) | `src/ui/InfluenceRow.tsx` |
| En-tête A→B d'une modale de combat | `VsHeader` | `src/ui/VsHeader.tsx` |
| Affichage d'un personnage (HUD/modale/picker) | `PortraitTile` / `CharFrame` | `src/ui/PortraitTile.tsx` |
| **Barre de remplissage LISSE** (vie du portrait, Blessures/Encombrement de la colonne de fiche) — ton par PALIER (`tone`) OU teinte CONTINUE (`color`, ex. `hpColor`), variante `overlay` (superposée, portraits compacts), état de DÉPASSEMENT explicite (`value > max` : piste pleine + surplus + valeur en gras danger) — *réflexe avant toute jauge crantée réutilisée pour une VRAIE barre de vie* | `LifeBar` (jamais `NotchGauge`, réservée aux ressources à PALIERS DISCRETS — Coque/Moral/Soute) | `src/ui/LifeBar.tsx` |
| Champ de **filtre/recherche** de liste (catalogue, palette, sélecteur) — état + filtre pur | `SearchFilterField` (widget) + `useFilteredList`/`filterByLabel` (état/pur) | `src/ui/SearchFilterField.tsx` |
| **Maître-détail** (liste GAUCHE + détail CENTRE — Codex/Compendium ad hoc, palettes de l'éditeur, pickers…) — *réflexe avant toute 2e composition liste+détail* | `MasterDetail` (gabarit de LAYOUT pur, slots `list`/`detail` : l'état de sélection reste chez l'appelant) | `src/ui/MasterDetail.tsx` |
| **Table de NÉGOCE** (colonnes de stats + prix `<Coins>` + action par rangée + groupes de rubrique — marchand, port, marché terrestre) — *réflexe avant tout tableau d'achat/vente recodé* | `TradeTable` (moissonnée de l'étalon `MerchantPanel`, #371 LOT 3) | `src/ui/TradeTable.tsx` |
| **Carte-parchemin narrative** (récit ponctuel adossé à un tirage : événement d'interlude, événement de bord en mer, révélation de scène) — *réflexe avant tout `.tx-parchment` + sceau recodé à la main* | `ParchmentCard` (`seal?` médaillon d100, `title?`, `tone?`, `children` — moissonnée de l'étalon `InterludeScreen`, #371 LOT 4) | `src/ui/ParchmentCard.tsx` |
| **Panneau d'Activité/Service** (en-tête icône+titre, corps DÉFILABLE, pied FIXE : pré-jet + coût `<Coins>` + action jamais cachés par le scroll) — *réflexe avant tout markup en-tête/corps/pied de volet recodé* | `ActivityPane` (slots génériques `desc`/`blocked`/`prejet`/`cost`/`note`/`actions`/`children` — moissonnée de l'étalon `InterludeScreen`, composée aussi par `CityHubScreen`, #371 LOT 5) | `src/ui/ActivityPane.tsx` |
| **Stepper de quantité** `[−][centre][+]` (panier, quantité en stock, baisse de prix par cran) | `QtyStepper` | `src/ui/QtyStepper.tsx` |
| **Champ NOMBRE** (étape « quantité » d'une cascade, réglages de table, rangées denses de l'atelier du Codex, quantité de marché, dé forcé) — UNE primitive, trois `variant` (`complet` = saisie + `QtyStepper` + plage dite · `champ` = libellé + saisie · `nu` = saisie seule, le libellé de l'appelant devenant le nom accessible), bornes `min`/`max` OPTIONNELLES calées à UN endroit (`cale` ne cale que ce qui est borné), union `vide` quand le CHAMP VIDE est un état (`number \| null`), et deux `commit` : `frappe` (cale) ou `geste` (brouillon local, Entrée/blur posent, hors-domaine REFUSÉ sans clamp) — *réflexe avant tout `<input type="number">` brut ; cliquet `ui-ratchets` (xvii)* | `NumberField` (compose `QtyStepper`) | `src/ui/NumberField.tsx` |
| Lookup d'une table par fourchette `{min,max}` (d100, mètres, PX…) — et table dont la DERNIÈRE bande est OUVERTE (`max: null` en donnée : « 71 et + », « 4 ou plus », « 81+ ») : `tableOuverte` l'ouvre UNE fois, `findTableEntryIndex < 0` = anomalie que l'appelant NOMME | `findTableEntry` / `findTableEntryIndex` / `tableOuverte` | `src/engine/tables.ts` |
| Modificateurs de combat « brut » (Avantage×10 + État) | `baseTestMods` | `src/engine/combat.ts` |
| Libellé d'attaque gratuite de créature (`freeKind`) | `FREE_ATTACK_LABEL` | `src/engine/combat.ts` |
| Combattant par id — **combat ou groupe** (`actorIn`) vs **en combat seulement** (`inBattleId`) | `actorIn` / `inBattleId` | `src/state/combatants.ts` (module FEUILLE : zéro import runtime) |
| **Tout EFFET mécanique** (soin, État, octroi, dégâts, corruption…) — *réflexe avant tout type ad hoc*. **Le catalogue des 102 ops + des Conditions/Flow/Triggers est GÉNÉRÉ dans `docs/vocabulaire-mecanique.md`** (`npm run docs:vocabulaire`) : index par CONCEPT en français, résolution mesurée (une op « inerte dans applyOps » est NORMALE — impure ou passive, résolue ailleurs), usage réel en donnée. **Y chercher AVANT de conclure « aucune op ne fait X »** | **`GameOp[]`** exécuté par `applyOps(target, ops, ctx)` (`ctx.caster` = référent des `Formula`) | `src/engine/ops.ts` |
| Éditer une **liste de `GameOp[]`** (sorts, effets déclenchés, **PASSIFS** de trait/mutation/qualité, **consommables**) | `GameOpEditor` (liste) — repris par `EffectList`/`FlowEditor` | `src/ui/editor/GameOpEditor.tsx` |
| Rendu JOUEUR d'une liste de `GameOp[]` (passifs d'entité, effets de signe astral) — chips codex-liées + phrase humanisée, jamais le résumeur d'atelier `opSummary` | `GameOpChips` (vue) + `opRows` (structure, compendium) | `src/ui/GameOpChips.tsx` |
| Modificateur **PASSIF** d'un élément (trait/mutation/qualité/trauma/maladie/faim/sort) | `passiveMods(c)` collecteur UNIQUE + `passive: GameOp[]` en donnée | `src/engine/trauma.ts` |
| Effet **DÉCLENCHÉ** (`effects: TriggeredEffect[]`) d'une entité, pour un Trigger — *réflexe avant tout chemin par-kind* | **`fireTriggers(get, actor, trigger, ctx)`** DISPATCHER UNIQUE : réunit Traits + Talents + Atouts + **États** (par composition : Maladies/Mutations octroient Trait/État). Ajouter une source = l'ajouter ICI, JAMAIS un dispatch parallèle | `src/state/triggeredEffects.ts` |
| Attaque GRATUITE déclenchée (`grantFreeAttack` : Frappe réactive/Assaut féroce, et tout Trait/État) | `resolveFreeAttacks` (itère `freeAttackSourcesOf`, filtre `flowHasFreeAttack`) — kind-agnostique | `src/state/combatFlow.ts` |
| Dégâts/soin de **coque** (voyage fluvial/maritime) | `damageHull`/`healHull` routent `applyOps` ; `damageVesselHull`/`healVesselHull` (`seaVoyageFlow.ts`) enchaînent la persistance — SOURCE UNIQUE `state.vessel.wounds` | `src/state/shipDamage.ts` |
| **Suspendre/reprendre une CASCADE** quand un combat/une transition s'ouvre en plein vol (le slot `pendingCascade` = la cascade ACTIVE, unique) | `suspendActiveCascade` / `resumeSuspendedCascade` (pile persistée de cascades suspendues ; coutures universelles : ouverture de combat/transition de scène → suspend, teardown victoire/défaite → resume) — JAMAIS un checkpoint parallèle ni une purge | `src/state/cascade.ts` |
| **Cérémonie de tirage** du créateur (Race/Carrière/Caractéristiques/Signe astral) : attente→roulant→rendu, gain de PX en direct | `CreatorDice` (compose `Section`/`XpBadge`/`useRollFrisson`/`DiceRoll`) | `src/ui/creator/CreatorDice.tsx` |
| Aperçu « perso en pied » hors combat (roster, créateur, fiche, marchand) — rig réel, apparence bas niveau OU `hero` (Combatant) | `CharacterPreview` | `src/ui/CharacterPreview.tsx` |
| Bouton d'engagement dont l'indisponibilité porte sa RAISON au SURVOL/FOCUS/TAP (infobulle partagée `CodexRef` prop `refus` — arbitrage utilisateur 2026-08-24, jamais de texte inline par défaut) ; inline par opt-in `raisonInline` réservé aux sites où la raison est structurante ; a11y : `aria-describedby` sur copie hors écran + contrôle `aria-disabled` (jamais `disabled` : il doit rester atteignable clavier/manette/tap) | `GatedAction` | `src/ui/GatedAction.tsx` |
| **Rose des forces** (mini-radar gravé, N axes paramétrables — `axisScore`/`axesProfile`, `src/engine/axes.ts`) : glyphe 44px coin de figurine, médaillon 90×86, rendu plein 280×196 | `RoseAxes` | `src/ui/RoseAxes.tsx` |
| Chip statut métallisé Bronze/Argent/Or + échelon (dérivée de `parseStatus`) | `MetalStatus` | `src/ui/MetalStatus.tsx` |
| Sceau de cire (tête de mort, SVG) + plaque d'élu scellée | `WaxSeal` / `SealedPlaque` | `src/ui/WaxSeal.tsx` |
| Chemin d'évolution d'une carrière en médaillons de niveau (`levelsForCareer`) | `CareerPath` | `src/ui/CareerPath.tsx` |
| **Cadre-figurine UNIQUE** (#430/#431) — races, carrières, candidats : patron `.fam-tile` de la planche, une COLONNE (rivets d'or vissés, boîte-figurine à HAUTEUR FIXE sur sa lueur de sol, nom + compte DESSOUS), liseré or si sélectionné, sceau optionnel débordant. Taille de boîte par PROP `fig` (`compact` 104px / `big` 172px), jamais un fork ni une classe par écran ; AUCUNE ambiance `CharacterPreview` exposée (la tuile porte SA matière — une ambiance de plus y peint le 2e cadre) — *réflexe avant tout « cadre dans un cadre » (carte bordée + boîte d'aperçu bordée à l'intérieur)* | `FigTile` (compose `CharacterPreview` ; SEULE définition de `.fig-tile*` : `src/ui/styles/frames.css`) | `src/ui/FigTile.tsx` |
| **Présence PLEIN FORMAT** d'un héros hors combat (colonne aside de la fiche) — boîte-figurine `FigTile` en variante STATIQUE (`fig="hero"`, sans `onClick`/label : aucune sémantique de picker), rig 320px sur sa lueur de sol. Le CORPS de cette colonne est l'INDEX universel de la fiche (#492, arbitrage 2026-07-17) : prop `zoneBadges` — un badge PAR `HitLocation`, ancré anatomiquement (tête/bras/corps/jambes, positions posées UNE fois dans la primitive) — l'appelant fournit la donnée PAR zone (PA d'armure en Possessions, critiques/séquelles en État), jamais la position ; `onClick` présent = `<button>`, absent = `<span>` | `FigTile fig="hero"` (+ prop de zones ancrées, même primitive que la table ci-dessus, sans nouveau composant) | `src/ui/FigTile.tsx` |
| Grille de sélection en SECTIONS par famille/classe (roving tabindex, `role=listbox`) | `GroupedPickGrid` | `src/ui/GroupedPickGrid.tsx` |
| Cadre de détail de l'élue (nom + chips méta + rubriques + prose scrollable, sans slot d'actions) | `DetailFrame` | `src/ui/DetailFrame.tsx` |
| **Rangée-plaque** sombre à rivets d'or (registre de caractéristiques, rangées d'allocation : préfixe codex, nom en `--font-display`, méta centrale base/dés/steppers, valeur droite, états élu/roulant — matière `.c-plate` de la planche Atelier) — *réflexe avant toute rangée de registre recodée* | `PlaqueRow` (+ `PlaqueGrid` 2 colonnes ; styles `src/ui/styles/plaque-row.css`) | `src/ui/PlaqueRow.tsx` |
| **Gabarit d'ÉTAPE du créateur** (OSSATURE 2 zones : bande d'ACTION requise en tête — le choix de la voie, l'encrier `CreatorDice` — puis la zone de CHOIX, et la zone DESC = fiche de l'élue ou FICHE VIVANTE par défaut) — *réflexe avant tout écran-étape du créateur recodé ; le format est un SLOT, jamais une consigne de brief* | `CreatorStepFrame` (+ `StepHeader`/`Section`/`XpBadge` ; compose `MasterDetail` ; styles `src/ui/styles/creator-step.css` ; garde `creator/creator-ossature.test.tsx`) | `src/ui/creator/CreatorStepFrame.tsx` |
| **Bande titrée de rubrique** (barre bois/laiton, titre + compteur/jauge ancrés à droite, contenu dessous — plusieurs blocs d'un panneau : étapes du créateur, bandes de section du registre État de la fiche) — *réflexe avant tout bandeau de rubrique recodé* | `Band` (extraite du créateur #492 Lot 1c, primitive PARTAGÉE — plus aucune dépendance au gabarit d'étape) | `src/ui/Band.tsx`, `src/ui/styles/band.css` |
| **Corps de FICHE HÉROS** (bande d'en-tête figurine+identité+statut+rose `header` désactivable, Caractéristiques+dérivées, Forces seuillées, Compétences/Talents/Sorts-Miracles/Possessions en chips codex) — *réflexe avant toute Nᵉ fiche perso recodée* | `HeroSheet` (composé par `creator/CreatorSummary.tsx` et `PartyScreen.tsx`) | `src/ui/HeroSheet.tsx` |
| **Galerie design system IN-APP** (DEV) : référence de goût pérenne, chaque primitive montée VIVANTE avec des données réelles | `DesignGallery` (`MasterDetail`) | `src/ui/gallery/DesignGallery.tsx` |

> **Frontière orchestrateur · machinerie · data-driven** (cf. `docs/combat-events-coherence.md` §3bis) : un
> Trigger doit fonctionner pour TOUT kind d'entité (maladie/talent/trait/sort/état/mutation) **sans code
> spécifique**. Données = `effects`/`passive` sur l'entité, dispatchées par `fireTriggers` (UNIQUE). Machinerie
> = hooks `registerCombatHook` (règles universelles de l'arène, ne nomment AUCUNE entité). « Difficile à
> exprimer » n'autorise JAMAIS la machinerie → on étend le vocabulaire (`GameOp`/`Formula`/`Condition`).

> Pistes ÉVALUÉES puis ÉCARTÉES (sites trop divergents pour une source unique propre — ne pas
> « globaliser » de force) : `confirmPending` (les `xConfirm` divergent par leur garde de résultat et
> réutilisent `battle` localement → un wrapper ne raccourcit rien), `useMasterDetail` — le rejet
> portait sur le **HOOK D'ÉTAT** partagé (marchand ⇄ carte divergent après sélection) et reste
> valide ; le **GABARIT DE LAYOUT** (slots liste/détail, aucun état) en a été extrait en primitive
> sous #330 → voir `MasterDetail` dans la table ci-dessus (périmètre précisé 2026-07-11, le verdict
> d'origine ne portait que sur l'état) — `<StatChip>`/`itemStatParts` (3 formes de données
> différentes : chaîne d'`ItemInstance`, `Combatant.weapons` résolues, table par famille). Le sweep
> `actorIn` dans `store.ts` est aussi écarté : `battle` y reste en portée pour le `set` final.

## Workflows multi-agents (sur opt-in « ultracode »)

Bons pour la **donnée/extraction/vérification**, pas l'art à l'aveugle. Déjà utilisés :
audit de fidélité des règles (a trouvé 3 vrais bugs), extraction du Tome 1 en dossiers,
génération des sprites de bestiaire depuis l'art officiel (lecture d'image par les agents).

## Pièges connus

- **Closure synchrone en test Playwright** : détail dans `docs/recette-navigateur.md` — ne jamais
  lire le DOM dans le même `evaluate` que l'action qui change l'état React.
- `src/data/*.json` sont la SOURCE app-owned commitée : rien à régénérer après un `git clone`.
- Il n'y a PLUS d'inventaire de GROUPE (`store.inventory`/`giveItem` supprimés) : tout objet va
  sur un héros (`Combatant.items`) via `giveTrapping` (réel ou custom). Butin d'équipement
  attribuable par portrait à l'écran de victoire (`pendingVictory.gear`).
