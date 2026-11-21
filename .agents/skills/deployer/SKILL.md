---
name: deployer
description: Déployer le jeu en test (« déploie en test », /dev) ou en prod (/jeu, UNIQUEMENT sur demande explicite) ; fabriquer l'exécutable de bureau.
---
<!-- GENERATED: agents:sync; source=.claude/skills/deployer/SKILL.md -->

# Déployer en test ou en production

`deploy.yml` publie une cible, chacune sur le site GitHub Pages de `cgauche` :

| Cible | Adresse | Ce qui part |
|---|---|---|
| `jeu` | https://cgauche.github.io/jeu/ | la production : l’export Web Godot et ses modèles, dans le dossier `jeu/` du dépôt `cgauche/cgauche.github.io` |
| `dev` (défaut) | https://cgauche.github.io/dev/ | la version de développement : l’export Web Godot et ses modèles, à la racine du dépôt `cgauche/dev` |

Les deux cibles construisent l’export Godot par `npm run godot:web`.
Le workflow se déclenche manuellement et construit le commit distant de la ref demandée.
La commande produit `dist/godot/index.html`, `dist/godot/index.pck` et les ressources de l’export. Elle permet de les vérifier sans lancer le workflow.

## Prod (`jeu`)

Préconditions ABSOLUES :
- demande explicite de l'utilisateur ;
- suite complète verte ;
- le travail à publier est **COMMITTÉ ET POUSSÉ** sur `main`.

```bash
gh workflow run deploy.yml -f cible=jeu
gh run list --workflow=deploy.yml -L 1   # l'id du run lancé
```

## Développement (`dev`)

Ne touche pas `jeu/`. Se lance depuis `main`, ou depuis une branche poussée par `--ref <branche>`, pour tester
l'hôte Godot :

```bash
gh workflow run deploy.yml
gh run list --workflow=deploy.yml -L 1
```

Depuis un fil de projet cloud, sans `gh workflow` : l'outil GitHub `actions_run_trigger` (`run_workflow`, workflow
`deploy.yml`, la ref, `inputs: { cible }`).

## Exécutable de bureau

`bureau.yml` fabrique l'exécutable de bureau de l'hôte Godot sous Linux et sous Windows (`npm run godot:bureau`, qui lui
fait jouer une partie) et garde le dossier de chaque plateforme en artefact du run (`bureau-windows-latest`,
`bureau-ubuntu-latest`), à télécharger depuis la page du run. Il ne publie rien : aucun accord à demander. Le dossier
porte sous `licences/` l'avis de licence de chaque œuvre tierce embarquée (Godot, Node, paquets npm des bundles,
polices), tiré de sa source par `hotes/godot/avis.mjs` ; l'export Web le porte aussi. Un avis qui manque fait échouer
la fabrication.

```bash
gh workflow run bureau.yml
gh run list --workflow=bureau.yml -L 1
```

Depuis un fil de projet cloud : `actions_run_trigger` (`run_workflow`, workflow `bureau.yml`, la ref), puis
`actions_list` (`list_workflow_run_artifacts`) pour le lien de l'artefact.

## Suivre le run

Le run se suit par l'outil `Monitor`, que la garde `commande-piege` exige hors de l'interrupteur
`CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` (#2603) : `gh run watch <id> --exit-status > /dev/null; echo "deploy : code $?"`.
Puis vérifier le site du dossier publié.

Les secrets Actions de `MyEdO/game` `PROD_DEPLOY_KEY` et `DEV_DEPLOY_KEY` sont les clés privées SSH dont les
publiques sont des deploy keys en écriture sur `cgauche/cgauche.github.io` et `cgauche/dev` — un run qui échoue sur
l'authentification vient de celle de sa cible. GitHub refuse un fichier poussé de plus de 100 Mo : le pck de Godot ne porte
ni `modeles/` (`exclude_filter` de `hotes/godot/projet/export_presets.cfg`), ni les dossiers de `PAQUETS_DU_WEB`
(`hotes/godot/construire.mjs`, #4402), servis à côté. Mesurer les fichiers de sortie après l’export pour vérifier la limite avant publication.
