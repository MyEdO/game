---
name: deployer-en-prod
description: À utiliser pour déployer le jeu : en test (« déploie en test », cgauche.github.io/dev) ou en prod (cgauche.github.io/jeu, UNIQUEMENT sur demande explicite).
---

# Déployer en production, ou en test

`deploy.yml` publie une cible, chacune sur le site GitHub Pages de `cgauche` :

| Cible | Adresse | Ce qui part |
|---|---|---|
| `jeu` | https://cgauche.github.io/jeu/ | la prod : le jeu web (`npm run build`), dossier `jeu/` du dépôt `cgauche/cgauche.github.io` |
| `dev` (défaut) | https://cgauche.github.io/dev/ | le test : l'export Web de l'hôte Godot et ses modèles (`construire.mjs --export`), dépôt `cgauche/dev`, dont chaque déploiement remplace l'historique par un seul commit |

Le workflow build le commit DISTANT de la ref lancée, pas l'arbre local : ce qui n'est pas poussé ne part pas.

## Prod (`jeu`)

Préconditions ABSOLUES :
- demande explicite de l'utilisateur ;
- suite complète verte ;
- le travail à publier est **COMMITTÉ ET POUSSÉ** sur `main`.

```bash
gh workflow run deploy.yml -f cible=jeu
gh run list --workflow=deploy.yml -L 1   # l'id du run lancé
```

## Test (`dev`)

Ne touche pas `jeu/`. Se lance depuis `main`, ou depuis une branche poussée par `--ref <branche>`, pour tester
l'hôte Godot :

```bash
gh workflow run deploy.yml
gh run list --workflow=deploy.yml -L 1
```

Depuis un fil de projet cloud, sans `gh workflow` : l'outil GitHub `actions_run_trigger` (`run_workflow`, workflow
`deploy.yml`, la ref, `inputs: { cible }`).

## Suivre le run

Le run se suit par l'outil `Monitor`, que la garde `commande-piege` exige hors de l'interrupteur
`CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` (#2603) : `gh run watch <id> --exit-status > /dev/null; echo "deploy : code $?"`.
Puis vérifier le site du dossier publié.

Les secrets Actions de `MyEdO/game` `PROD_DEPLOY_KEY` et `DEV_DEPLOY_KEY` sont les clés privées SSH dont les
publiques sont des deploy keys en écriture sur `cgauche/cgauche.github.io` et `cgauche/dev` — un run qui échoue sur
l'authentification vient de celle de sa cible. GitHub refuse un fichier poussé de plus de 100 Mo : le pck de Godot ne porte
pas `modeles/` (`exclude_filter` de `hotes/godot/projet/export_presets.cfg`), servis à côté.
