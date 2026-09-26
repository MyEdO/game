# #1463 · concept Référence — diagnostic du lot R1 (famille Compétence)

Mesuré le 2026-09-23 sur `chantier/1473-r0` `4dc682a33` (lot R0 committé), par un lecteur en lecture seule.
Sondes : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r1/` (sonde1-3.mts, .out).
Rendu d'agent : à re-mesurer avant tout brief. Points recoupés par l'orchestrateur marqués « vérifié ».

## Mesure

15 couples Compétence restent au stock `SLOTS_SANS_DECLARATION` (39 avant R0), soit 144 occurrences non
atteintes. Les comptes non atteints égalent les comptes du stock. Les 160 cases de ces occurrences résolvent
toutes vers `skills.json` : aucun id mort, aucun libellé, aucun homonyme.

## Par cause

| Cause | Couples | Occ. | Geste qui solde la classe |
|---|---|---|---|
| (d) Récursion coupée par la marche des slots : `descendreArbre` coupe un nœud déjà ancêtre (`src/data/schemas/grammaire/slots.ts:141-151`, vérifié) ; `flowSchema` (`grammaire/mecanique.ts:556`) se référence lui-même (`steps`, `then`, `else`, `success`, `fail`, `yes`, `no`), donc tout `test.skill` sous un flux imbriqué n'a pas de slot, alors que `flowTestSchema.skill` est une fabrique (`mecanique.ts:367`) | loup-et-saumure 1, maneuvers 2, qualities 2, spells 50, traits 1, trappings 5 | 61 | Socle : un path de slot qui sait dire la récursion, ou une jointure dirigée par la donnée. À concevoir et faire juger. |
| (a) Payload d'op non typé : `OPS_NON_TYPEES` (`mecanique.ts:113-127`) ; ops `skillMod`, `skillDRBonus`, `castPenalty`, `grantCareerSkill`, `augmentWeapon` (`onHitEffects` validé par aucun schéma) | mutations 2, naval-traits 3, sea-shanties 3, tables 15, talents 5, traits 17, trappings 16, traumas 13 | 74 | Typer ces ops dans `OP_DEFS` (#1468) ET rendre le payload d'une op de `OP_DEFS` visible à la marche des slots (aujourd'hui validé par le `superRefine` de `gameOpSchema`, `mecanique.ts:200`, hors marche). |
| (c) Champ non typé : `sea-weather.ts:65` `skills: z.array(z.string())` (vérifié) ; `sea-events.ts:35` `params: z.record(z.string(), z.unknown())` | sea-weather 5, sea-events 1 | 6 | Typer `sea-weather` ; `sea-events.params` par `kind`. |
| (e) Domaine fermé : `corruptionExposure.skill` borné par `TESTS_DE_CORRUPTION` / `refTestDeCorruption` (`grammaire/valeurs.ts:743-757`), 2 valeurs (`resistance`, `calme`) | arene-projet 1, trappings 2 | 3 | À trancher : slot typé `skill` restreint, ou angle mort déclaré (sortie du stock dans les deux cas). |

## Chantiers liés (consigne de Clément du 2026-09-23)

- `chantier/1456-choix` (`772a217cc`, 842 commits derrière `main`) : dépassé. `main` porte `choix: true | [ids]`
  (`grammaire/ref.ts`), la migration des 53 sentinelles de Compétence et `designateSpec` (`src/state/spawn.ts:137-158`).
  Reste de #1456 (commentaire du 2026-08-31) : `CHOICE_RE` (`src/engine/careerSlots.ts:70`, `:96`, `:147`) et 13
  `spec: "au choix"` sur des réfs de Talent (`creatures.json` 12, `stars.json` 1) → lot Talent. À vérifier :
  le round-trip `choix` de l'éditeur de statbloc (`StatblockEditor`), fait sur la branche, non retrouvé sur `main`.
- `chantier/1897-doublons-fan` : actif (fil des sorts), coordonné sur `creatures.spells`.
- #1468 : ouvert, sans branche, dernière activité 2026-09-01 ; porte la cause (a).
- #877 / #1882 : les 130 `ref` de `personnage` des paquets `*-projet.json` relèvent de #1882.
