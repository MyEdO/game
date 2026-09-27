---
name: env-eol-mutilees
description: "Jamais de cmdlet PowerShell d'écriture sur un fichier du repo : le CRLF qu'elle pose est invisible de l'état git et effondre silencieusement les parseurs"
metadata:
  node_type: memory
  type: reference
---

**Why:** `.gitattributes:5` (`* text=auto eol=lf`) garde l'INDEX en LF — une réécriture CRLF du working tree ne se voit donc pas à l'état git, mais les parseurs Markdown ancrés en fin de ligne rendent un chapitre entier en une section unique, sans erreur (suite rouge en local, verte au checkout propre).

**How to apply:** écrire les fichiers du repo par Write/node avec des sauts de ligne explicites ; diagnostic `git ls-files --eol` sur les chemins suspects (états `w/crlf`/`w/mixed` avec `i/lf`) ; toute lecture Markdown passe par le seam unique `readText` (`scripts/raw/_lib.mjs:26`) ; une suite rouge SANS diff visible se suspecte aux fins de ligne avant le code.
