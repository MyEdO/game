---
name: user-doctrine-verbatims-utilisateur-ticket-ou-fiche
description: "Les verbatims utilisateur vivent au ticket ou dans les fiches mémoire ; le contexte porte la consigne"
metadata:
  type: user
---

**Verbatim (2026-10-31, #3175)** : « evite mes verbatines dans les rules/skills et autres s'ul te plait. Ca pourri le contexte pour rien »

**Why :** les fichiers chargés en contexte portent des consignes ; répéter les paroles de l’utilisateur ajoute du poids à chaque lancement.

**How to apply :** conserver le verbatim et sa date au ticket ou dans une fiche `.claude/memory/user-*.md`. Règles, skills, agents et docs vivants gardent la consigne seule, avec au plus le nom de la fiche ou `#N`. Avant de retirer une citation, vérifier son porteur ; s’il manque, la conserver au ticket d’origine.
