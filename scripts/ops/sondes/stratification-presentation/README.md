# Sonde de stratification de la présentation (#2792)

Range chaque fichier `.ts`, `.tsx`, `.css` de `src/state`, `src/ui` et `src/gameIso` dans UNE
catégorie du ticket #2792 (ce qu'un moteur de jeu tiers remplacerait), puis mesure par catégorie :

- les **lignes** au sens de `wc -l`, code et tests séparés (test = nom contenant `.test.`), par zone
  aussi ;
- le **churn** sur une fenêtre de jours : commits distincts qui touchent la catégorie, lignes
  ajoutées, supprimées, total.

Même contrat que les sondes de `scripts/ops/sondes/audit-2026-09-01/` : LECTURE SEULE sur l'arbre,
racine du dépôt par `_socle.mjs`, tout ce qu'elle écrit va dans le dossier de données.

## Commande

Depuis la racine du dépôt, `$D` étant un dossier EXISTANT hors du dépôt :

```bash
node scripts/ops/sondes/stratification-presentation/sonde.mjs $D [--jours 90] [--echantillon <n> --graine <g>]
```

Sans dossier, ou avec une option invalide : code 2 et mode d'emploi. Un fichier de `HEAD` qu'aucune
règle ne range, ou un chemin du journal de churn qu'aucune règle ne range : liste sur la sortie
d'erreur et code 1, rien n'est écrit.

La mesure porte sur l'arbre de `HEAD` (`git ls-tree`, contenus par `git cat-file --batch`), jamais sur
la copie de travail : elle se rejoue à l'identique sur un sha.

## Churn et garde d'histoire

Fenêtre : `--jours` jours AVANT la date de commit de `HEAD`, jamais avant « maintenant ».
`git log <sha> --no-merges --since=<borne> -M --numstat -- src/state src/ui src/gameIso`, filtré sur les
mêmes extensions. Un renommage compte sous son chemin destination ; un chemin absent de `HEAD`
(renommé depuis, supprimé) se range par les MÊMES règles et se compte, leur nombre est rendu. Les
lignes binaires du `--numstat` (`-`) sont ignorées et comptées à part.

Si le dépôt est superficiel et que son plus vieux commit accessible n'est pas antérieur à la borne,
la sonde sort en code 1 avec la commande qui approfondit (`git fetch --shallow-since=<date> origin
main`) : jamais un churn sous-compté en silence.

## Sorties (dans `$D`)

| Fichier | Contenu |
|---|---|
| `stratification.json` | sha, date du commit, borne, commandes, règles, totaux, par catégorie, par zone, recoupement, chemins historiques, et par fichier : catégorie, indice de règle, lignes, churn |
| `tableau.md` | par catégorie : fichiers, lignes code, lignes tests, commits, lignes modifiées, part des lignes de code ; plus la ligne des douteux et le total |
| `douteux.md` | même mesure par famille douteuse, puis la liste `fichier` + famille + raison |
| `ecarts-tests.json` | tests dont la catégorie n'est pas parmi celles des fichiers des trois zones qu'ils importent (imports relatifs résolus) |
| `echantillon.json` | avec `--echantillon n --graine g` : `n` fichiers tirés dans chaque catégorie et chaque famille douteuse, avec la règle qui les range |

Sur la sortie standard : `tableau.md`, puis le recoupement par zone (lignes code et tests, à
confronter à la commande `wc -l` du ticket), puis le compte d'écarts des tests.

## Règles

`regles.mjs` : `CATEGORIES` (les quatre catégories du ticket) et `REGLES`, liste ORDONNÉE dont la
PREMIÈRE règle qui correspond au chemin gagne. Une règle porte `motif`, `categorie` (un id de
`CATEGORIES`, ou `'douteux'` avec sa `famille`), `raison` et `preuve`. Ajouter une règle = ajouter une
ligne à `REGLES`, à son rang.

Les fonctions pures (`stratifier.mjs`) sont testées par `stratifier.test.mjs`, joué par
`npm run test:ops`.
