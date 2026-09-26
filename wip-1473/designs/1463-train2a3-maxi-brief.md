## Design du train 2a3 — Maxi et coût d'un Talent comptés par Talent, exception des Domaines arcaniques (#1473, #1463, #1621), 2026-09-24

Train du lot « ops à référence typées » (#1473), après 2a2 (`chantier/1473-t2`, arbre de `.wt-1473-t2`). Remplace
l'amendement 1 du brief 2a2 (issuecomment-5810957274), que le codeur a arrêté à bon droit sur LDB 46.

## Invariant

Verbatims lus au `Source/` le 2026-09-24 (`Source/Warhammer v4 - Livre de base version corrigee/`).

1. `LDB 10 l.17` : « **Nom du Talent (utilisation) :** la dénomination du Talent. S'il y a des parenthèses, le mot à
   l'intérieur décrit une utilisation que le Talent influence. »
   `LDB 10 l.18` : « **Maxi :** cela indique le nombre maximum d'acquisitions de ce Talent, en général 1 ou un Bonus de
   Caractéristique associée. »
   Question : combien d'acquisitions d'un Talent un porteur peut-il faire ? Le Maxi, compté sur le Talent, toutes
   parenthèses confondues.
2. `LDB 10 l.548` (Haine (Groupe), Maxi : Bonus de Force Mentale) : « Chaque fois que vous prenez ce Talent, vous
   développez une certaine haine envers un nouveau groupe. »
   Question : deux groupes haïs sont-ils deux acquisitions du même Talent ? Oui.
3. `LDB 10 l.696` (Magie des Arcanes (Domaine), Maxi : 1, l.682) : « Dans des conditions normales, vous ne pouvez pas
   apprendre plus d'un Talent Magie des Arcanes (Domaine). »
   Même tournure pour Béni (`l.109`) et Invocation (`l.625`).
   Question : le Maxi 1 de Magie des Arcanes vaut-il pour tous les Domaines ensemble ? Oui, « dans des conditions
   normales ».
4. `LDB 46 l.177` (« MULTIPLES DOMAINES MAGIQUES ») : « Si vous êtes un elfe, vous pouvez apprendre un nombre de Domaines
   magiques égal à votre Bonus de Force Mentale. […] Vous ne pouvez pas acheter un nouveau **Talent Magie des Arcanes**
   avant de maîtriser le précédent en ayant acquis au moins 20 Améliorations dans la Compétence Focalisation de votre
   Domaine, et appris au moins 8 Sorts s'y rapportant. D'autre part, n'importe quel Sorcier peut apprendre un seul
   Domaine sombre en plus d'un autre Domaine, en supposant qu'il soit assez inconscient et qu'il trouve un professeur ou
   un grimoire interdit pour l'étudier. »
   Question : quelles conditions lèvent le Maxi 1 de Magie des Arcanes ? Celles-ci ; elles fixent le nombre de Domaines
   et la condition d'achat du suivant.
5. `LDB 07 l.105` : « **Les Augmentations de Talent coûtent 100 PX + 100 PX par Augmentation** déjà achetée pour ce
   Talent. » ; table `l.156` : « 100 PX +100 PX par fois où le Talent a déjà été pris ».
   Question : le coût compte-t-il les acquisitions du Talent, toutes parenthèses confondues ? Oui : « ce Talent », au
   sens de `l.17`. LDB 46 l.177 ne dit rien du coût.

## Cas canonique déjà couvert

- `acquerirTalent` (`src/engine/careerSlots.ts:405`) : seule couture qui ÉCRIT `talents`, bornée par `talentMaxReached`
  (`:388`). Aujourd'hui le compte lit l'instance `(talentId, spec)` (`estLInstanceDe`, `:399`).
- Les Domaines : `heldArcaneDomains`, `arcaneDomainCap`, `arcaneDomainGate` (`careerSlots.ts:429-470`) implémentent déjà
  LDB 46 l.177 depuis la donnée (`talents.json` `grantsArcaneDomain: true`, `species.json` `arcaneDomainsBonusOf`,
  `DomainData.dark`). Seul lecteur de la porte : `buyTalent` du store (`src/state/partyFlow.ts:483`).
- Le coût : `talentCost(timesAlready)` (`src/engine/advancement.ts:56`), pur. Ses appelants recomptent chacun
  `times` sur UNE instance : `advancement.ts:95`, `src/state/advancement.ts:188-189`, `:206`, `:214-215`,
  `src/engine/activities.ts:956`, `src/state/interludeFlow.ts:631` (ces deux derniers par `find(talentId)`, donc la
  PREMIÈRE instance seulement).

Le Maxi par Talent et le coût par Talent sont deux lectures d'un même compte ; l'exception de LDB 46 est une instance de
la porte des Domaines déjà codée, pas une branche neuve.

## Design

- **D1. Un compte.** `acquisitionsDuTalent(porteur, talentId): number` (`careerSlots.ts`), somme des `times` des
  instances de ce Talent. Seule définition du compte ; aucun site ne recompte `times` à la main.
- **D2. Le coût.** `coutDuProchainTalent(porteur, talentId)` = `talentCost(acquisitionsDuTalent(…))`, lu par les six
  sites du cas canonique. `talentCost` reste pur. LDB 07 l.105.
- **D3. Le Maxi.** Un seul verdict d'acquisition, `refusDAcquisition(porteur, ref): string | undefined` (`careerSlots.ts`),
  lu par `acquerirTalent` et par tout affichage « Maxi atteint » ; `talentMaxReached` en devient un lecteur ou meurt.
  - Cas général : refus quand `acquisitionsDuTalent ≥ Maxi` (LDB 10 l.18).
  - Talent dont l'entrée déclare `grantsArcaneDomain` : le Maxi borne l'instance (un même Domaine ne s'apprend pas deux
    fois), et le nombre de Domaines est la porte `arcaneDomainGate` (LDB 46 l.177), qui rend sa raison lisible.
  La porte quitte `partyFlow.ts:483` : tout chemin d'acquisition (achat, création, ops `grantTalent`, mutations,
  Activités) la traverse par `acquerirTalent`.
- **D4. Le porteur.** `PorteurDeTalents` gagne ce que lit la porte des Domaines (espèce, Compétences, Sorts connus).
  Un porteur qui ne les a pas (question 2) : dis ce que tu fais, sans inventer de valeur.
- **D5. Morts.** Les paraphrases `careerSlots.ts:361-363` (« se compte PAR spécialisation ») et `:8`,
  `activities.ts:938-943` se réduisent à la réf nue ; la raison d'exclusion des Talents à spécialisation de
  `learnableTalents` (« le gate … resteraient contournables ») tombe avec D3. L'exclusion elle-même reste tant que
  `LearnOption` n'a pas de sélecteur de spécialisation (ticket à part, amendement 3 du brief 2a2).

## Tests exigés

- Une seconde Destinée d'une autre spécialisation est refusée (Maxi 1, LDB 10 l.313).
- Haine de deux groupes : deux acquisitions sous le même Maxi ; la troisième au-delà du Bonus de FM est refusée.
- Sens aiguisé (Vue) puis (Ouïe) : comptés ensemble, et le coût de (Ouïe) est 200 PX.
- Magie des Arcanes : un humain avec Feu se voit refuser Métal (raison de la porte) mais pas un Domaine sombre ; un elfe
  de Bonus de FM 3 obtient Métal après avoir maîtrisé Feu (20 Améliorations de Focalisation (Feu), 8 Sorts), pas avant ;
  le second Domaine coûte 200 PX.
- Le refus passe par TOUS les chemins : au moins l'achat et une op `grantTalent`.

## Questions (réponse en sortie, citation ou sonde à l'appui)

1. Tout site de donnée (carrières, espèces, Signes, mutations, sorts, traits, statblocs) où une acquisition serait
   maintenant refusée par le compte par Talent, avec la phrase du livre qui l'imprime.
2. Le spawn d'un statbloc passe-t-il par `acquerirTalent` (un statbloc imprimé n'est pas une acquisition) ?
   `fichier:ligne`.
3. Reste-t-il un site qui décide « Maxi atteint » ou recompte `times` hors de D1 et D3 (contre-grep `.times`,
   `talentMaxReached`, `talentCost`) ?

---
_Generated by [Claude Code](https://claude.ai/code)_
