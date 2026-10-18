---
name: user-arbitrage-editeur-heros-par-emplacement
description: "L'éditeur ne désigne jamais un héros par identité : le groupe se pré-asseoit ou se pré-poste par EMPLACEMENT (Héros 1..N)"
metadata:
  type: user
---

**Verbatim (2026-08-21)** : « c est par emplacement de heros qu on parle »

**How to apply :** aucune donnée authorée ne désigne un héros par identité ; un membre du groupe se pré-asseoit ou se pré-poste par EMPLACEMENT (`SeatOccupant` `{ kind: 'party', rang }`, `src/state/seating.ts:53`), résolu au runtime sur le rang, un rang sans héros élagué au chargement. Toute clause d'authoring qui touche le groupe se confronte à la question : l'éditeur peut-il le connaître ? Sinon elle se refuse, et le refus se dit.
