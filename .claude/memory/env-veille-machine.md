---
name: env-veille-machine
description: "Gate EXPIRÉE à durée absurde (heures) ou Monitor muet pendant des heures : vérifier D'ABORD la veille de la machine (journal System, Kernel-Power 506/507) avant de chercher une contention ou un processus pendu."
metadata:
  node_type: memory
  type: project
---

**Règle :** une gate `EXPIRÉE` dont la durée se compte en heures, un agent « figé sans une ligne », un Monitor qui expire sans événement — simultanés dans plusieurs sessions — sont la signature d'une VEILLE de la machine, pas d'une contention ni d'un pendu. Pendant la veille aucun minuteur ne tire et aucun processus n'avance ; au réveil tout expire d'un coup (le minuteur de la gate tue le test : `exit 1`, durée = temps de veille).

**How to apply :** avant tout diagnostic, lire les événements de veille du jour :
```
Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=(Get-Date).Date} | Where-Object { $_.ProviderName -eq 'Microsoft-Windows-Kernel-Power' -and $_.Id -in 506,507 } | Select TimeCreated,Id
```
Fenêtre du « pendu » entre un 506 (entrée) et un 507 (sortie) → rien à corriger dans l'outil : rejouer (`--reprendre`) et prévenir aussitôt les sessions qui attendaient le push (l'ordre de publication convenu est périmé). Autre cause d'un Monitor muet : [[env-gates-serie-detachees]] (garde-mémoire du harnais).
