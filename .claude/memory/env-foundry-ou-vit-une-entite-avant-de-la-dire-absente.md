---
name: env-foundry-ou-vit-une-entite-avant-de-la-dire-absente
description: "wfrp4e — une entité (Trait, État, compétence, règle basculée) vit dans six endroits distincts ; conclure à son absence depuis une seule sonde est faux"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T21:20:19.215Z
---

Sur le monde Foundry, une entité vit dans **six** endroits sans rapport :

1. `game.wfrp4e.config.<famille>` (`conditions`, `magicLores`…) — les **Traits n'y sont PAS**.
2. `game.wfrp4e.config.systemEffects` — ex. *Besmirched*, absent de toute autre famille.
3. Les `Item` portés par les acteurs (un Trait = `Item` de type `trait`).
4. Les index de compendiums (`await pack.getIndex()`) — nom **VF** là, nom **VO** sur les acteurs.
5. Les textes de `config` (`effectScripts`, descriptions) qui la citent par `@Compendium`/`@UUID`.
6. Les macros de la bascule (`game.macros.contents`, dossier « Bascule 5e »).

**Why:** trois absences déclarées (*Besmirched*, *Distrayant*, « compétence » *Psychologie*) étaient fausses, et un chantier « à ouvrir » était déjà construit dans une macro :
« Tu as deja tout code mec ! »

**How to apply:** avant « n'existe pas » ou « reste à faire », balayer les six, nom VO **et** VF. Avant de dire qu'une règle manque de support, vérifier sa catégorie : un « Test de Psychologie » se passe avec Cool (`08 l.2195`). `5e — Verifier` garde que toute référence `@UUID` se résout. Voir [[env-foundry-un-champ-saffiche-a-plusieurs-endroits]], [[feedback-corriger-lexistant-jamais-construire-la-brique-absente]].
