---
name: user-arbitrage-contenu-fan-sans-code-neuf
description: "Un contenu fan n'entre en mécanique que par la donnée et les ops existants : aucun code neuf pour lui"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (laurent, 2026-11-24, #4917) : « Je ne veux pas coder les traits qui ne sont pas officiels. »

Verbatim utilisateur (laurent, 2026-11-24, #4930) : « Pas de code supplémentaire pour du contenu fan sauf si ça se règle facilement avec nos ops existants »

**Why:** les livres fan (`bestiaire-non-officiel`, `guide-frenchy`) apportent des profils jouables, mais leurs règles propres ne justifient pas d'étendre le moteur.

**How to apply:** un Trait, un argument, une maladie ou une règle propre à un livre fan reçoit sa mécanique quand la donnée seule l'exprime : champs de mécanique, GameOp, Condition, Trigger, ou entrée neuve d'un registre existant. Sinon il reste au catalogue par son texte, sans effet en jeu, et rien ne se code pour lui sous `src/engine`, `src/noyau`, `src/hote` ni dans un schéma.
