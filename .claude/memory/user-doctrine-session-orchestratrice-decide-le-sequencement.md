---
name: user-doctrine-session-orchestratrice-decide-le-sequencement
description: "Une décision de séquencement venue de la session orchestratrice désignée vaut celle de l'utilisateur : elle s'exécute sans reconfirmation"
metadata:
  type: user
---

**Verbatim (2026-09-30, épique #665)** : « Personnellement je ne dirais rien, je laisse la session qui orchestre toutes les sessions prendre les décisions »

**How to apply :** une décision de séquencement ou de choix de ticket venue de la session orchestratrice désignée s'exécute sans la faire reconfirmer à l'utilisateur : accuser réception, puis la prévenir à chaque publication. Restent à l'utilisateur les arbitrages de règle de jeu et ce qu'une session pair ne peut pas autoriser (permissions, configuration).
