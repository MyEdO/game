# Revue adversariale de PALIER — 10 commits de substance, 1 fermeture, 4 sessions, 2026-09-07

verdict: PARTIEL — le palier a soldé le SYMPTÔME des trouvailles 1/3/5 du palier n°5 (les trois soldes refusés sont corrigés et repassent `validateSolde`, la porte de stock ne trouve plus AUCUNE croissance non déclarée sur la fenêtre, l'unique fermeture passe par `github-actions[bot]` après publication, #1686 est resté OUVERT comme décidé, typecheck FULL et `docs:check` verts, `gen` idempotent, 30/30 sur les bancs ciblés, et les huit claims de train vérifiés au code tiennent, RAW `AA 10` compris) — mais AUCUNE des quatre CAUSES n'a été traitée : la porte de solde n'est toujours pas un hook git (35 des 64 soldes committés sont refusés par le garde qui prétend les garder), `ROUTANT_RE` compte encore les jetons et non les tickets neufs, le faux +1 de la porte de stock a été PAYÉ par un cliquet honnête au lieu d'être corrigé, la tombale de `CascadeTableMode.test.tsx:147` est toujours là et toujours invisible au motif ; s'y ajoutent un `main` ROUGE 7 h 01 dans la fenêtre dont la leçon écrite sous-déclare la durée, 6 des 10 commits de substance sans aucun check-run, et l'arbre principal qui décroche de 51 à 73 commits.

Fenêtre : 714df53da..1cac27bb6

**Arbre ÉPINGLÉ** : worktree `.wt-1624`, `git rev-parse HEAD` = `1cac27bb6`, et `git merge-base --is-ancestor 1cac27bb6 origin/main` → **exit 0** (l'arbre jugé EST publié ; `origin/main` = `a6c9634198885d9e75c6a4a33c362cc1670f04dd`, deux commits plus loin, CI verte 21:43Z). `git status --porcelain` = **120 chemins modifiés** — le lot 3 de #1690 NON committé (68 `scripts/`, 17 `docs/`, 6 `scripts/qc/`, 12 sous `src/`, 1 fiche mémoire) : **hors fenêtre, non jugé**, mais présent sous toutes mes mesures d'outillage (typecheck et `docs:check` ci-dessous portent donc sur l'arbre SALE, je le dis à chaque ligne).
Contrôles POSITIFS du travail jugé : `src/state/terrain/defs/` et `src/state/terrain/types.ts` **n'existent plus** (seuls `index.ts` + `terrain.test.ts` restent), `src/data/terrains.json` porte **25** entrées ; `src/ui/refus-au-survol.test.tsx` existe et `ui-ratchets.test.ts:1440-1480` porte le cliquet (xix) ; `src/engine/conditions.ts:316` exporte `syncDerivedConditions` ; `src/engine/ops.ts:1438` porte `DES_DUNE_OP` ; `vite.config.ts:28` monte `proseSource()` ; `scripts/guards/lib/lister.mjs` existe ; `src/data/materials.json` = 16 entrées, `registry.ts:2024` = catégorie `materials` « Matières » ; `.claude/soldes/revue-palier-2026-09-05-f0f9436f5.md` est bien committé dans la fenêtre. 21 commits au total, **10 de substance**.
Sessions : au moins 3 nommées dans les messages (`audit-drift-project-plan`, `game-0f`, « la session socle ») plus celle qui porte ce worktree.

## Ce qui a TENU sous attaque (réfutations tentées, échouées — à ne pas rouvrir)

**A. Trouvaille 1 du palier n°5, volet SYMPTÔME : SOLDÉE.** Sonde `valide.mjs` (la fonction MÊME du driver, `solde-ticket-guard.mjs`) rejouée sur les 64 soldes de `1cac27bb6` : `#1507 ok=true` (2 problèmes vers 0), `#1624 ok=true` (5 vers 0), `#1540 ok=true`, et le solde NEUF de la fenêtre `#1244 ok=true`, 0 routant. Les deux corrections de grammaire annoncées ont été faites et mordent.

**B. La décision « #1686 RESTE OUVERT » a été HONORÉE.** `gh api repos/cgauche/game/issues/1686` rend `state=open`, `closed_at=null`. Aucun solde `1686.md` n'est committé (`git ls-tree 1cac27bb6:.claude/soldes` ne le contient pas). Le fan-out à 5 du palier précédent n'a pas été consommé.

**C. Trouvailles 3 et 5 (croissances de stock non déclarées, `test:hooks` rouge sur 7b476acd3) : SOLDÉES sur la fenêtre.** `croissancesDeLaPlage({avant:'714df53da', apres:'1cac27bb6'})` rend **refus: [], notes: [], 21 commits**. 28 lignes `CLIQUET:` déclarées dans les messages, dont les créations de bancs de portes qui rougissaient au palier n°5.

**D. La fermeture suit la PUBLICATION.** Une seule fermeture dans la fenêtre : **#1244**, `closed_at 2026-09-06T09:50:38Z`, événement `closed` par **github-actions[bot]**, `commit_id = null`, avec le commentaire de solde posé à la même seconde. Son solde passe le garde (A).

**E. Les huit claims de train tiennent, vérifiés au code.**
- `1cac27bb6` (#1690 lot 2) : « 0 fichier TS de terrain » **CONFIRMÉ** (`defs/`, `_registry.generated.ts`, `types.ts` absents ; 25 ids dans `terrains.json` — le message dit lui-même que le ticket en annonçait 24 à tort). « Mémo par identité impossible » **CONFIRMÉ à la cause** : `src/data/overrides.ts:323-325`, `setDataset` fait `arr.splice(0, arr.length, ...)` — l'identité du tableau ne change jamais, un mémo par identité ne s'invaliderait pas. Le refus du codeur contre le brief était FONDÉ.
- `54d228a46` (#1689 T2) : contrat POSITIF réel (`refus-au-survol.test.tsx` : `aria-disabled` + `aria-describedby` désignant un élément qui PORTE la raison + absence de `title` natif, écran par écran) ; cliquet (xix) à exemptions **AU SITE**, avec morsures « exemption périmée » et « site neuf dans un fichier exempté ». Réserve mesurée : trouvaille 5.
- `d14af7e07` (#1599) : `syncDerivedConditions` (`conditions.ts:316-380`) est un socle KIND-AGNOSTIQUE — il lit `passiveMods(c)`, filtre `op === 'condition'`, réconcilie un multiset contre `derivedFrom.stacks`, ne touche ni les pions non marqués ni les États verrouillés, et se protège de la ré-entrance par `WeakSet` PAR PORTEUR. Aucun nom d'entité dans le code.
- `ae965324c` (#1679 L3b A, corrige #1244) : claim « 105 appels bruts vers 0 » **CONFIRMÉ** — un grep de `readdirSync` et `promises.readdir` sur `scripts/docs`, `scripts/raw`, `scripts/guards/lib`, hors `lister*.mjs` et `enregistreur-lectures.mjs`, rend **0 résultat**.
- `f1b48ef7b` (#1679 L3b B) : `purgerPerimes`, `scriptKindDe` (`guards/lib/dialecte.mjs:25`, consommé par au moins 5 gardes), `shaCause` séparé du `sha` poussé (`pre-push.mjs:142-145,391-393`) — tous présents.
- `ee9608ead` (#1680, citation étirée) : **VÉRIFIÉ AU SOURCE**, `Source/WH - V4 - Aux Armes/10 - L'ARTILLERIE ET LES DÉGÂTS INFLIGÉS AUX STRUCTURES.md` : « **Clôture en clayonnage :** les clôtures en clayonnage sont tressées avec de minces branches de saule. […] elles conviennent davantage pour des enclos d'animaux que pour des fortifications. **Elles restent employées comme couvert** par ceux qui n'ont pas le temps de trouver autre chose » et « **Herse :** une grille de fer qui peut être abaissée pour protéger l'entrée principale d'une forteresse. » Le folio porte la NATURE et le COUVERT, **jamais la Ligne de Vue** : la trouvaille du palier n°5 était juste, et le correctif l'est aussi (la réf devient « déduite de la nature de la clôture que décrit AA 10 l.65 », migration:25).
- `99c5da297` (#1508 T2) : `DES_DUNE_OP` (`ops.ts:1438`) est bien un REGISTRE typé par `ChampsDOp`, `estOpADes` en dérive (`:1460`), le helper `de(...)` lève nominativement si un dé n'est pas déclaré (`:1596`), et le périmètre est DIT au code : « seule l'op `fall` déclare ses dés » (`:1540`) — le titre « la CHUTE l'emprunte » ne surpromet pas.
- `7e94518cb` (#1388 C3) : le plugin est **CÂBLÉ** (`vite.config.ts:9,28`), et le commit déclare lui-même que 0 `descRef` existe en donnée (mesuré : aucun `src/data/*.json` n'en porte) — « matérialisée au build » décrit donc une infrastructure encore vide de charge, dit tel quel.
- `1be7d75aa` (#1686 3a-2) : `materials.json` 16 entrées, `meta.ts:37,45` `libelleDeValeur` / `valeursDuChamp`, catégorie Codex posée (`registry.ts:2024`).

**F. Outillage.** `npm run typecheck` FULL sur l'arbre (HEAD **+ lot 3 sale**) : **exit 0** — « [gate] typecheck VERTE sur 1cac27b (contenu a0372faeccd3, arbre SALE : 100 chemin(s) au périmètre) ». `npm run docs:check` : **exit 0**, sur le même arbre sale — le lot 3 ne le rougit PAS. `npm run gen` deux fois : exit 0 / 0, `IDS_PAR_DATASET vers 4125 ids / 81 datasets [inchangé]`, et `git status --porcelain` **identique aux trois relevés** (avant, après passe 1, après passe 2 — 120 lignes, `diff` vide). Bancs ciblés `npx vitest run src/state/terrain/terrain.test.ts src/ui/refus-au-survol.test.tsx src/data/source/prose-source.test.ts` : **3 fichiers, 30 tests, 30 passés**.

**G. Poison NEUF : aucun.** Le diff de la fenêtre sur `src` et `scripts`, lignes ajoutées, filtré sur une vingtaine de locutions des familles (b) et (c), rend 1 seule ligne de commentaire candidate, relue : `scripts/hooks/stocks-nominatifs.test.mjs` « L'état d'AVANT n'existe plus dans l'arbre et AUCUNE révision ne sert de fixture » — ce n'est pas un rappel d'ancien état mais l'énoncé du DESIGN de la fixture. Faux positif. Les autres correspondances sont des identifiants (`FENETRE_STOCKS.avant`, `TEXTE_AVANT`) et de la prose technique.
Bonus : les cardinaux littéraux `[335, 336]` et `[1046, 1045]` de `stocks-nominatifs.test.mjs:437-438` sont adossés à des shas FIGÉS (`FENETRE_STOCKS = { avant: '571f54287', apres: '02cc09c04' }`, `:422`) — ce sont des faits historiques, pas des cardinaux VIVANTS : la consigne de `.claude/rules/tests.md` est respectée.

## Trouvailles

**1. BLOQUANT — la CAUSE de la trouvaille 1 du palier n°5 est intacte, et la mesure montre ce qu'elle coûte : 35 des 64 soldes committés (55 %) sont REFUSÉS par le garde qui prétend les garder.** Un grep de `solde-ticket-guard` sur `scripts/git-hooks/` rend **0** ; le garde reste un hook PreToolUse de session (`.claude/settings.json:76`) ; `ci.yml` ne l'appelle pas non plus (seul `test:hooks` lit l'histoire, `:116-117`). Sonde `valide.mjs` sur `git ls-tree 1cac27bb6:.claude/soldes` : **29 ok=true, 35 ok=false**. Deux familles dominent : plafond de routants dépassé (`#1548` = 17, `#1457` = 11, `#732` et `#733` = 6, `#729` et `#541` = 5…) et « item corrigé dans ce commit sans référence fichier:ligne » (`#415` trois fois, `#1640` trois fois…). Conséquence : descendre le garde au pre-commit TEL QUEL rougirait 35 fichiers d'histoire — c'est précisément ce qui bloque le geste depuis deux paliers. **Attendu** : la porte git juge la PLAGE POUSSÉE (les soldes qu'elle emporte), jamais le corpus ; sans quoi « fermeture = solde conforme » reste une convention de session, pas un verrou par construction.

**2. BLOQUANT — `ROUTANT_RE` n'a pas bougé : le plafond de fan-out compte toujours des jetons après la flèche, pas des tickets neufs.** `scripts/hooks/solde-ticket-guard.mjs:676` porte encore la même expression régulière (flèche suivie d'un dièse et de chiffres), lue en `:762` et `:855` — identique à l'octet au palier n°5. L'évasion mesurée alors (une disposition « inventaire #1463 : ticket #169X ouvert le … » fait tomber `restesRoutants` de 5 à 1 tout en émettant 4 tickets neufs) reste ouverte à quiconque la rejoue. Elle n'a pas été rejouée dans cette fenêtre (une seule fermeture, 0 routant) : le défaut est DORMANT, pas soldé.

**3. BLOQUANT — le faux +1 de la porte de stock est intact à la CAUSE, et il a été PAYÉ par un cliquet dans la fenêtre.** Sonde de réduction minimale rejouée sur `1cac27bb6` : `croissanceDesStocks(diff, {lirePostImage, lirePreImage})` sur une entrée SIMPLIFIÉE (1 ligne retirée / 1 ajoutée, cardinal inchangé) rend **[{"fichier":"src/data/field-consumers.test.ts","ajoutees":1,"retirees":0,"net":1}]** au lieu du tableau vide — le lecteur de PRÉ-image ne reconnaît toujours pas l'entrée à virgule INTERNE dans son 3e littéral. Et le message de `1be7d75aa` porte `CLIQUET: src/data/field-consumers.test.ts +1 — FAUX POSITIF NOMMÉ de la porte de stock (revue de palier 2026-09-05, trouvaille 4) …`. La déclaration est HONNÊTE (elle dit qu'aucun stock ne grandit), mais le registre des cliquets porte désormais un +1 que le dépôt sait faux, et l'attendu du palier n°5 (rendre `entreesDeStock` / `lignesDEntrees` SYMÉTRIQUE entre les deux images) n'a pas été exécuté. Toute simplification future d'une entrée de stock re-paiera la même taxe.

**4. BLOQUANT — la tombale de `src/ui/CascadeTableMode.test.tsx:147` est TOUJOURS dans l'arbre, et le motif ne la voit toujours pas.** Ligne présente à l'octet sur `1cac27bb6` : « La raison ne vit plus dans un `title` natif (invisible à l'arbre a11y, inatteignable au doigt) ». Sonde `tombstonesIn` : le témoin positif rend l'étiquette « ne vit plus ici (site quitté) », cette ligne rend **un tableau vide**. `NO_MORE_HERE_RX` (`commentPoison.mjs:296-299`) exige encore le mot littéral `ici`. Le palier n°5 annonçait « le commentaire est reformulé au présent dans le commit porteur de cette revue » : ce reformulage n'a PAS eu lieu (contrôle par lecture de l'arbre, pas par absence de marqueur). Famille (c), tolérance ZÉRO.

**5. La promesse « la raison d'un refus n'a qu'UNE forme » est vraie à 5 sites près — TOUS des écrans JOUEUR — et le test qui l'affirme est vert parce qu'il les SOUSTRAIT.** `ui-ratchets.test.ts:1585-1591` s'intitule « le stock restant est ENTIÈREMENT dans l'atelier — aucun écran joueur ne porte de refus muet » et compare `scanRefusMuet(files)` filtré hors editor/compendium/gallery au tableau vide ; or `scanRefusMuet` (`:1567`) retire d'abord les 13 `REFUS_MUET_EXEMPT_SITES`, dont **cinq `seg` d'écrans joueur** : `CastModal.tsx:552` (vérifié à la source : option `soutenu`, `disabled: !counterspellJoinable(...)`, titre « Exige un autre dissipateur du même Domaine »), `CharacterSheet.tsx:520`, `ShantyModal.tsx:71`, `jetProps/useDefenseJetProps.tsx:178` et `:179` (coût en Avantages du Porte-Bouclier). L'en-tête du commit dit « son unique site à raison (CharacterSheet:522-526) reporté au train T4 » — sous-compte de 1 contre 5 ; le corps du message et la ligne CLIQUET disent bien « cinq seg vers T4 », l'écart est donc INTERNE au message, pas caché. **Attendu** : le libellé du test dit ce qu'il mesure (hors sites exemptés), sinon un lecteur en tire un absolu faux ; et la raison d'un refus reste, à ce jour, en `title` natif sur quatre boutons de combat ou de dissipation.

**6. `main` a été ROUGE 7 h 01 dans la fenêtre, et la leçon écrite sous-déclare la durée d'un facteur 3.** Run `33993232711` sur `1658c946a` : créé `2026-09-05T21:30:17Z`, **conclusion failure à 23:06:04Z** ; premier vert suivant : run `34015226310` sur `627451282`, `2026-09-06T05:56:40Z` vers `06:07:23Z`. Durée rouge mesurée **23:06:04Z vers 06:07:23Z = 7 h 01** (8 h 37 depuis le push fautif). La fiche `.claude/memory/feedback-sonder-la-ci-de-chaque-push-avant-d-enchainer.md`, champ `description`, dit « ma session a laissé main rouge **2 h 30** » — or son propre corps précise que 2 h 30 est la durée du SILENCE du propriétaire, pas celle du rouge. Une leçon dont le chiffre est trois fois trop petit calibre mal le régime « jamais de push si le dernier run CI de main est rouge ». Le reste de la fiche est juste et l'incident est traité (cause nommée : `grammaire.test.ts:1038` mutait `IDS_PAR_DATASET` en place, et la fiche pose l'interdiction de muter un registre généré). **Dérogation** : une seule dans la fenêtre, `.git/wfrp-justificatifs/derogations.log`, `2026-09-06T05:56:41Z`, état `tentative`, motif `rouge`, sha `1658c946a…` — légitime, c'est le correctif, et il a été porté par un PEER (`627451282` : « propriétaire #1686 muet 2 h 30, trois trains bloqués »). À noter : le champ `sha` y porte le commit ROUGE et non le commit POUSSÉ ; le correctif `shaCause` de `f1b48ef7b` est arrivé 5 h APRÈS cette entrée, la ligne lui est donc antérieure — mais c'est la seule ligne du log qui documente la régression que `f1b48ef7b` dit fermer, et aucune sonde ne la rejoue.

**7. 6 des 10 commits de substance (60 %) n'ont AUCUN check-run — 5e palier consécutif.** Mesure `gh api repos/cgauche/game/commits/<sha>/check-runs` sur les 21 commits : **0** pour `54d228a46` (#1689 T2, cassant, 37 fichiers), `d14af7e07` (#1599, cassant, 91 fichiers), `ee9608ead`, `99c5da297` (#1508 T2, cassant), `7e94518cb` (#1388 C3), `1be7d75aa` (#1686 3a-2, cassant) ; **3** pour `1cac27bb6`, `f1b48ef7b`, `ae965324c`, `627451282`. Progrès réel (79 % vers 60 %), mais les quatre trains CASSANTS de la fenêtre sont exactement ceux qu'aucune course n'a jugés. **Attendu** : inchangé depuis quatre paliers — soit le push par lot cesse pour les trains cassants, soit le régime cesse d'affirmer que chaque commit passe les gates.

**8. Le détecteur de fermetures sans solde est aveugle pour le 6e palier, et son stock qui « ne peut que DÉCROÎTRE » n'a pas bougé d'une unité.** Le compte des appels à l'API GitHub dans `scripts/hooks/fermetures-sans-solde.test.mjs` est **0** : le détecteur ne voit que les fermetures passées par un commit. Cardinal de la constante `STOCK` : **118 à 714df53da, 118 à 1cac27bb6**. Atténuation honnête : l'unique fermeture de la fenêtre est passée par la publication avec un solde conforme, donc la cécité n'a rien laissé filer CETTE fois.

**9. Deux textes du dispositif se contredisent sur le nom d'archive d'une revue de palier.** `scripts/guards/lib/revuePalier.mjs:57` dit que le nom est « revue-palier-DATE-BASE-TETE.md » et `:71` construit bien la forme à trois segments quand la tête est fournie ; mais le message que le garde AFFICHE à l'agent, `scripts/hooks/solde-ticket-guard.mjs:1103`, dit encore « sous le nom de ce qu'elle juge (revue-palier-DATE-BASE.md) ». L'archive du palier n°5 porte l'ancienne forme (`revue-palier-2026-09-05-f0f9436f5.md`) — légitime, elle précède `f1b48ef7b`. Le claim « le nom d'archive porte la TÊTE de fenêtre » est donc vrai au code et FAUX dans la consigne rendue à l'agent, qui est la seule que l'agent lit.

**10. L'arbre PRINCIPAL décroche encore, et plus vite : 73 commits de retard (51 au palier n°5, 38 au n°4).** Dans l'arbre principal, `git rev-parse --short HEAD` rend `599979762` et `git rev-list --count HEAD..origin/main` rend **73**. `git worktree list` rend **23** entrées (20 au palier précédent). À créditer : les **33** chemins sales de cet arbre sont TOUS sous `.claude/memory/` (le filtre inverse ne rend aucune ligne) — mémoire vivante, zéro débris. **Attendu** : `git pull --ff-only` avant tout commit depuis cet arbre ; à 73 commits, un commit posé là régénérerait des docs dérivés contre un tronc périmé.

**11. `test:hooks` porte toujours le test FLAKY du palier n°5, non corrigé.** `scripts/gates/toutes.test.mjs:110-140` : le petit-fils écrit son témoin toutes les 200 ms, le plafond est à 1500 ms, et `readFileSync(temoin, 'utf8')` est appelé SANS attente préalable de l'existence du fichier (`:133`) — la prémisse « il a écrit au moins une fois » est toujours SUPPOSÉE, jamais attendue. Sous charge, c'est-à-dire dans le régime des lanes de `npm run gates`, l'ENOENT mesuré au palier n°5 reste reproductible. Je n'ai pas rejoué `test:hooks` (verrou machine, brief) : je ne prétends donc pas au rouge, je constate que le code de la prémisse est identique à l'octet.

## Sorties brutes

| # | commande | exit | résultat retenu |
|---|---|---|---|
| 1 | `git rev-parse HEAD` ; `git status --porcelain` | 0 | `1cac27bb6` ; **120** chemins (lot 3 de #1690, hors fenêtre) |
| 2 | `git merge-base --is-ancestor 1cac27bb6 origin/main` ; `git rev-parse origin/main` | **0** | ANCÊTRE — l'arbre jugé est publié ; `origin/main` = `a6c963419` |
| 3 | `git log --oneline 714df53da..1cac27bb6 -- src scripts` ; total | 0 | **10** de substance ; **21** au total |
| 4 | `node valide.mjs` (`validateSolde` sur les 64 soldes de HEAD) | 0 | **29 ok / 35 refusés** ; `#1244 #1507 #1540 #1624` = ok |
| 5 | `gh api repos/cgauche/game/issues/1686` | 0 | `state=open` — décision du palier n°5 honorée |
| 6 | `git diff --name-status 714df53da 1cac27bb6 -- .claude/soldes` | 0 | `A 1244.md`, `M 1507.md`, `M 1540.md`, `M 1624.md`, `A revue-palier-2026-09-05-f0f9436f5.md` |
| 7 | `gh run list --branch main --limit 60` | 0 | 11 runs dans la fenêtre : **10 success, 1 failure** (`1658c946a`) |
| 8 | `gh api .../actions/runs` sur `1658c946a` et `627451282` | 0 | rouge 21:30:17Z vers 23:06:04Z ; vert 05:56:40Z vers 06:07:23Z, soit **7 h 01 de rouge** |
| 9 | `cat .git/wfrp-justificatifs/derogations.log` | 0 | **1** entrée dans la fenêtre (2026-09-06T05:56:41Z, motif rouge, état tentative) |
| 10 | `gh api search/issues closed depuis 2026-09-06` + timeline | 0 | **1 fermeture** : `#1244`, par `github-actions[bot]`, `commit_id=null` |
| 11 | `gh api .../commits/<sha>/check-runs` sur 21 shas | 0 | substance : **6 à 0**, 4 à 3 ; total : 10 à 0, 11 à 3 |
| 12 | `node plage.mjs` (`croissancesDeLaPlage 714df53da..1cac27bb6`) | 0 | **refus vide**, notes vides, 21 commits |
| 13 | `node tomb.mjs` (`tombstonesIn` + `croissanceDesStocks`) | 0 | tombale `CascadeTableMode.test.tsx:147` rend **vide** ; simplification rend **net:+1** |
| 14 | grep `solde-ticket-guard` dans `scripts/git-hooks/` | 1 | **0** — toujours pas de hook git |
| 15 | `grep -n ROUTANT_RE solde-ticket-guard.mjs` | 0 | `:676` inchangé |
| 16 | `npm run typecheck` FULL (arbre SALE) | **0** | « [gate] typecheck VERTE sur 1cac27b (arbre SALE : 100 chemins) » |
| 17 | `npm run docs:check` (arbre SALE) | **0** | vert — le lot 3 ne le rougit pas |
| 18 | `npm run gen` deux fois + `git status --porcelain` trois fois | 0 / 0 | `4125 ids / 81 datasets [inchangé]` ; **status identique aux 3 relevés** |
| 19 | `npx vitest run` terrain + refus-au-survol + prose-source | 0 | **3 fichiers / 30 tests / 30 passés** |
| 20 | poison : diff de la fenêtre sur src et scripts, lignes ajoutées, familles b/c | 0 | 1 candidat, **faux positif** relu — 0 poison neuf |
| 21 | appels API GitHub dans `fermetures-sans-solde.test.mjs` ; cardinal `STOCK` aux deux bornes | — | **0** ; **118 vers 118** |
| 22 | grep `readdirSync` dans `scripts/docs`, `scripts/raw`, `scripts/guards/lib`, hors lecteur | 1 | **0** — claim #1244 confirmé |
| 23 | lecture `Source/WH - V4 - Aux Armes/10 - ...` lignes 38-44 et 62-72 | 0 | verbatim « employées comme couvert » — aucune Ligne de Vue |
| 24 | arbre principal : `rev-list --count HEAD..origin/main` ; `status` ; `worktree list` | 0 | **73** de retard ; 33 sales, **tous** `.claude/memory/` ; 23 worktrees |

### Sondes à promouvoir en test committé

**asymetrie.mjs** — la porte de stock ne compte pas une SIMPLIFICATION comme une croissance (trouvaille 3 ; ÉCHOUE aujourd'hui sur `1cac27bb6`) :

```js
import { pathToFileURL } from 'node:url'
const { croissanceDesStocks } = await import(pathToFileURL('scripts/guards/lib/stocksNominatifs.mjs').href)
const AVANT = "const RECOUVRES = [\n  ['Amputation', 'timing', 'src/engine/critical.ts:327, src/ui/compendium/registry.ts:719'],\n];\n"
const APRES = "const RECOUVRES = [\n  ['Amputation', 'timing', 'src/engine/critical.ts:327'],\n];\n"
const diff = ['--- a/src/data/field-consumers.test.ts', '+++ b/src/data/field-consumers.test.ts', '@@ -2 +2 @@',
  "-  ['Amputation', 'timing', 'src/engine/critical.ts:327, src/ui/compendium/registry.ts:719'],",
  "+  ['Amputation', 'timing', 'src/engine/critical.ts:327'],"].join('\n')
assert.deepEqual(croissanceDesStocks(diff, { lirePostImage: () => APRES, lirePreImage: () => AVANT }), [],
  'une entree SIMPLIFIEE (cardinal inchange) ne fait pas grossir le stock')
// obtenu 2026-09-07 : [{ fichier: 'src/data/field-consumers.test.ts', ajoutees: 1, retirees: 0, net: 1 }]
```

**tomb.mjs** — la famille (c) couvre « ne vit plus DANS tel artefact », pas seulement « ici » (trouvaille 4) :

```js
const { tombstonesIn } = await import(pathToFileURL('scripts/guards/lib/commentPoison.mjs').href)
assert.ok(tombstonesIn("// Le FICHIER, lui, ne vit plus ici : il est DERIVE du def porteur.").length, 'temoin POSITIF')
assert.ok(tombstonesIn("// La raison ne vit plus dans un `title` natif (invisible a l arbre a11y)").length,
  'src/ui/CascadeTableMode.test.tsx:147 — tombale a artefact back-tique, echappe a NO_MORE_HERE_RX')
// obtenu 2026-09-07 : temoin ["n est / ne vit plus ici (site quitte)"] ; ligne reelle []
```

**valide.mjs** — tout solde COMMITTÉ passe le garde qui prétend le garder (trouvaille 1 ; 35/64 échouent — à câbler sur la PLAGE POUSSÉE, jamais sur le corpus) :

```js
const { validateSolde } = await import(pathToFileURL('scripts/hooks/solde-ticket-guard.mjs').href)
for (const f of execFileSync('git', ['ls-tree', '--name-only', SHA + ':.claude/soldes'], { encoding: 'utf8' }).trim().split('\n')) {
  if (!/^\d+\.md$/.test(f)) continue
  const n = Number(f.replace('.md', ''))
  const c = execFileSync('git', ['show', SHA + ':.claude/soldes/' + f], { encoding: 'utf8' })
  const r = validateSolde(c, (c.match(/\d{4}-\d{2}-\d{2}/) || ['2026-09-06'])[0], { issuesFermees: [n] })
  assert.ok(r.ok, 'solde committe REFUSE #' + n + ' : ' + r.problems.join(' ; '))
}
```

**fanout.mjs** — le plafond compte les tickets NEUFS, pas les jetons après la flèche (trouvaille 2). La sonde du palier n°5 reste valable telle quelle : `ROUTANT_RE` est inchangé à `solde-ticket-guard.mjs:676`.

Fichiers chargés : `scripts/hooks/solde-ticket-guard.mjs` (`:676`, `:762`, `:855`, `:1103`), `scripts/guards/lib/stocksNominatifs.mjs`, `scripts/guards/lib/plageStock.mjs`, `scripts/guards/lib/commentPoison.mjs` (`:296-299`, `:411`), `scripts/guards/lib/lister.mjs`, `scripts/guards/lib/dialecte.mjs:25`, `scripts/guards/lib/revuePalier.mjs` (`:57`, `:71`), `scripts/git-hooks/pre-push.mjs` (`:142-145`, `:347-356`, `:391-393`), `scripts/gates/toutes.test.mjs:105-145`, `scripts/hooks/fermetures-sans-solde.test.mjs`, `scripts/hooks/stocks-nominatifs.test.mjs:414-447`, `.claude/settings.json:76`, `.github/workflows/ci.yml:12-13,116-117`, `src/ui/ui-ratchets.test.ts:1440-1610`, `src/ui/refus-au-survol.test.tsx`, `src/ui/CascadeTableMode.test.tsx:143-152`, `src/ui/CastModal.tsx:552`, `src/ui/ShantyModal.tsx:69-73`, `src/ui/jetProps/useDefenseJetProps.tsx:176-181`, `src/engine/conditions.ts:270-380`, `src/engine/ops.ts:1358-1600`, `src/data/overrides.ts:305-330`, `vite.config.ts:9,28`, `src/data/terrains.json`, `src/data/materials.json`, `src/data/schemas/grammaire/meta.ts:37,45`, `src/ui/compendium/registry.ts:2024`, `.claude/memory/feedback-sonder-la-ci-de-chaque-push-avant-d-enchainer.md`, `.claude/soldes/` (64 soldes), `Source/WH - V4 - Aux Armes/10 - L ARTILLERIE ET LES DEGATS INFLIGES AUX STRUCTURES.md`.
