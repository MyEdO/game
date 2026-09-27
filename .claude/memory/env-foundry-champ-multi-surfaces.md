---
name: env-foundry-champ-multi-surfaces
description: "wfrp4e — un champ de fiche s'affiche à PLUSIEURS endroits (chatData ET gabarit de la fiche) ; n'en corriger qu'un laisse le résidu visible"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T18:12:24.316Z
---

Dans wfrp4e, un champ d'objet a plusieurs surfaces de rendu indépendantes ; en corriger une laisse le défaut visible.

- `chatData()` (`wfrp4e.js` l.29343) : surchargeable via `CONFIG.Item.dataModels.<type>.prototype.chatData`.
- Gabarits `.hbs` (`actor-talents.hbs`) : `renderTemplate` gelé ; seule couture `BaseWFRP4eActorSheet.prototype._onRender`, nœuds de texte seulement (les `<a>` restent).
- `talent.Max` (Item) = affichage ; `talent.system.Max` (modèle) = porte d'achat.
- ActionsV2 clone `DEFAULT_OPTIONS.actions` à la construction : repointer aussi `actor._sheet.options.actions.<nom>.handler` et `foundry.applications.instances`.

**Why:** un contrôle d'une seule surface est vert pendant que la fiche ment ; relire la source réécrite ne prouve rien.

**How to apply:** avant de déclarer un champ 4e disparu, lister toutes ses surfaces (`chatData`, `.hbs`, colonnes, handlers), un contrôle par surface dans `5e — Verifier`, prouvé par un geste réel ensuite rétabli.

Voir [[env-foundry-effectscripts]], [[env-foundry-macro-execute]], [[feedback-5e-retirer-le-4e]].
