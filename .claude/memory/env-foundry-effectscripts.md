---
name: env-foundry-effectscripts
description: "wfrp4e — game.wfrp4e.config.effectScripts est indexé par l'id NU, et un script vide retombe sur la référence brute"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T14:06:34.633Z
---

Sur le monde `oli-vtt.anubis.one/game` (wfrp4e 9.3.2 / warhammer-lib), un effet peut porter la
référence littérale `[Script.<16 caractères>]` dans `system.scriptData[].script`. Elle est résolue
**à l'exécution**, jamais à la construction — remplacer l'entrée en mémoire change donc le
comportement de tous les talents qui la référencent, sans aucune écriture de document.

Deux pièges, tous deux découverts en mesurant et invisibles autrement :

1. **La clé est l'id NU.** `WarhammerScript._handleScriptId` extrait l'id par
   `/\[Script.([a-zA-Z0-9]{16})\]/` puis lit `systemConfig().effectScripts[id]`. Écrire dans
   `effectScripts["[Script.xxx]"]` crée une clé parasite et ne change **rien** — sans erreur.
2. **Un script « vide » ne doit pas être la chaîne vide.** Le resolveur finit par
   `return script || string` : `""` est *falsy*, donc il rend la référence brute `[Script.xxx]`,
   que le moteur évalue ensuite comme du JavaScript → `ReferenceError: Script is not defined`.
   Pour neutraliser un script, mettre un corps non vide : `"/* sans effet */"`.

Voir [[env-foundry-macro-execute]] pour l'autre faux vert de ce monde.
