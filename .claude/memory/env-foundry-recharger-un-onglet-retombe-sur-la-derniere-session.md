---
name: env-foundry-recharger-un-onglet-retombe-sur-la-derniere-session
description: "Foundry ne garde qu'une session par navigateur — recharger l'onglet MJ le reconnecte en joueur"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T12:40:08.412Z
---

Sur le monde `https://oli-vtt.anubis.one/game` piloté par Playwright, les deux onglets partagent la
même session Foundry. **Un `location.reload()` sur l'onglet MJ le reconnecte sous la dernière identité
utilisée** — c'est-à-dire le joueur de test. On perd alors les droits d'édition des macros, et
l'utilisateur doit reconnecter le MJ à la main.

Verbatim utilisateur, 2026-09-16 : « Oui, a chaque rafraichissement tu reviens en pesold. »

**How to apply:** ne jamais recharger l'onglet MJ. Pour vérifier qu'un patch se pose automatiquement
au chargement, recharger **l'onglet joueur** — c'est de toute façon la mesure qui compte. Avant toute
écriture de document, contrôler `game.user.isGM` : une macro `update()` échoue avec
« lacks permission to update Macro » si l'onglet a basculé.
