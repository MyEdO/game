---
name: user-doctrine-campagne-json-portable-frontiere-reference-narratif
description: "Une campagne est un JSON portable : la règle globale vit dans src/data et se référence par id, l'histoire s'embarque dans le narratif du projet"
metadata:
  type: user
---

**Verbatim (2026-07-22)** : « Les campagne sont éditable et on doit pouvoir échanger un fichier json pour l'intégrer en local, ne l'oublie pas »

**How to apply :** ce qui vaut dans TOUTE campagne (créatures génériques, sorts, talents, carrières) vit dans `src/data` et se référence par id ; ce qui est propre à CETTE histoire s'embarque dans le narratif du projet (`src/state/campaignNarratif.ts`), jamais dans `src/data` ni au Compendium. Procédure : `.claude/skills/creer-une-campagne/SKILL.md`, section Narratif.
