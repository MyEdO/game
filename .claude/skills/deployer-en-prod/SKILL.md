---
name: deployer-en-prod
description: À utiliser quand l'utilisateur demande une mise en production, un déploiement, ou de publier le jeu sur cgauche.github.io/jeu — et UNIQUEMENT sur demande explicite.
---

# Déployer en production, ou en test

`deploy.yml` publie une cible, chacune dans le dossier du même nom de `cgauche.github.io` :

| Cible | Dossier | Ce qui part |
|---|---|---|
| `jeu` | https://cgauche.github.io/jeu/ | la prod : le jeu web (`npm run build`) |
| `dev` (défaut) | https://cgauche.github.io/dev/ | le test : l'export Web de l'hôte Godot et ses modèles (`construire.mjs --export`) |

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

## Suivre le run

Le run se suit par l'outil `Monitor`, que la garde `commande-piege` exige hors de l'interrupteur
`CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` (#2603) : `gh run watch <id> --exit-status > /dev/null; echo "deploy : code $?"`.
Puis vérifier le site du dossier publié.

Le secret Actions `PROD_DEPLOY_KEY` (dépôt `cgauche/game`) est la clé privée SSH dont la publique est
une deploy key en écriture sur `cgauche/cgauche.github.io` — un run qui échoue sur l'authentification
vient d'elle. GitHub refuse un fichier de plus de 100 Mo poussé sur `cgauche.github.io` : le pck de Godot ne porte
pas `modeles/` (`exclude_filter` de `hotes/godot/projet/export_presets.cfg`), servis à côté.
