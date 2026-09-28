---
name: env-agents-figes
description: "Un sous-agent en arrière-plan peut se figer à vie (hook qui demande une permission, mort-né) : preuve de vie en premier geste et surveillance, jamais l'attente ni la lecture anticipée"
metadata:
  node_type: memory
  type: project
---

**Why:** cause la plus fréquente : un hook `PreToolUse` rend `permissionDecision: 'ask'` (`scripts/hooks/exception-add-guard.mjs`, `enterine-guard.mjs`, `memoire-tombale-guard.mjs`) — un agent de fond n'a personne pour répondre et reste « running » sans fin ; d'autres meurent mort-nés, transcript à 0 octet ; et un WIP mi-écrit produit des erreurs FANTÔMES prises pour des bugs.

**How to apply:** chaque agent écrit une PREUVE DE VIE (une ligne dans un `.log` du scratchpad) en PREMIER geste, surveillée vers 4 min — rien sur disque = `TaskStop` et relance immédiate ; tant que la notification de complétion n'est pas arrivée, son travail s'écrit encore : ne rien lire, greper, tester ni diagnostiquer de ses fichiers ; diagnostic d'un gel : comparer le `file_path` de l'appel pendu aux hooks qui demandent une permission, puis re-briefer le MÊME agent avec un design qui n'a rien à confirmer — jamais un contournement d'outil ou de nom ; un agent tué laisse ses écritures PARTIELLES (relire le diff, briefer le successeur sur ce qui est fait) ; toute attente d'un fichier porte un TIMEOUT.
