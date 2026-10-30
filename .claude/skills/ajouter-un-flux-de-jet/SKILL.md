---
name: ajouter-un-flux-de-jet
description: À utiliser quand on ajoute ou modifie un jet ou Test (attaque, sort, compétence, manœuvre, résistance) et sa modale — ou dès qu'on est tenté d'appeler rollTest inline sur le chemin joueur, d'ouvrir une deuxième fenêtre de conséquences, ou de recoder Chance/Pacte/Résilience.
---

# Ajouter un flux de jet

Lire **`docs/ajouter-un-flux-de-jet.md`** — un nouveau jet = 1 spec (`src/noyau/rollFlowSpecs.ts`,
verbes dans la table `FLOW_VERBS` de `src/noyau/flowVerbs.ts`) + 1 xConfirm ; la modale = `RollShell`
paramétrée (slots/jetProps, JAMAIS de mécanique générique recodée) ; le résolveur porte les trois cas
de résolution forcée ; mono = multi N=1. Gardes réelles : `rollFlowWiring.test.ts` (câblage) et
`maneuver-defense-cascade.hors-store.test.ts` (surfaçage contrôleur humain).

- Un Test que le RAW dit OPPOSÉ passe, sur le chemin joueur, par la machinerie d'opposition
  (`opposedBinaryFlow` `src/noyau/rollFlowSpecs.ts:375`, `openCastOpposition`,
  `src/noyau/combat/triggeredTest.ts`, `VsHeader`) : les deux jets visibles, ré-opposés à chaque
  influence (utilisateur, 2026-07-17 : « les jets opposés sont un MENSONGE […] alors qu'on SAIT FAIRE
  DES JETS OPPOSÉS ! »). Un test simple avec tirage adverse caché dans l'applier exige une justification
  RAW citée.
  La fidélité de RÉSOLUTION (opposé réel ou simple) se recense comme un axe à part : un registre ne
  jure que les axes qu'il a mesurés.
- Un acte de combat qui exige un Test consomme l'Action (`battle.acted`), mouvement difficile compris.
  Ce critère ne renverse jamais une exception canon explicite (Piétinement gratuit, Viser = Action sans
  jet). `Source/Warhammer Fantasy Roleplay 5e Core Rulebook/034 - Taking Your Turn.md` l.39, l.17
