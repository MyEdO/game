---
name: deployer-en-prod
description: À utiliser quand l'utilisateur demande une mise en production, un déploiement, ou de publier le jeu sur cgauche.github.io/jeu — et UNIQUEMENT sur demande explicite.
---
<!-- GENERATED: agents:sync; source=.claude/skills/deployer-en-prod/SKILL.md -->

# Déployer en production

Préconditions ABSOLUES :
- demande explicite de l'utilisateur ;
- suite complète verte ;
- le travail à publier est **COMMITTÉ ET POUSSÉ** sur `main` — le workflow build le commit distant,
  pas l'arbre local : ce qui n'est pas poussé ne part pas en prod.

Procédure :
```bash
gh workflow run deploy.yml --ref main
gh run watch                          # ou : gh run list --workflow=deploy.yml -L 1
```
Puis vérifier le site : https://cgauche.github.io/jeu/

Le secret Actions `PROD_DEPLOY_KEY` (dépôt `cgauche/game`) est la clé privée SSH dont la publique est
une deploy key en écriture sur `cgauche/cgauche.github.io` — un run qui échoue sur l'authentification
vient d'elle.
