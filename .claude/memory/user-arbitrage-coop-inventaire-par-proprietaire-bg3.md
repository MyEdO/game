---
name: user-arbitrage-coop-inventaire-par-proprietaire-bg3
description: "Coop : chacun gère SON inventaire par des intents par propriétaire ; la vue reste partagée, un groupe scindé se joue en fils successifs"
metadata:
  type: user
---

**Verbatim (2026-07-19)** : « l'hôte ne doit pas pouvoir tout faire au marchand. Chacun gère SON inventaire au marchand. Un jour en mode coop l'hôte perdra son autorité et les personnages seront dissociés, donc pense dans cette optique dès maintenant, comme dans BG3. »

**How to apply :** toute surface qui touche inventaire, bourse ou possessions passe par des intents PAR PROPRIÉTAIRE (`intentAllowedFor`, `src/state/netOwnership.ts:675`) : seul le propriétaire aliène, l'hôte n'est qu'autorité technique. Un lieu raisonne sur les héros présents ICI ; la vue reste partagée (un siège sans héros est spectateur, jamais un écran cassé) ; un groupe scindé se joue en fils successifs (suspension de `src/state/cascade.ts`), jamais en fenêtres par siège.
