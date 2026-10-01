# PALIER b1443fd45..5b5f44cbe (2026-10-01)

verdict: CONFIRMÉ

Fenêtre jugée : `b1443fd45..5b5f44cbe`, 25 commits, tête publiée (`git rev-parse origin/main` → `5b5f44cbe375d3d379e38b8f375da25ca7b74840`). Mesures faites dans l'arbre `.wt-2227` (`git log --oneline -1` → `5b5f44cbe Merge pull request #2232` ; `git merge-base --is-ancestor 5b5f44cbe HEAD` → 0), qui porte un WIP non committé de #2227 (CLAUDE.md, AGENTS.md, 4 SKILL.md), sans aucun fichier sous `scripts/`.

## Synthèse du cumul

Cinq chantiers dans la fenêtre : #2180 (queue : knip), #2178 lot 3 (file de fusion GitHub, fermetures par check-runs requis), #2132 lots 3 et 4 (fermé), #2227 (`ops:publier --veiller`, en cours) et la classe « rouge sous win32 » (#2225, qui porte les instances #2114, #2151 et #2191 ; les quatre sont fermées).

Les cinq fermetures TIENNENT. Chaque « corrigé dans ce commit / par <sha> (f:l) » des soldes tombe dans un hunk du commit cité (12 sur 12, sonde ci-dessous). Les suites promises vertes, rejouées sous win32 : 147/147 sur les six fichiers des tickets, `test:ops` 486/486, 0 skip.

Une CLASSE de défaut traverse l'historique et se solde dans cette fenêtre. Le 2026-09-12, `c5b42b3f0` avait vu le défaut « verbe de fermeture unique devant plusieurs numéros » (f4a9fa5da laissait #1708 ouvert) et l'avait classé « angle mort DIT au JSDoc (choix) », sans garde. Le défaut est revenu le 2026-09-30 : 92f57ea33 a laissé #2114, #2151 et #2191 ouverts. La garde n'est arrivée qu'à cette récidive (`numerosNusEnumeres`, d730fde3e). Leçon de régime : un angle mort connu d'une porte se garde au moment où on le voit, jamais seulement par une ligne de JSDoc.

Défauts de la revue précédente : F1, F2, F3 soldés, F6 en partie (`src/i18n/index.ts:2`) ; encore ouverts, tous ticketés : F4 (#2226), F6 (`CLAUDE.md:14`, `AGENTS.md:15`, `.claude/skills/deployer-en-prod/SKILL.md:23`, DoD 1 de #2178), F5 (fermé en pratique par le step de file, le fond porté par #2226).

Réserve d'architecture : la feinte de git (`WFRP_GIT_FEINT`) est une couture de test lue par le code de PRODUCTION `interroger`, et elle couvre aussi les écrivains.

## Fermetures

| # | commit fermant | DoD | solde | verdict |
|---|---|---|---|---|
| #2132 | `0dc18dd56` (CI success) | 5 points : 3 tenus au code, « Hook de rappel » retiré par un verbatim utilisateur daté 2026-09-30 consigné au ticket (issuecomment-5914262004), rodage NATIF cité | 5 « corrigé dans ce commit » tous dans un hunk de 0dc18dd56 | TIENT |
| #2225 | `92f57ea33` (couvert par 3683e711e success puis b75176ef0 success, Fermetures success) | DoD 1 : rejoué vert sous win32, CI Linux verte. DoD 2 : `pathToFileURL`. DoD 3 : AMENDÉ au solde (jonction au lieu d'un saut). DoD 4 : `rougeDuGenerateur` importé par `scripts/docs/lib/plateforme-win32.test.mjs:16,86-87` | 3 « corrigé dans ce commit » dans un hunk de 92f57ea33 ; « git hors interroger » → #2073 | TIENT, réserve : DoD 3 amendé au solde seulement |
| #2114 | `d730fde3e` (CI success) | DoD 1 : driver vert sous win32 (rejoué), CI verte. DoD 2 : garde SURCHARGE_DE_PATH (AST), `scripts/guards/lib/depotGabarit.test.mjs:439-466`. DoD 3 : mutation deny→ask citée au solde, non rejouée (hors rôle du juge) | 2 « corrigé par 92f57ea33 » et 1 « dans ce commit » (`solde-ticket-guard.mjs:1601`), toutes dans leur hunk | TIENT |
| #2151 | `d730fde3e` | vert sous win32 (rejoué) ; cause nommée (le BANC) | RAS | TIENT |
| #2191 | `d730fde3e` | vert sous win32 (rejoué) ; classe sondée (`git grep ENAMETOOLONG`), sonde collée au solde | RAS | TIENT |

Sonde des lignes des soldes (`git diff -U0 sha^1 sha -- f`, la ligne l tombe-t-elle dans un hunk `+s,n`) :
```
92f57ea33 scripts/docs/lib/plateforme-win32.test.mjs:140 -> IN-HUNK +136,5
92f57ea33 scripts/docs/lib/plateforme-win32-hooks.mjs:35 -> IN-HUNK +32,8
92f57ea33 scripts/guards/lib/depotGabarit.test.mjs:396 -> IN-HUNK +384,45
92f57ea33 scripts/hooks/solde-ticket-guard.mjs:2873 -> IN-HUNK +2873,1
92f57ea33 scripts/hooks/poison-postcheck.test.mjs:160 -> IN-HUNK +160,1
d730fde3e scripts/hooks/solde-ticket-guard.mjs:1601 -> IN-HUNK +1601,12
0dc18dd56 scripts/hooks/inject-suivi.mjs:80 -> IN-HUNK +80,2
0dc18dd56 scripts/ops/suivi.mjs:330 -> IN-HUNK +328,4
0dc18dd56 scripts/hooks/suivi-lien-guard.mjs:76 -> IN-HUNK +75,2
0dc18dd56 scripts/hooks/inject-suivi.mjs:1 -> IN-HUNK +1,1
0dc18dd56 scripts/ops/suivi.mjs:201 -> IN-HUNK +197,15
e4b4256b0 scripts/ops/suivi.mjs:77 -> IN-HUNK +76,2
```

Rejeu sous win32, arbre `.wt-2227` à 5b5f44cbe : `node --test` sur plateforme-win32.test, solde-ticket-guard-driver.test, etapesDuTrain.test, gitPorte.test, depotGabarit.test, fermetures.test → 147/147, 0 skip ; `npm run test:ops` → 486/486 ; `npm run test:hooks` → 1629/1630, l'unique rouge (`budget-contexte.test.mjs:68`, plafond mou 27196 contre 27198) vient du WIP de #2227 (CLAUDE.md −2 octets), la CI de 5b5f44cbe est verte.

## Classes, architecture à rebours, langue

- CLASSE soldée : un angle mort de porte déclaré au lieu d'être gardé (c5b42b3f0, 2026-09-12, revenu dans 92f57ea33) ; garde `numerosNusEnumeres` (`scripts/guards/lib/fermetures.mjs:56`, refus `scripts/hooks/solde-ticket-guard.mjs:1601`). Les 5 autres occurrences historiques sont fermées (#1708, #795, #360, #115, #116 CLOSED).
- Trois commits de branche rouges en CI puis corrigés (0029a361f, 5624326a0, cbe73bafb) : conforme au régime « gates au train ».
- `WFRP_GIT_FEINT` (`scripts/guards/lib/gitPorte.mjs:253`, lu en `:297` par `interroger`, donc par `ecrire` en `:323`) : en partant de zéro l'injection passerait par `depotDe({ spawn })` (`gitPorte.mjs:236`) ; la variable ne se justifie que pour les tests du DRIVER en processus enfant. Réserve, pas grief.
- `refusDesCompteurs` gagne un site (`scripts/ops/compteurs-de-file.mjs:30`, step « Compteurs de version de la file » de `ci.yml`) : garde de synchronisation portée par #2226 (OUVERT).
- `fermetures.yml` lisant les check-runs requis (`scripts/ops/checks-requis.mjs`) est la forme juste sous file de fusion.
- Langue : un terme par concept (« feinte », « file », « veille »).

## Défauts de la revue précédente

| F | état à 5b5f44cbe | preuve |
|---|---|---|
| F1 | SOLDÉ | hors fenêtre |
| F2 | SOLDÉ | `coursesDeLaFenetre` (`scripts/ops/faits-de-palier.mjs`, 1789c640a) rend `indisponible` sur une liste périmée |
| F3 | SOLDÉ | constante unique `LEAN_CTX_VERSION` ; test `--version` sauté nommément en CI (0029a361f, `knip.json`) |
| F4 | OUVERT, ticketé | #2226 « Compteurs de version dérivés de leur table » ; aggravé d'un site |
| F5 | FERMÉ EN PRATIQUE | la file sérialise, le step de file juge `G^2` contre `G^1` |
| F6 | PARTIEL | `src/i18n/index.ts:2` → MyEdO (1789c640a) ; restent `CLAUDE.md:14`, `AGENTS.md:15` (corrigés par le commit de #2227 qui porte cette revue), `.claude/skills/deployer-en-prod/SKILL.md:23`, `.agents/skills/deployer-en-prod/SKILL.md:24` (#2178 DoD 1) |
| F7 | consigné en mémoire | hors code |

## Affirmations d'absence

- « Aucune surcharge de PATH hors `scripts/` » : `git grep -nE "\bPATH\b\s*[:=]|\[.PATH.\]\s*=" -- src server '*.test.*' ':!scripts'` → 0 ligne, arbre de 5b5f44cbe.
- « Commits historiques à fermeture énumérée » : `numerosNusEnumeres` sur chaque commit de `git log 5b5f44cbe` (5385) → 6 commits (92f57ea33, f4a9fa5da, e107ae3bb, 24057bd50, f42a6d35d, ea3d42569), tickets orphelins tous CLOSED.
- `SURCHARGES_HORS_CLASSE` (`scripts/guards/lib/depotGabarit.test.mjs:433-437`, 3 entrées au site, raison par entrée) JUSTIFIÉE ; `CLIQUET … depotGabarit.test.mjs +5` (f8668997a) ramené à 3 par 92f57ea33 JUSTIFIÉ. Aucun tag `[entériné …]` ajouté. L'édition du credo (1789c640a) cite « Je t'autorise a modifier le credo » (utilisateur, 2026-09-30).

## Trouvailles

- G1 — garde de fermeture énumérée arrivée à la 2e occurrence d'un angle mort déclaré 18 jours plus tôt (soldée par d730fde3e).
- G2 — `refusDesCompteurs` gagne un site → #2226 « Compteurs de version dérivés de leur table ».
- G3 — `WFRP_GIT_FEINT` honorée par le chemin écrivain `ecrire` (`scripts/guards/lib/gitPorte.mjs:285,297,323`) : une règle `si: []` répond à TOUT git, écritures comprises.
- G4 — F6 non soldé à la tête (voir ci-dessus).
- G5 — DoD 3 de #2225 amendé au solde seulement, le corps du ticket garde « sauté ».
- G6 — `scripts/hooks/solde-ticket-guard.mjs:1497-1499` (JSDoc de `validateRevuePalier`) : nom `revue-palier-<date>-<base>.md` périmé (la tête manque) et `verdictDeNom` inexistant ; même nom périmé prescrit par les messages de la porte (`:1594`, `:1636`).

Non jugé faute de temps : le diff détaillé de `scripts/ops/publier.mjs` (+528) et `scripts/ops/etapesDuTrain.mjs` (+571) de #2178 lot 3 et #2227, jugé par les messages de commit et `test:ops` vert ; la DoD 3 de #2114 (mutation deny→ask), non rejouée.
