---
name: feedback-toute-donnee-de-scene-editable-sans-ia
description: "Toute donnée de scène s'édite au clic dans l'éditeur ; un champ lu par le moteur et non écrit par l'éditeur est une dette immédiate"
metadata:
  node_type: memory
  type: feedback
---

Arbitrage utilisateur (2026-07-26, verbatim) : « Assure toi toujours qu'on doit pouvoir éditer toutes
les données de la scene, on ne doit pas dépendre d'une IA ». Tout lot touchant la Scène se clôt sur
« l'auteur peut-il créer, modifier ET supprimer cette donnée au clic ? » — sinon le lot est
incomplet. Un champ ajouté au schéma arrive avec son champ d'inspecteur ou son outil de palette dans
le MÊME lot ; une donnée DÉRIVÉE se dérive du plan, la surcharge explicite reste l'exception.

**Why:** l'utilisateur authore ses cartes en série ; toute donnée non modifiable au clic le rend
dépendant d'un agent, donc bloqué.

Rappel étendu à la CAMPAGNE entière (2026-10-17, verbatim) : « N'oublie jamais que la campagne doit
pouvoir etre recréé de toute piece dans l'éditeur. » Tout registre narratif (états, identités,
documents, presets, billets, poses de jeu de taverne…) et toute donnée de catalogue qu'un paquet
consomme se crée, se modifie et se supprime à l'éditeur ou au Compendium, dans le MÊME lot que son
schéma.

**How to apply:** c'est un critère d'acceptation, pas une intention — un painter sans famille d'outil
dans la palette est une affordance morte, et `scripts/guards/lib/sceneEditZWrite.mjs` ne couvre que
l'écriture du `z` : le reste se vérifie au lot.
