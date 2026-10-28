# Sonde de classement des tests de `src/state` (#3058, lot 1)

Range chaque test du périmètre dans UNE classe, tirée du code par critères mécaniques, pour préparer la
descente des tests de règles de `src/state` vers le noyau (design v2.1 de #3058).

Périmètre : tout fichier de test (`.test.` dans le nom) sous `src/state`, plus tout test de `src/` ou `hotes/`
dont un arc d'import (type compris) vise `src/state`. Les tests de `src/ui` et `src/gameIso` sont classés et
marqués « renvoi #3059 ».

Même contrat que `scripts/ops/sondes/stratification-presentation/` : LECTURE SEULE, racine du dépôt par
`_socle.mjs`, arbre lu sur la révision (`listerImage`, `lireEnLot` de `gitPorte.mjs`), jamais sur la copie de
travail : la sortie se rejoue à l'identique sur un sha.

## Commande

Depuis la racine du dépôt :

```bash
node scripts/ops/sondes/classement-tests-state/sonde.mjs [<révision>]
```

Défaut `HEAD`. Révision introuvable ou argument en trop : code 2 et mode d'emploi. Le rapport (Markdown)
s'imprime sur la sortie standard ; un fichier non classé le suit sur la sortie d'erreur et donne le code 1.

## Critères

- **Arcs** : sites d'import de `sitesDeModule` (`scripts/guards/lib/importGraph.mjs`), résolus par
  `resolveImport` contre l'arbre de la révision et les alias de son `tsconfig.json` ; zone de chaque cible par
  `zoneDe` (`scripts/guards/lib/couches.mjs`). Un arc de type seul n'est pas un arc d'exécution.
- **Clés** : propriétés de `EtatDeLAdaptateur` et `ActionsDeLAdaptateur` (adaptateur) et de `GameState` hors
  adaptateur (jeu), lues par le vérificateur TypeScript (`repoProgram`) sur `src/state/store.ts`, les sources de
  la révision recouvrant le disque (les paquets se lisent sous `node_modules`). Une clé est lue par un test quand
  il la nomme en accès (`a.k`, `a['k']`), en déstructuration ou en clé d'objet littéral.
- **Procédure de `src/hote`** : liaison importée en valeur d'un module de `src/hote` (ni test ni banc).

## Classes

Dans cet ordre (`classer`, `classeur.mjs`) :

| Classe | Critère |
|---|---|
| `doublon` | importe une procédure de `src/hote` qu'un test hors store (`MOTIF_HORS_STORE`, `racinesDeLaSuite.mjs`) importe déjà (candidat, nommé avec ses tests hors store) |
| `moteur` | aucun arc d'exécution vers `src/state` |
| `mixte` | part web (clé de l'adaptateur lue, ou module de `src/state` hors store et hors banc `*.testkit.*`/`*.fixture.*` importé) et clé du jeu lue |
| `web` | part web seule |
| `noyau` | le reste : `src/state` importé par le store ou un banc, aucune part web |

La colonne `Base` donne la classe hors critère `doublon`. Aucun fichier ne reste sans classe : la dernière
classe prend le reste.

## Signaux et mesures annexes

- Minuteries : `useFakeTimers`, et l'horloge avancée (`advanceTimers*`, `runAllTimers`, `runOnlyPendingTimers`).
- Cadence `auto` : `initCombatAuto`, ou la chaîne `'auto'` dans un fichier qui écrit la cadence (`setCadence`,
  champ `cadence`, préférence `'combat-cadence'`).
- Comptes par classe et par zone du test.
- Citations : fichiers de `scripts/guards`, `docs/` et `src/**/*.json` qui citent un chemin
  `src/state/….test.<ext>`, avec le nombre de chemins distincts cités et ceux absents de l'arbre.

Les fonctions pures (`classeur.mjs`) sont testées par `classeur.test.mjs`, joué par `npm run test:ops`.
