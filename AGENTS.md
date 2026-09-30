<!-- GENERATED: agents:sync; source=CLAUDE.md -->
Credo injecté au SessionStart par `.codex/hooks.json` (`inject-project-credo.mjs`).

# AGENTS.md — RPG Warhammer Fantasy v4 (web)

Le credo importé ci-dessus prime sur tout réflexe. Ce fichier ROUTE : ce qui sert AU MOMENT d'un
geste vit derrière son déclencheur.

## Ce qu'est ce projet

Un **jeu de rôle vidéoludique 100 % web, en français**, type *Neverwinter Nights / Baldur's Gate*
(tactique tour par tour, vue isométrique), basé sur **Warhammer Fantasy Roleplay 4e** : 4 aventuriers
à travers la campagne **L'Ennemi Intérieur**.

Ce dossier EST un vrai projet logiciel (`cgauche/game`) : commits + push attendus, tronc `main`
(trunk-based). Le `Foundry/AGENTS.md` parent ne s'applique PAS ici.

Mémoire committée `.claude/memory/` (index `MEMORY.md` + fiches) : injectée en session locale, à LIRE
en cloud ; se committe comme du code, jamais de git destructif dessus.

## Table de routage — lire le bon doc AU MOMENT du déclencheur

Un `docs/x.md` GÉNÉRÉ (jamais édité à la main) se régénère par `npm run docs:x` ; quand le nom du
script diffère du nom du doc, il est entre parenthèses.

| Déclencheur | Lire |
|---|---|
| **Doctrines utilisateur** — avant tout brief, verdict ou code sur un socle | `docs/doctrines.md`, puis la fiche |
| **Primitives partagées** — avant tout composant/module/op, et tout `Write` sous `src/` | `docs/primitives.md` |
| Politique `docs/`, où vit un module, pistes écartées, frontière orchestrateur/machinerie/donnée | `docs/architecture.md` |
| Quels systèmes existent, qui compose quoi | `docs/systemes.md` |
| « Le moteur sait-il faire X ? » (op, Condition, Trigger) | `docs/vocabulaire-mecanique.md` (`docs:vocabulaire`) |
| « Quelle couture fait X ? » (exports de `src/engine`) | `docs/index-moteur.md` |
| « Par où passe CE jet ? » | `docs/registre-jets.md` |
| « Qui remplit quelles zones de `RollShell` ? » | `docs/usages-jets.md` |
| Question RAW | `docs/raw/00-index.md`, puis `Source/` pour **citer** |
| Détail d'un livre source | `docs/sources-vf.md` |
| Valider une UI au navigateur | `docs/recette-navigateur.md`, `docs/test-scenarios.md` |
| Passif, corruption | `docs/systeme-passifs.md` (`docs:passifs`) |
| Triggers / événements de combat | `docs/combat-events-coherence.md` |
| Ajouter une créature (rig) | `docs/creer-une-creature.md` |
| Ajouter/curer une donnée | `docs/donnees.md`, `docs/ajouter-une-donnee.md` (`docs:ajouter-donnee`) |
| Authoring de map | `docs/map-authoring.md` |
| Créer/modifier une campagne | `docs/campagne-authoring.md`, skill `creer-une-campagne` |
| Écran UI (CSS, densité, responsive) | `docs/charte-ui.md`, règle 4 |
| Flux de jet différé (1 situation = 1 modale) | `docs/ajouter-un-flux-de-jet.md` (`docs:flux-de-jet`) |
| Intégrer un livre source (VF, ou VO autorisé) | `docs/ajouter-un-livre-source.md` |
| Sort, Prière, Bénédiction, Miracle, Rituel | `docs/ajouter-un-sort.md` (`docs:sort`) |
| Ajouter une icône, remplacer un emoji | `docs/ajouter-une-icone.md` (`docs:icones`) |
| Mécanique d'une entité (trait, talent, qualité…) | `docs/ajouter-une-mecanique.md` (`docs:mecanique`) |
| Rendu du monde (builders, peintres, ambiance) | `docs/rendu-pipeline.md` |
| Relation inverse / index / auto-liage du Codex | `docs/codex-relations.md` |
| Qui lit ce champ JSON avant de le renommer ? | `docs/consommateurs-de-champs.md` (`docs:field-consumers`) |
| Forme d'un concept dans chaque dataset | `docs/structures-donnees.md` (`docs:structures`) |
| Entrée de donnée orpheline ? | `docs/orphelines-donnees.md` (`docs:orphelines`) |
| Absent à l'écran — gaté par une règle optionnelle ? | `docs/regles-optionnelles.md` |
| Sprite/rig reconnaissable (QC) | `docs/qc-reconnaissabilite-sprites.md` |
| Reprendre un chantier après pause | `docs/reprise-apres-pause.md` (`docs:reprise`) |
| Sorts/miracles : état réel | `docs/sorts-implementation.md` (`npx tsx scripts/gen-sorts-doc.mts`) |

## Règles strictes (NE PAS déroger)

1. **Aucune invention de règles.** Toute règle/valeur vient des livres autorisés : Atlas
   `docs/raw/00-index.md` d'abord — devoir rouvrir `Source/` est un DÉFAUT DE L'ATLAS à corriger —,
   `Source/` restant la vérité citable (`LDB <chap> l.<ligne>`). Champs `Implémente` GÉNÉRÉS
   (`npm run raw:implemente`) ; dette = entrée `src/data/raw.manifest.json` (topic non implémenté
   SANS entrée = CI rouge). Gardes : `scripts/raw/coverage.mjs`, `scripts/raw/reconcile.mjs`,
   `npm run docs:check`.
2. **Tout le contenu de campagne est éditable** (schéma de Scène unique) : aucune scène « en dur ».
3. **Le moteur (`src/engine`) reste pur et testé.** Store, UI et rendu en dépendent, jamais l'inverse.
4. **UI en français, et qui scale** : au-delà de ~2 sections → onglets ; tout écran neuf est
   responsive dès sa création — en LARGEUR (360px, breakpoints 900 / 700 / 560) ET en HAUTEUR (vues
   de `scripts/recette/vues-recette.json`, aucun défilement de PAGE) —, composé des primitives de
   `src/ui/styles.css`. Gardes : `docs/charte-ui.md`, `src/ui/ui-ratchets.test.ts`,
   `scripts/recette/hauteur-reelle.mjs`.
5. **Aucune retranscription des textes sources dans les `.json`** : toute prose est un copié/collé
   VERBATIM, en Markdown, jamais en HTML ni reformulée ; rendue par l'unique primitive `Prose`. Garde :
   `src/data/no-html-in-prose.test.ts`. Campagne : fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`.
6. **Un commentaire porte une réf nue** — jamais une paraphrase de règle, une excuse ni une pierre
   tombale (voir le credo). Garde : `src/comment-poison-guard.test.ts`.
7. **Pas de MJ — tout se modélise.** Ce que le RAW laisse « au MJ » reçoit un arbitrage EXPLICITE
   (donnée éditable taguée maison, ou choix joueur) ; une règle présente dans la source est
   IMPLÉMENTÉE, jamais reportée. Hors source → CustomStatblock, ou omission documentée.

> **Pour TOUT agent dépêché sur ce repo**, quel que soit son brief :
> - Ne crois RIEN sans vérifier au `Source/` — ton brief et ton orchestrateur compris.
> - Le poison de ton périmètre se CORRIGE dans le geste ; hors périmètre, il va dans ton rendu avec
>   `fichier:ligne`. Un test qui verrouille un comportement faux se réécrit depuis le RAW.
> - Toute LOGIQUE est keyée par id STABLE, le `label` est de l'AFFICHAGE ; seule couture label→id :
>   `src/data/index.ts`, au CHARGEMENT (fiche `user-doctrine-ids-stables-labels-affichage`).
> - Tout arbitrage UTILISATEUR consigné (doc, mémoire, ticket) porte sa CITATION verbatim + date.
>   Sans citation, c'est une évaluation d'ingénierie révisable, jamais un précédent.

## Sources VF

Tout est en **français** sous `Source/`, dossiers préfixés `Warhammer v4 - ` / `WH - V4 - ` ; ceux
SANS ce préfixe sont la VO du dépôt parent — jamais lus, jamais cités ici. **Exceptions** :
`Source/Warhammer Fantasy Roleplay 5e Core Rulebook/` (**CRB**), livre VO AUTORISÉ, cœur de la 5e — fiche
`user-doctrine-edition-5e-coeur-remplace-ldb-raw-sauf-errata`. La VO de L'Ennemi Intérieur se lit pour
comprendre : fiche `user-doctrine-lecture-vo-campagne-pour-comprendre`. Livres : **LDB** ·
**ADE I/II** · **EDO/EDOC** · **Middenheim** · **AA** · **ZI** · **MDG** · **ACE** · **MSRC** ·
**NADJ** · **VDM**, chacun pour son périmètre (tout livre FR peut fournir une règle, par PASSAGE) —
chemins et chapitres : `docs/sources-vf.md`. `src/data/*.json` est la source APP-OWNED, éditable au
Compendium, chaque entrée taguée à sa `source`.

## Pile et commandes

**Vite + TypeScript + React** ; monde rendu en volumique **three.js** (`src/gameIso/backends/webgl/`),
grille/murs/pions/chrome en surcouches SVG React. **Zustand** (store), **Vitest**, RNG seedable
(`makeRNG`).

```bash
npm install            # pose les hooks git et les pilotes de fusion
npm run dev            # dev (port dérivé en worktree lié, imprimé au lancement)
npm test               # tests Vitest
npm run typecheck      # tsc --noEmit
npm run typecheck:fast # typecheck incrémental (~7-10 s)
npm run gates          # rejeu local de gates de ci.yml (--gates a,b, --serie)
npm run galleries      # galeries QC -> public/galeries.html
npm run ops:chantier -- <N> · ops:publier -- --detache · ops:worktrees · ops:board [-- --liste|--creer] · ops:suivi -- <N> [--creer]   # .wt-<N>, train détaché, inventaire, Project GitHub, .git/suivi/<N>.md
npm run relay:dev      # relay coop local ; relay:deploy pour publier
gh workflow run deploy.yml --ref main   # prod — sur demande explicite SEULEMENT
```

Régime de push, `package-lock` : `docs/reprise-apres-pause.md`.

## Architecture

```
src/engine/   règles WFRP4 PURES + testées (types, tests/DR, combat, ops.ts = GameOp, magic…)
src/state/    store Zustand + flux (combatFlow, rollFlowFactory/Specs, scene.ts = SCHÉMA, upkeep…)
src/gameIso/  builders/ (géométrie PURE) → backends/webgl/ montés par stage/ ; authoring/, pov/, rig/, fx/
src/ui/       React (RollShell, OptionChooser, editor/, creator/, compendium/)
src/data/     base APP-OWNED (JSON commité) + exceptions manuscrites sourcées
src/scenes/   documents de scène + campagne Arène
src/net/      coop relay WS (client) · server/ = Worker Cloudflare · art-ref/ (gitignoré)
```

Détail : `docs/architecture.md`.

## Pièges connus

- **Closure synchrone en test Playwright** : jamais lire le DOM dans le même `evaluate` que l'action
  qui change l'état React (`docs/recette-navigateur.md`).
- `src/data/*.json` est la SOURCE app-owned commitée : rien à régénérer après un clone.
- Aucun inventaire de GROUPE : tout objet va sur un héros (`Combatant.items`) via `giveTrapping`.
