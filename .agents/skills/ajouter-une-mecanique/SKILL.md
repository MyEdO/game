---
name: ajouter-une-mecanique
description: À utiliser quand on implémente l'effet d'un trait, talent, qualité, mutation, maladie, atout ou consommable — ou dès qu'on est tenté d'ajouter un champ ad hoc, un type dédié ou un dispatch par nom d'entité pour un effet mécanique.
---
<!-- GENERATED: agents:sync; source=.claude/skills/ajouter-une-mecanique/SKILL.md -->

# Ajouter une mécanique d'entité

Lire **`docs/ajouter-une-mecanique.md`** — d'abord CHOISIR LE CANAL : `passive: GameOp[]` (continu,
collecteur `passiveMods`), `effects: TriggeredEffect[]` (déclenché, dispatcher UNIQUE `fireTriggers`),
`capabilities` (lu par le moteur). Tout effet s'exprime en `GameOp[]` édité au Codex (`GameOpEditor`).
« Difficile à exprimer » n'autorise JAMAIS la machinerie : on étend le vocabulaire
(`GameOp`/`Formula`/`Condition`) — frontière détaillée dans `docs/combat-events-coherence.md`.

- Implémente à la granularité de l'unité de la phrase RAW (déplacement, Round, rencontre, nuit) :
  agrège jusqu'à elle avant d'évaluer le prédicat, jamais au grain du moteur. Avant de taguer
  `maison` une cadence, demande si le livre a déjà une unité d'événement : seul son vrai silence
  appelle la règle 7. Un garde anti-répétition keyé (`lastXKey`) signale l'agrégation manquante.
- RAW qui renvoie au MJ : une valeur qui dépend de ce que le CONTENU connaît est un champ éditable de
  l'entité (règle 2), pas un réglage global. Une fourchette « d'ambiance » est presque toujours un
  budget d'AUTEUR (XP d'objectifs mineurs) : cherche la branche ou l'objectif qui la porte.
