# PALIER 5b5f44cbe..3c75c8f03 (2026-10-01)

verdict: PARTIEL

Fenêtre jugée : `5b5f44cbe..3c75c8f03`, 18 commits, 4 entrées first-parent : PR #2237 = #2227, PR #2238 et PR #2246 = chantier/1887-intervalles, PR #2247 = #2203 A2. Arbre épinglé `.wt-2203` (`git rev-parse HEAD` = `3c75c8f03ab2a0e6f59820b42c87eee324b95301`), seul écart : `A .claude/soldes/2203.md`, le solde stagé jugé ci-dessous.

## Synthèse du cumul

Trois chantiers. **#2203 A2** retire de git les 72 cibles pures de `GENERATORS`, désormais produites là où on les lit (postinstall `--code`, post-checkout/merge/rewrite, `ops:chantier`, conteneur) ; le lot a traversé quatre juges de diff (deux FRAGILE, deux RÉFUTÉ) et trois CI de branche rouges, toutes corrigées avant la file. **#1887** (autre session) pose `aligner`, `memeTexte`, `estSeparateur` et une garde AST sans table d'exceptions. **#2227** se ferme sur un commit de skills ; ses 10 tests `veillerLeTrain` sont verts à la tête.

Fermetures : #2227 TIENT. #2203 (stagée) FRAGILE : le fond tient (0 cible pure suivie à 3c75c8f03 contre 72 à 5b5f44cbe) mais le solde portait trois défauts de texte (preuve couvrant 39 cibles sur 72, reste renvoyé à #2187 qui n'en disait rien, `acc3041fb` affirmant « ferme » une faille BORNÉE à 30 min sans borne épinglée). Trouvailles de la revue précédente : G1 soldée, G2-G6 ouvertes et chacune portée, aucune aggravée.

## Fermetures

| # | commit fermant | DoD | solde | verdict |
|---|---|---|---|---|
| #2227 | `e03313025` (CI success ; Fermetures success sur 1336bdf50) | DoD 1-3 : tests `veillerLeTrain` (`publier.test.mjs:1523-1544, 1582, 1612` à e03313025, décalés à 1575-1596, 1634, 1664 à la tête), rejoués : 10/10, 0 skip. DoD 4 : `git grep -n "tail -n\|tail -F\|tail -f" -- .claude/skills docs .claude/memory ':!docs/plans'` → rc=1 | consigne du skill = accord utilisateur verbatim daté du 2026-10-01 | TIENT |
| #2203 (stagée) | à venir | voir ci-dessous | `.claude/soldes/2203.md` | FRAGILE |

### Réfutation de la fermeture de #2203 « Docs dérivés COMMITÉS vs fusion serveur »

- **DoD 1 — TIENT.** issuecomment-5904498640 (2026-09-30T05:08:36Z) consigne une délégation verbatim datée ; décision qualifiée d'« évaluation d'ingénierie révisable » (outillage, pas une règle de jeu). Aucun tag `[entériné]`.
- **DoD 2(a) — TIENT, preuve au mauvais périmètre.** La regex du solde ne retient que 39 des 72 cibles. Mesure juste par `estCiblePure` sur `git ls-tree` : **0 à 3c75c8f03, contrôle positif 72 à 5b5f44cbe** ; `build-all.mjs --cibles-pures` (72) ∩ `git ls-tree` = 0 ; `git check-ignore` 72/72.
- **DoD 2(b) — TIENT sur pièces partielles.** La mesure 49 s / 125 s n'était que dans le solde ; artefacts de `.wt-2233` présents, `git status` vide.
- **Invariant du design v2 — TIENT.** Galeries → #1321 (OUVERT, élargi) ; `*Compile.ts` ont `--check` (`scripts/rig/compile-dessin-quad.mts:59`, pre-commit `:330`) ; `agents:check` (`package.json:24`) ; `check-progression-schemas.mjs` dans `NON_GENERATOR_CHECKS` (`build-all.mjs:128`).
- **Reste « ops:chantier depuis l'arbre principal » → #2187 — RÉFUTÉ comme porté** : `gh issue view 2187 --comments | grep -i "chantier\|docs\|périm"` → 0 ligne.
- **`acc3041fb` — FRAGILE.** Sonde (processus étranger vivant) : verrou de 29 min → TENU, 31 min → LANCÉ, 2 jours → LANCÉ. Le verrou n'est jamais retiré à la fin du build (`bootstrap-conteneur.mjs:64-66`) : un pid recyclé dans les 30 min fait sauter le build jusqu'à `mtime + 30 min` — BORNÉ, pas fermé, non déclaré. Le test (`bootstrap-conteneur.test.mjs:262-280`) pose 3 jours : toute borne entre ~0 et 3 jours reste verte. `mesurerEnRendu` (`build-all.mjs:324-341`) : RAS. Tests du périmètre : 21/21.

## Classes, architecture à rebours, langue

- CLASSE « preuve de solde au périmètre plus étroit que la DoD » (regex 39/72) : aucune garde ne compare la sonde citée à l'ensemble nommé par la DoD.
- CLASSE « commit qui affirme FERMÉ ce qui est BORNÉ » (`acc3041fb`), voisine de G1.
- Cliquets justifiés au site (`ecrivainsAtteints.test.mjs` +6/+2/+2/−1 — sauf la ligne `// −1 le 2026-10-01 (#2203).` sans raison ; `depotGabarit.test.mjs` +3 déjà publié ; `docs-rebuild.test.mjs` +2 ; `plateforme-win32.test.mjs` +1 ; `PLAFOND_OCTETS` abaissé à 27195). Aucun `[entériné …]` ajouté.
- #1887 « Atlas v2 : une règle = un id et ses adresses dans le livre… » : garde `comparaisonDAppel` sans table d'exceptions, angle mort nommé et épinglé. Conforme.
- `conclureFusionSansChemins` (FOSSILE #2203) : écrivain borné aux chemins explicites, passe par `ecrire`. RAS.
- `.gitattributes` `docs/raw/**/*.md merge=docs-fiche-raw` couvre aussi des cibles ignorées : sans effet. RAS.
- Langue : « cible pure », « mixte », « rendre », « mesure rendue » constants.

## Défauts de la revue précédente

| G | état à 3c75c8f03 | preuve |
|---|---|---|
| G1 | SOLDÉ | d730fde3e |
| G2 | OUVERT, ticketé | #2226 « Compteurs de version dérivés de leur table » OPEN |
| G3 | OUVERT | `scripts/guards/lib/gitPorte.mjs:253,257` inchangée ; `conclureFusionSansChemins` passe par `ecrire`, couvert par la feinte |
| G4 | OUVERT | `.claude/skills/deployer-en-prod/SKILL.md:23`, `.agents/skills/deployer-en-prod/SKILL.md:24` (#2178 « Publication : file de fusion GitHub… » DoD 1) |
| G5 | OUVERT | corps de #2225 l.26 « sauté » |
| G6 | OUVERT, ticketé | `scripts/hooks/solde-ticket-guard.mjs:1499,1594,1636` → #2236 « Porte de palier : le nom d'archive prescrit… » OPEN |

## Affirmations d'absence

- « 0 cible pure suivie » : `estCiblePure` sur `git ls-tree -r` de 3c75c8f03 (7589 chemins) → 0 ; 5b5f44cbe → 72.
- « Aucune veille `tail` écrite à la main » : `git grep` ci-dessus → rc=1.
- « #2187 ne porte pas le reste » : grep des commentaires → 0 ligne.
- « Mesure 49 s/125 s absente du ticket » : grep des 13 commentaires de #2203 → 0 ligne de mesure.

## Trouvailles

- H1 — solde #2203 : preuve de DoD 2(a) par une regex couvrant 39 cibles sur 72.
- H2 — reste « ops:chantier depuis l'arbre principal » renvoyé à #2187 sans y être consigné.
- H3 — `acc3041fb` : « ferme le pid recyclé » est faux, faille bornée à 30 min (`scripts/hooks/bootstrap-conteneur.mjs:68,97`), limite non déclarée, borne non épinglée (`bootstrap-conteneur.test.mjs:268`).
- H4 — mesure d'ouverture de chantier absente du ticket.
- H5 — `scripts/gates/ecrivainsAtteints.test.mjs` : `// −1 le 2026-10-01 (#2203).` sans raison.
- H6 — audit npm (faits du palier, `auditStock` indisponible) : 11 écarts au stock dont `racine:brace-expansion` et `racine:undici` (high) hors stock, 9 advisories neuves sur `server:undici` ; porteur non vérifié.

Non jugé faute de temps : détail de `scripts/ops/etapesDuTrain.mjs`, `scripts/ops/publier.mjs`, `scripts/git-hooks/pre-commit.mjs` d'A2 (jugés par commits et CI) ; `src/data/source/decoupe.ts` et `scripts/source/derive-decoupes.mjs` de #1887 ; `npm test` non rejoué.

## Levée (orchestrateur, 2026-10-01)

H1, H3, H4, H5 levés par le commit de fermeture de #2203 qui porte cette revue ; H2 consigné sur #2187 (issuecomment-5923926501) ; H4 au ticket (issuecomment-5923928908) ; H6 consigné sur #1726 « Montée MAJEURE de la chaîne d'outillage… » (ticket de classe des advisories).
