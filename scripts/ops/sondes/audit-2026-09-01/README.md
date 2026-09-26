# Sondes de l'audit 2026-09-01 (#1679)

Les mesures qui ont fondé l'audit du 2026-09-01 vivaient dans un dossier temporaire de session.
Elles sont ici, en LECTURE SEULE sur l'arbre, pour que chaque compteur du tableau de bord reste
RE-MESURABLE par une commande citée.

## Ce qu'est une sonde ici

- Elle ne modifie rien : ni le dépôt, ni GitHub. Tout ce qu'elle écrit va dans le **dossier de
  données**, passé en `argv[2]`, qui vit HORS du dépôt.
- Elle ne porte aucun chemin de machine : la racine du dépôt vient de `_socle.mjs`
  (`process.cwd()` si un `package.json` y est, sinon `git rev-parse --show-toplevel`).
- Lancée sans son dossier de données quand elle en a besoin, elle sort en code 2 avec son mode
  d'emploi et la liste des fichiers attendus.

Toutes les commandes ci-dessous se lancent **depuis la racine du dépôt**. `$D` désigne le dossier
de données.

## Fabriquer le dossier de données

Les dumps sont produits par `gh` (dépôt `cgauche/game`) et par `git`. Aucune sonde ne les fabrique
d'elle-même, sauf mention contraire.

| Fichier | Commande de (re)fabrication |
|---|---|
| `open.json` | `gh issue list --repo cgauche/game --state open --limit 3000 --json number,title,body,labels,createdAt,updatedAt,comments > $D/open.json` |
| `closed.json` | `gh issue list --repo cgauche/game --state closed --limit 3000 --json number,title,createdAt,closedAt > $D/closed.json` |
| `created.json` | `gh issue list --repo cgauche/game --state all --search "created:>=2026-08-20" --limit 1000 --json number,title,body,labels,state,createdAt,closedAt > $D/created.json` |
| `all.json` | `gh issue list --repo cgauche/game --state all --limit 3000 --json number,state,createdAt,closedAt > $D/all.json` |
| `issues-all.json` | `gh issue list --repo cgauche/game --state all --limit 3000 --json number,title,body,state,createdAt,closedAt > $D/issues-all.json` |
| `runs.json` / `runs300.json` | `gh run list --repo cgauche/game --limit 120 --json databaseId,name,conclusion,status,event,headBranch,headSha,createdAt > $D/runs.json` (idem `--limit 300` pour `runs300.json`) |
| `i1463.json` | `gh issue view 1463 --repo cgauche/game --json title,body,createdAt,comments > $D/i1463.json` |
| `iss_<N>.json` | `gh issue view <N> --repo cgauche/game --json number,body,closedAt,comments > $D/iss_<N>.json` |
| `adds.txt` | `git log --diff-filter=A --date=short --format="D=%ad" --name-only -- .claude/memory > $D/adds.txt` |
| `log1463.txt` | `git log --since=2026-08-23 --date=short --format="%h|%ad|%s" > $D/log1463.txt` |
| `failsteps.json` | PRODUIT par `brutes/c.mjs` |
| `logs/<runId>.txt` | PRODUIT par `brutes/d.mjs` (lit `failsteps.json`) |
| `cre.json` | PRODUIT par `p2-memoire.mjs` (lit `adds.txt`) |
| `dead.json` | PRODUIT par `p3-memoire.mjs` |
| `ages.json` | PRODUIT par `p1-memoire.mjs` |
| `pick.json` | PRODUIT par `an.mjs` |
| `closed_nums.txt` | PRODUIT par `brutes/a6.mjs` |
| `liste.txt` | PRODUIT par `brutes/m2.mjs` |

## Compteurs du tableau de bord

« Départ » = la valeur de l'audit du 2026-09-01. « L0 » = re-mesure faite au moment de la mise au
dépôt (arbre `2ada0b8ac`, dumps `gh` du 2026-09-01 ~21 h ; le lot est commité sur `d53b36c67`, qui
ne diffère de `2ada0b8ac` que par la vague `plage-en-tuple` et un fix de `cargo.ts`). Un écart entre
les deux colonnes sur un compteur GitHub est normal : le dépôt d'issues bouge, l'arbre non ; un
compteur d'ARBRE se re-mesure sur le sha courant, la valeur « L0 » date de `2ada0b8ac` sauf mention.

| Compteur | Sonde | Commande | Départ | L0 |
|---|---|---|---|---|
| Part de vert de la CI sur 7 j | `ci.mjs` | `node scripts/ops/sondes/audit-2026-09-01/ci.mjs` | ≈ 11 % | 23/200 = 11,5 % (177 rouges) |
| Pushes qu'un garde « run précédent vert » refuserait | `ci.mjs` | idem | — | 177/199 = 89 % |
| Durée médiane d'un run vert / rouge | `ci2.mjs` | `node scripts/ops/sondes/audit-2026-09-01/ci2.mjs` | — | 605 s / 100 s |
| Étapes d'un run vert ≥ 5 s | `steps.mjs` | `node scripts/ops/sondes/audit-2026-09-01/steps.mjs` | — | job `build` détaillé |
| Part gardes/stock/doc dans les rouges | `brutes/e.mjs` + `brutes/k2.mjs` | `node …/brutes/e.mjs $D` | 43 % | signatures par run (dépend du dump `logs/`) |
| Rouge HÉRITÉ du run précédent vs NEUF | `brutes/o.mjs` | `node …/brutes/o.mjs $D` | — | par run |
| Tickets ouverts | `an.mjs` | `node scripts/ops/sondes/audit-2026-09-01/an.mjs $D` | 923 | 923 |
| Tickets ouverts sans aucun label | `lab.mjs` | `node scripts/ops/sondes/audit-2026-09-01/lab.mjs $D` | 41 | 41 |
| Reproduction : enfants par ticket (≥ #1400) | `fanout.mjs` | `node scripts/ops/sondes/audit-2026-09-01/fanout.mjs $D` | 1,24 | 1,24 |
| Enfants par ticket FERMÉ depuis le 20/08 | `fanout.mjs` | idem | 4,25 | 4,25 |
| Soldes déclarant > 1 reste ROUTANT | `soldes.mjs` | `node scripts/ops/sondes/audit-2026-09-01/soldes.mjs` | #1548=17, #1457=11, #1553=7, #733=6, #541=6 | 25 soldes sur 52 (48 %), 119 restes routants, 37 usant « -> RAS : … » |
| Contournements du garde de labels | `sonde-bypass.mjs` | `node scripts/ops/sondes/audit-2026-09-01/sonde-bypass.mjs` | 9/9 | 9/9 passent (seul le témoin direct est refusé) |
| Réécritures de solde acceptées | `sonde-solde.mjs` | `node scripts/ops/sondes/audit-2026-09-01/sonde-solde.mjs` | 4/5 | 4/5 |
| Tests citant un doc, dont à cliquet | `frais.mjs` | `node scripts/ops/sondes/audit-2026-09-01/frais.mjs` | 35 dont 22 | 35 dont 22 |
| `readdirSync` dans `scripts/docs` | (grep) | `grep -rn "readdirSync" scripts/docs \| wc -l` | 47 | 47 |
| Skill `orchestrer-des-agents` : octets / part narrative | `classe.mjs` + `p6-artefacts.mjs` | `node scripts/ops/sondes/audit-2026-09-01/classe.mjs` | 33 413 o / 36 % | 32 074 o / 35,9 % |
| Vécus du skill sans fiche de mémoire | `p5-artefacts.mjs` | `node scripts/ops/sondes/audit-2026-09-01/p5-artefacts.mjs` | 5 | 5 (lignes `ABSENT`) |
| Fiches de mémoire INATTEIGNABLES depuis MEMORY.md | `p9-memoire.mjs` | `node scripts/ops/sondes/audit-2026-09-01/p9-memoire.mjs` | 12 | 12 (26 051 o) |
| Fiches `user-*` non liées | `p1-memoire.mjs` | `node scripts/ops/sondes/audit-2026-09-01/p1-memoire.mjs $D` | 8 | 9 |
| Épiques ouvertes muettes > 14 j | `brutes/agg.mjs` | `node …/brutes/agg.mjs $D` | 12/22 | 12/22 |
| Worktrees déclarés | `wt.mjs` | `node scripts/ops/sondes/audit-2026-09-01/wt.mjs` | 20 | 21 (le 21ᵉ est le worktree du lot) |
| Dossiers de `.claude/worktrees/` non déclarés | `wt.mjs` | idem | 10 | 10 (263,4 Mo) |
| Stashes | (git) | `git stash list \| wc -l` | 6 | 6 |
| Tickets ouverts citant un chemin DISPARU | `dead2.mjs` | `node scripts/ops/sondes/audit-2026-09-01/dead2.mjs $D` | — | 611 tickets citent un chemin, 65/1500 réfs mortes (4,3 %) |
| Doublons de titres (cos-idf > 0,42) | `dup2.mjs` | `node scripts/ops/sondes/audit-2026-09-01/dup2.mjs $D` | — | 10 paires |
| Tests réveillés par `--changed` (rayon de suite) | `graph3.mjs` | `node scripts/ops/sondes/audit-2026-09-01/graph3.mjs` | — | 1575 tests au total, médiane par commit |
| Coût d'un export intégral de l'index git | `mesure.mjs` | `node scripts/ops/sondes/audit-2026-09-01/mesure.mjs $D` | — | 6371 fichiers, 213 Mo (`checkout-index -a` sort 1 sur Windows : `Source/…` dépasse la limite de longueur de chemin) |
| Worktrees d'un niveau à setup fuyant | `probe-url-base.mjs` | `node scripts/ops/sondes/audit-2026-09-01/probe-url-base.mjs` | — | 3 (`.wt-1501`, `.wt-1624`, `.wt-1679-L0` — les seuls posés D'UN NIVEAU sous la racine principale) |
| Worktrees à `node_modules` vide | `probe-resolve.mjs` | `node scripts/ops/sondes/audit-2026-09-01/probe-resolve.mjs` | — | 5 fuient vers un AUTRE arbre, 1 ne résout rien (`Game-1456`) = 6 |
| `ex-Nom` en commentaire (corpus de la garde) | `sonde828b.mjs` | `node scripts/ops/sondes/audit-2026-09-01/sonde828b.mjs` | — | 0 (corpus 4119 sur `2ada0b8ac` avec les 99 sondes du lot, 4123 sur `d53b36c67` avec les 4 sondes de L1c ; 135 `guards/lib`, `commentPoison.mjs` scanné ; 4 017 avant l'entrée des sondes) |
| `gh issue close` hors garde de solde | `sonde-guard-fermetures.mjs` | `node scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs` | — | SILENCE (le même message en `git commit` rend DENY) |

## Sondes nommées

| Sonde | Ce qu'elle mesure |
|---|---|
| `frais.mjs` | tests de `src/**` citant un `docs/*.md`, et part porteuse d'un cliquet/plafond/stock |
| `ci.mjs` | CI de `main` : conclusions sur 200 runs, durée médiane, pushes qu'un garde « run précédent vert » refuserait |
| `ci2.mjs` | CI de `main` : durée médiane vert vs rouge, cadence de runs par jour |
| `steps.mjs` | décomposition d'un run CI vert : durée de chaque étape ≥ 5 s |
| `graph2.mjs` | graphe d'imports inverse `src`+`scripts` : tests reliés à huit fichiers-socles |
| `graph3.mjs` | rayon de la suite : tests que `vitest --changed` réveillerait sur les 60 derniers commits |
| `dup2.mjs` | doublons de tickets ouverts par similarité cosinus-idf des titres |
| `dead2.mjs` | tickets ouverts citant un chemin disparu de l'arbre |
| `an.mjs` | ancienneté des tickets ouverts et échantillon déterministe de 20 |
| `lab.mjs` | labels des tickets ouverts, et tickets sans aucun label |
| `wk.mjs` | cadence hebdomadaire créés/fermés sur 8 semaines |
| `refs.mjs` | tickets OUVERTS cités quelque part dans l'arbre suivi, par zone |
| `fanout.mjs` | reproduction des tickets : arbre de #1463, enfants par ticket fermé, taux global |
| `soldes.mjs` | fiches de `.claude/soldes/` : restes routants et « -> RAS : … » |
| `sonde-bypass.mjs` | contournabilité du garde de labels, sur son évaluateur RÉEL |
| `probe-label.mjs` | témoin court du même garde (quatre formes d'ouverture) |
| `sonde-solde.mjs` | contournabilité d'un plafond « ≤ 1 reste routant », sur le validateur RÉEL |
| `classe.mjs` | densité narrative du skill `orchestrer-des-agents`, par section |
| `mesure.mjs` | coût d'un export intégral de l'index git |
| `wt.mjs` | parc de worktrees : branche, MERGED/UNMERGED, WIP, avance, dossiers orphelins |
| `p*-artefacts.mjs` | artefacts du dépôt (mémoire, skill, hooks, agents) — cf. en-tête de chaque fichier |
| `p1..p9-memoire.mjs` | corpus `.claude/memory` (inventaire, frontmatter, atteignabilité, récidives) — cf. en-têtes |
| `j1..j9.mjs`, `ja.mjs` | dossier #1463 (commentaires, descendance, commits, pilotage) — cf. en-têtes |
| `probe-url-base.mjs` | fuite de `setupFiles` entre worktrees : l'ordre d'essai d'urls de vitest, worktree par worktree |
| `probe-resolve.mjs` | vers quel `node_modules` se résolvent `vitest`/`vite`/`typescript`/`tsx` depuis chaque worktree |
| `sonde828b.mjs` | stock de la famille TOMBSTONE d'ancien nom rappelé, sur le corpus RÉEL de la garde comment-poison |
| `sonde-guard-fermetures.mjs` | périmètre du garde de solde : `git commit` jugé, `gh issue close` hors champ |

## Sondes brutes (`brutes/`)

Sondes de travail des autres juges, portées telles quelles.

| Sonde | Ce qu'elle mesure |
|---|---|
| `a.mjs` | runs de `main` du dump `runs.json` |
| `a1.mjs` | tickets créés/fermés par jour depuis le 20/08 |
| `a2.mjs` | stock de tickets ouverts reconstitué à la fin du 30/08 et du 29/08 |
| `a3.mjs` | tickets créés depuis le 31/08 : labels, état, début de corps |
| `a4.mjs` | tickets créés depuis le 31/08 : décompte par label et titres |
| `a5.mjs` | tickets créés depuis le 30/08 : motifs de rattachement |
| `a6.mjs` | tickets fermés depuis le 30/08 |
| `a7.mjs` | tickets NEUFS cités au voisinage de chaque fermeture |
| `a8.mjs` | tickets récents qui sont des ENFANTS déclarés d'une fermeture |
| `a9.mjs` | tickets récents cités par un message de commit, et commits par jour |
| `a10.mjs` | tickets « Canari rouge » et dernier commentaire de #1548 |
| `a11.mjs` | section « Restes » du dernier commentaire de #1457, #1553, #1580 |
| `a12.mjs` | rattachement des tickets récents (vague nommée / enfant / commit), et rattachement NUL |
| `a13.mjs` | cardinal des listes de `structuresStock.mjs` commit par commit |
| `b.mjs` | CI `push` sur `main` : vert/rouge par jour |
| `c.mjs` | runs CI rouges récents : étapes en échec (produit `failsteps.json`) |
| `d.mjs` | téléchargement des journaux `--log-failed` des runs rouges |
| `e.mjs` | signature d'échec de chaque run rouge |
| `f.mjs` | lignes d'erreur dédupliquées de journaux donnés en argument |
| `g.mjs` | premières lignes `FAIL <fichier> > <test>` de chaque run rouge |
| `h.mjs` | pour chaque run rouge : commit, fichiers touchés, tests rouges, recouvrement |
| `i.mjs` | tests rouges groupés par TYPE d'erreur, pour des journaux donnés |
| `j.mjs` | fenêtre de 120 lignes autour de « Failed Tests » d'un journal donné |
| `k.mjs` | tests rouges, fichiers, signatures « wedge » par run |
| `k2.mjs` | idem, avec tests DÉCLARÉS vs comptés et étapes |
| `l.mjs` | couples (test rouge, première ligne d'erreur) par run |
| `m.mjs` | runs CI rouges plus anciens : deux par jour, étapes en échec |
| `m2.mjs` | fichiers suivis par zone, coût d'un export git SCOPÉ |
| `n.mjs` | part des commits de RÉPARATION et marqueurs cross-session |
| `o.mjs` | rouge HÉRITÉ du run précédent ou NEUF |
| `agg.mjs` | tickets ouverts : labels, âge, muets, épiques et leurs enfants ouverts |
| `cl.mjs` | tickets fermés : âge, durée de vie, cadence |
| `dead.mjs` | tickets ouverts citant un chemin disparu (variante sans le volet `docs/plans/`) |
| `dup.mjs` | doublons de titres par Jaccard de trigrammes |
| `pa.mjs` | mémoire : fiches créées après le 05/07, création jour par jour |
| `pb.mjs` | mémoire : fiches récentes indexées ou orphelines, fiches non suivies |
| `pc.mjs` | mémoire : octets/tokens de MEMORY.md et des fiches, noms de fiches proches |
| `pairs.mjs` | tickets ouverts nommés dans le script : labels, corps, références |
| `misc.mjs` | tickets ouverts : doc générée/stock/plafond, labels particuliers, outillage vs joueur |
| `rec.mjs` | tickets ouverts par cohorte : conformité de labels et marqueurs |
| `rest.mjs` | tickets ouverts : part née d'un reste/juge/recette, tickets muets |
| `samp.mjs` | échantillon déterministe (numéro multiple de 23) avec corps |
| `tax.mjs` | taxonomie des tickets ouverts par marqueurs de rédaction |
| `tri.mjs` | cohortes de triage des tickets ouverts |

## Écartées

- `graph.mjs` (juge du graphe d'imports) : sa détection d'imports reposait sur
  `new RegExp('(?:from|import)\\s*…')` écrit dans une chaîne SIMPLE — `\s` y vaut `s`, le motif ne
  reconnaissait donc aucun import et la sonde rendait 0 partout. `graph2.mjs` mesure la même chose
  avec un analyseur correct, sur les mêmes fichiers-socles : la version fausse n'entre pas au dépôt.
- `dbg.mjs` : trois lignes de mise au point de ce bug, sans mesure propre.

## Pourquoi tout est en ESM

Les sondes du juge des artefacts étaient écrites en CommonJS (`.cjs`). La configuration ESLint du
dépôt s'applique à `scripts/**` et y refuse `require()` (`@typescript-eslint/no-require-imports`,
`eslint.config.js`) : ces treize sondes sont donc entrées en ESM sous le nom `pN-artefacts.mjs`,
et le socle est un module UNIQUE, `_socle.mjs`.
