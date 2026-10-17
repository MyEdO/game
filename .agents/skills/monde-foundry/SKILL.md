---
name: monde-foundry
description: À charger dès qu'on travaille sur le MONDE Foundry VTT distant « Campagne Impériale Mercredi » (oli-vtt.anubis.one/game, système wfrp4e, bascule 5e par macros `5e — …`), pas sur le jeu web de ce dépôt : macro, script d'effet, jet, fiche, compendium ou règle 5e côté monde.
---
<!-- GENERATED: agents:sync; source=.claude/skills/monde-foundry/SKILL.md -->

# Monde Foundry — bascule 5e

## Avant de proposer ou de conclure

- Lance `5e — Inventaire`, lis les pages générées « Bascule 5e — inventaire » et « Pièges du moteur ». Chaque macro se déclare par `// COUVRE` … `// FIN COUVRE`, `// OUTILLAGE` ou `// DETTE`. Deux documents : l'inventaire et « Règles maison — bascule 5e » (joueurs), jamais un troisième.
- Toute règle `// COUVRE` cite le CRB, toute `@UUID` se résout : `5e — Verifier` le contrôle.
- Avant « n'existe pas » ou « reste à faire », balaie six lieux, nom VO ET VF : `game.wfrp4e.config.<famille>` (sans les Traits), `config.systemEffects`, les `Item` des acteurs (VO), `await pack.getIndex()` (VF), les textes `@UUID`/`@Compendium` de `config`, le dossier « Bascule 5e ».
- Vérifie la catégorie d'une règle avant de la dire sans support : un Test de Psychologie se passe avec Cool. CRB `041 - Psychology.md` l.9

## Bascule : méthode

- Cherche le concept dans `wfrp4e.js`. Présent et faux : corrige. Sous un autre nom ou un réglage : bascule le réglage, persistant. Absent : écarte-le en consignant ce qu'il faudrait construire et pourquoi c'est disproportionné, là où `5e — Inventaire` lit l'écarté (lis son code d'abord), jamais à la main dans la page générée.
- Une règle portée en 5e pose le 5e ET neutralise le 4e : recense TOUTES ses coutures 4e dans `wfrp4e.js` ; `5e — Verifier` porte un contrôle par couture retirée.
- Un champ a plusieurs surfaces, un contrôle chacune dans `5e — Verifier`, prouvé par un geste réel ensuite rétabli : `chatData` (surcharge `CONFIG.Item.dataModels.<type>.prototype.chatData`) ; `.hbs` (seule couture `BaseWFRP4eActorSheet.prototype._onRender`, nœuds de texte seulement, les `<a>` restent) ; `talent.Max` (affichage) contre `talent.system.Max` (achat) ; ActionsV2 : repointe `actor._sheet.options.actions.<nom>.handler` ET `foundry.applications.instances`.
- Une règle 5e se cite au CRB `Game/Source/Warhammer Fantasy Roleplay 5e Core Rulebook/` (`045 - Spending XP.md l.58`), jamais `Foundry/Source/Warhammer Fantasy Roleplay/` (4e, mêmes chapitres). Les réfs `08 - Rules.md` des macros visent une extraction absente du disque.

## Pièges du moteur (wfrp4e 9.3.2)

- `effectScripts` se clé par l'id NU (16 caractères), jamais `[Script.x]` (clé parasite, sans erreur). `[Script.x]` se résout à l'exécution : remplacer `effectScripts[id]` en mémoire patche tous les talents qui le citent, sans écrire de document. Neutralise par `/* sans effet */`, jamais `""` (rend la référence brute, évaluée en JS).
- Script de dialogue : marqueur anti-doublon dans `args.flags` (le re-rendu remet `flags` à zéro, pas `data`) ; donnée maison par `context` (→ `preData.options`), jamais `data`. Sonde muette : `new SkillDialog(...setupData)`, deux `_prepareContext`, `_getSubmissionData`, `SkillTest.fromData`, `computeResult`.
- Un script `endRound` qui lève coupe toute la fin de round, rien au chat : lis la console MJ au changement de round. Un `endRound` de la bascule ne lève jamais.
- `applyDamage` ne compte que `AP.layers`. Balaie les `scriptData` des acteurs ET pions non liés pour le motif trigger `prepareData` + `AP[loc].value += N` (Armure, Armures Aethyriques, Carapace, Écailles épineuses, colliers, bandeaux, Bouclier de Myrmidia, PJ compris) ; remplace par le `scriptData` à jour du compendium (`APCalc` → `addArmour`), jamais la valeur. Mesure : tooltip « Dommages appliqués » (PA -0), `actor.system.status.armour[loc].layers`.
- Sous libWrapper, ne réaffecte jamais `Hooks.onError` ni `console.error` : capture par `Hooks.on('error', fn)` puis `Hooks.off`. Réparation : réaffecte le corps de `static onError` recopié de `foundry.mjs`, servi par le monde, teste `Hooks.onError('sonde', new Error('x'), {})`.
- `Macro#execute` sans droit rend `undefined` : teste `m.canExecute` AVANT, compte le refus en échec. Après `Macro.create`, aligne son `ownership` sur une voisine du dossier (la création la laisse à `default = 0`). Une absence sur poste joueur se re-sonde après quelques secondes.

## Mesurer au navigateur

- Ne recharge jamais l'onglet MJ (il revient sous la dernière identité) : un chargement automatique se vérifie en rechargeant l'onglet joueur. Contrôle `game.user.isGM` avant toute écriture.
- `skipDialog: true` dans le contexte de `setup*` (sinon `awaitSubmit` fige l'evaluate ; `options.bypass` est mort, `bypass()` honore `computeFields`). Aucun `Roll#evaluateSync` : un dé de plus se lance dans une méthode async déjà attendue (`_handleMiscasts` ne l'est pas). `updateChannelledItems` écrit sans `await` : un seul delta. Pose `miscastModifier` avant `computeResult`, sinon « (+30) (+30) ».
- Dé forcé `test.preData.roll = N` entre `setup*` et `test.roll()`, origine puis patch au même dé ; restaure tout, supprime les messages.

## Arbitrages

- 2026-09-16 : « Quand tu fais une modification, il est super important que tu mette le comportement attendu de la V5 mais aussi que tu supprime l'état qu'on ne veut plus de la V4, pour éviter d'avoir un mixe des 2. »
- 2026-09-16 : « Oublie si ca n'existe pas »
- 2026-09-16 : « En cas de conflit, c'est la description de l'état qui gagne. » — CRB `036 - Attacking.md` l.159-169 contre `042 - Conditions.md` : Surpris → +2 DR en mêlée (l.123), À terre → Avantage (l.109).
- 2026-10-17 (carte de décision, portée de la préséance de l'État) : « Foundry seulement » — le jeu web n'est pas concerné.
- 2026-09-16 : « Pas de Momentum, on reste sur les avantages de groupe. » — `useGroupAdvantage` `true`, `autoFillAdvantage` `false` (CRB `037 - Momentum.md`) ; « gagner du Momentum » = générer de l'Avantage pour son camp ; Talents/Traits qui en dépensent : arbitrage MJ. L'inversion 5e est déjà basculée (`5e — Canal unique (DR et inversion)`, solde `data.__solde5e` → `preData.reversal`) : ne la repropose pas.
