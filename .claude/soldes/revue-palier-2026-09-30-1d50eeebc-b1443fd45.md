# PALIER 1d50eeebc..b1443fd45 (2026-09-30)

verdict: PARTIEL

Fenêtre jugée : `1d50eeebc..b1443fd45`. Le corps ci-dessous a jugé `1d50eeebc..392f432e6` plus l'index non committé (fermeture de #2180 : `.claude/soldes/2180.md`) ; le rebase du train a réécrit 392f432e6 et intercalé trois commits de #2132, jugés en « Complément ».

## Synthèse du cumul

19 commits, quatre chantiers : #2178 lot 2 (DEPOT), #2222 (collisions de compteurs, fermé par 57558d0b4), #2180 (canaux d'écriture lean-ctx), #2203 A1 (rendre / build-all). Le code publié tient (famille classée-ou-refusée, liste blanche par op, écrivain unique des docs). Mais UNE classe de défaut traverse #2180 et #2222 : l'invariant y est modélisé en recopiant à la main un comportement tiers (parseur lean-ctx, sémantique de l'historique git), et le design n'a convergé qu'après N passes de juge RÉFUTÉ (7 commits pour #2180, 4 pour #2222) — chaque passe fermait UN trou de la même classe. La fermeture de #2180 telle qu'indexée écrit « corrigé dans ce commit » pour trois restes dont le code n'est PAS dans le commit (il est resté dans l'arbre de travail non indexé). #2178 lot 2 annonce « une seule source (DEPOT) » mais les deux docs de routage lus par tout agent nomment encore `cgauche/game`. Enfin, la réfutation orchestrateur de la trouvaille « `gh run list --branch main` périmé » ne tient pas : l'API sert par intermittence un instantané figé au 2026-09-27T19:48:17Z, et les faits de CE palier en sont victimes (`coursesCi` vide pour 4 commits qui ont une course verte sur main).

## Fermetures

| # | commit | CI main avant fermeture | verdict |
|---|---|---|---|
| #2222 | `57558d0b4` | course 36720181296 success (13:14:12Z), `gh run list -R MyEdO/game` | CONFIRMÉ, réserve F5 |
| #2180 | index non committé | branche `chantier/2180` course 36725398154 success sur 392f432e6 — ne couvre PAS les correctifs non indexés | RÉFUTÉ en l'état (F1) |

## Q3 — `gh run list --branch main` périmé : la réfutation NE TIENT PAS

Ni la trouvaille d'origine (« ne rend RIEN au-delà du 2026-09-27T19:48Z ») ni sa réfutation (« pas périmé ») ne sont exactes : le fait mesuré est une STALENESS INTERMITTENTE. Mesures du 2026-09-30 15:00-15:20Z, mêmes arguments que `coursesCi({limit:300, workflow:null})` : 2 appels sur 13 (spawnSync depuis node) rendent n=300, max createdAt = `2026-09-27T19:48:17Z`, sans la course de `760107191` ; les 11 autres rendent max = `2026-09-30T14:13:36Z`. Le fichier de faits `faits-1d50eeebc-HEAD.json` (écrit 15:00:27Z) rend `courses: []` pour 5f0be6941, 57558d0b4, 3e7ecda54, 925dde2c5, alors que `gh run list -R MyEdO/game --branch main` rend pour eux les courses 36724006823, 36720181296, 36718537409, 36714843858, toutes `success`, toutes créées avant 15:00Z. L'instrument a lu l'instantané figé ; son commentaire (`scripts/ops/faits-de-palier.mjs:186-188`) avoue que `[]` est « indiscernable d'un commit jamais couru ». `scripts/guards/lib/coursesCi.mjs:17-18` connaît déjà la classe (« une liste PÉRIMÉE puis sa relecture (session #1508) ») ; `faits-de-palier` ne l'applique pas.

## Architecture à rebours (Q2)

- `OPS_CTX_PATCH` : OUI sur le fond (liste blanche fermée par op, refus par défaut — la forme cible ; elle aurait dû être le lot 1, pas la passe 7). Défaut de forme : la version épinglée du binaire (« 3.10.2, tag d4f9beb3f ») est récitée en 5 endroits sans contrôle mécanique (F3).
- `refusDesCompteurs` : NON, il n'existerait pas. En partant de zéro, le compteur est DÉRIVÉ de sa table indexée par version (`EXPORT_VERSION` a déjà `ROSTER_MIGRATIONS: MigrationMap`, `src/state/roster.ts:172`) : deux branches qui ajoutent la même clé produisent un conflit git ou une clé dupliquée dans un littéral objet (TS1117) — la collision devient un fait STRUCTUREL de l'arbre fusionné, pris au typecheck, sans archéologie git, sans angle mort (S9), sans faux positifs assumés (S10/S11/Q6), sans précondition de file de fusion (F4).
- `rendre()`/`build-all` : OUI (rendu pur + écrivain unique = forme canonique ; `git grep writeFileSync` sur `scripts/docs/gen-*`/`build-*` → seul `build-all.mjs`). A1 est une étape cohérente vers A2. Écart mineur : le message de 10f99fb51 annonce que `build-all.d.mts` expose `rendreCible`/`generateurDe` ; le fichier ne déclare que `rendreCible` (`scripts/docs/build-all.d.mts:1`).

## Gardes neuves et exceptions

- `COMPTEURS` (`scripts/guards/lib/compteursDeVersion.mjs:8-12`, CLIQUET +2 puis +1) : registre de déclaration, pas une exception — JUSTIFIÉ ; classe du faux positif suivie par #2188 (OUVERT).
- `CLIQUET: scripts/hooks/data-edit-guard.test.mjs +1` (e6f8183eb) : re-clé à nombre d'entrées constant — JUSTIFIÉ.
- Aucun tag `[entériné …]` ajouté dans le cumul. Aucune garde neuve n'en contredit une autre (`canal-outil` remplace `canal-ecriture`, supprimé dans le même commit 492f82f71).

## Trouvailles

- F1 (BLOQUANT) — fermeture #2180 : « corrigé dans ce commit » sans les lignes (code non indexé ; reste 2 attribué à ce commit au lieu de 2660dfcae ; VERIFIE cite la course de 392f432e6).
- F2 (BLOQUANT pour l'instrument) — `scripts/ops/faits-de-palier.mjs:192` lit une liste de courses périmée sans la détecter.
- F3 — version de lean-ctx récitée en 5 endroits sans contrôle (`contratGarde.mjs:35`, `:168` ; `canal-outil-guard.mjs:4` ; `canal-outil-guard.test.mjs:2` ; `new-src-file-guard.mjs:24`), chemin d'hôte en `contratGarde.mjs:35`.
- F4 — `refusDesCompteurs` est une garde de synchronisation là où une dérivation suffit.
- F5 — l'angle mort S9 de #2222 « Compteurs de version (SAVE_VERSION, SCHEMA_PROJET) : deux chantiers parallèles montent à la même valeur sans conflit git — refuser la publication » est classé RAS en invoquant la lentille utilisateur, alors qu'il est vivant tant que la file de fusion n'est pas posée.
- F6 — la « source unique » de #2178 lot 2 n'atteint pas `CLAUDE.md:14`, `AGENTS.md:15`, `src/i18n/index.ts:2`.
- F7 — classe répétée : comportement tiers modélisé par énumération (7 passes pour #2180, 3 designs pour #2222).

## Note de l'orchestrateur (2026-09-30)

- F1 : artefact de séquence. Le hook de palier a bloqué la commande ENTIÈRE avant le `git add` des 6 fichiers ; le commit de fermeture les porte. Le solde est corrigé : le reste 2 cite 2660dfcae, et VERIFIE renvoie à la CI de branche du commit de fermeture, jouée par le train.
- F2 : dans le lot 3 de #2178 (migration de `faits-de-palier.mjs:192`, lecture par sha, liste périmée → « indisponible »). La trouvaille de la revue précédente est RÉTABLIE comme intermittente ; ma réfutation ne tenait pas.
- F3 : corrigée dans le commit de fermeture de #2180 (constante unique `LEAN_CTX_VERSION`, test `--version`).
- F4 : #2226 « Compteurs de version dérivés de leur table : la collision devient structurelle, refusDesCompteurs disparaît ». Nuance mesurée : `SAVE_VERSION` n'a pas de table de migrations, son historique est en commentaire.
- F5 : routée sur #2178 (issuecomment-5914137574), S9 se ferme à la pose de `merge_queue`.
- F6 : `src/i18n/index.ts:2` dans le lot 3 de #2178. `CLAUDE.md:14` et `AGENTS.md:15` sont signalés à l'utilisateur (édition de CLAUDE.md réservée).
- F7 : consignée en mémoire (`feedback-outil-tiers-forme-fermee-d-emblee`).

## Complément (2026-09-30) — ré-ancrage sur la tête publiée, commits de #2132 intercalés

verdict: CONFIRMÉ

`git merge-base --is-ancestor b1443fd45 HEAD` → 0, idem contre `origin/main`. La fenêtre `1d50eeebc..b1443fd45` compte 24 commits étiquetés #2180, #2222, #2178, #2203 ou #2132 ; les seuls commits #2132 sont `31ec98c60`, `b9654f6c3`, `760107191`.

- `b9654f6c3`, `760107191` (fusions) : `git show --remerge-diff --stat` ne rend que des dérivés et la résolution de `scripts/hooks/registre.mjs` (union exacte des deux côtés) et de `scripts/docs/build-reprise.mjs` (forme de 5f0be6941, commentaire à jour). Aucune substance.
- `31ec98c60` passe par les contrats canoniques (`trace` de `contratGarde.mjs`, `segmentsProfonds`, `HOOKS_DE_SESSION`, ancien nom purgé). Quatre mineurs, aucun bloquant, portés au ticket #2132 :
  - C1 — `plafonner` (`scripts/ops/suivi.mjs`) : quand la part d'un digest est plus courte que la ligne de fin, le résultat dépasse sa part et perd l'en-tête ; sonde : 150 épiques → total 12041 pour un plafond de 8000, 0/150 en-têtes.
  - C2 — `suivi-lien-guard.mjs:59-69` trace le lien en PreToolUse : une commande refusée ou en échec lie quand même la session.
  - C3 — « lot 2 » dans `inject-suivi.mjs:1`, `suivi-lien-guard.mjs:1`, `suivi.mjs:35` : généalogie de chantier en commentaire.
  - C4 — `DATE_DE_ZONE` re-parse la phrase de `lignesDeLaZone` : deux sources du format de date.
- CI : `760107191` course success sur main (14:13:36Z) ; `31ec98c60` et `b1443fd45` couverts par la course de la tête de leur push.
