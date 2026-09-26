## Design du train 2a3, v3 — le verdict d'acquisition d'un Talent (#1473, #1463, #1621), 2026-09-24

Train du lot « ops à référence typées » (#1473), posé sur `chantier/1473-t2` après le commit des corrections de 2a2.
Remplace la v2 (`/mnt/project-files/dettes/1463-train2a3-maxi-brief-v2.md`), RÉFUTÉE par `juge-design-socle` (run
`wf_484b01dc-9a7`, 15 bloquants dont 1 structurel ; verdict
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-maxi-v2/verdict.json`), après la v1
(run `wf_4221222e-d3f`, RÉFUTÉE).

**Ce que la v3 remonte d'un niveau.** Deux passes ont buté sur la même classe : des déclarations NEUVES portées par
l'entrée du Talent (`coutFixe`, forme neuve de `max`, `parentheses.plafond`) pour loger des Talents qui ont déjà un hôte
ailleurs (Magie du Chaos dans le grimoire, les Domaines dans `specsSource`). La v3 ne crée qu'une déclaration, celle que
rien ne porte aujourd'hui (les exclusions imprimées) ; tout le reste se lit sur ce que l'entrée déclare DÉJÀ. Trois
sujets qui ne sont pas l'acquisition d'un Talent sortent du train, chacun dans un ticket nommé ci-dessous (T1-T3) : ils
ont chacun leur couture et leur propriétaire.

## Invariant

Verbatims lus au `Source/` le 2026-09-24 (`Source/Warhammer v4 - Livre de base version corrigee/`).

1. `LDB 10 l.17` : « **Nom du Talent (utilisation) :** la dénomination du Talent. S'il y a des parenthèses, le mot à
   l'intérieur décrit une utilisation que le Talent influence. » `LDB 10 l.18` : « **Maxi :** cela indique le nombre
   maximum d'acquisitions de ce Talent, en général 1 ou un Bonus de Caractéristique associée. »
   Question : sur quoi se compte le Maxi ? Sur le Talent, toutes parenthèses confondues. Consigné sur #1621
   (issuecomment-5810795070, 2026-09-24) sous la consigne de Clément du 2026-09-24 : « Tu sais le RAW prime, pourquoi
   tu me propose de ne pas le respecter ? ».
2. `LDB 10 l.548` (Haine (Groupe)) : « Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers
   un nouveau groupe. » Question : deux groupes font-ils deux acquisitions du même Talent ? Oui.
3. `LDB 10 l.696-698` (Magie des Arcanes (Domaine), Maxi : 1, `l.682`) : « Dans des conditions normales, vous ne pouvez
   pas apprendre plus d'un Talent Magie des Arcanes (Domaine). De plus, vous ne pouvez pas apprendre les Talents Béni
   ou Invocation quand vous possédez le Talent Magie des Arcanes. Vous pouvez désapprendre ce Talent pour 100 PX, mais
   si vous le faites, vous perdez immédiatement tous vos Sorts. »
   Question : que borne ce Talent, que défend-il ? Un seul Domaine « dans des conditions normales » ; il défend
   d'apprendre Béni ou Invocation à qui le possède. (Le désapprentissage : question 5.)
4. `LDB 46 l.177` (« MULTIPLES DOMAINES MAGIQUES ») : « Si vous êtes un elfe, vous pouvez apprendre un nombre de Domaines
   magiques égal à votre Bonus de Force Mentale. […] Vous ne pouvez pas acheter un nouveau **Talent Magie des Arcanes**
   avant de maîtriser le précédent en ayant acquis au moins 20 Améliorations dans la Compétence Focalisation de votre
   Domaine, et appris au moins 8 Sorts s'y rapportant. D'autre part, n'importe quel Sorcier peut apprendre un seul
   Domaine sombre en plus d'un autre Domaine […]. »
   Question : qu'est-ce qui lève la borne d'un seul Domaine ? Ces conditions ; chaque Domaine reste sous le Maxi 1.
5. `LDB 10 l.625` (Invocation (Savoir divin), Maxi : 1) : « Dans des conditions normales, vous ne pouvez pas apprendre
   plus d'un Talent Invocation (Savoir divin). De plus, vous ne pouvez pas apprendre les Talents Magie mineure ou Magie
   des Arcanes quand vous possédez le Talent Invocation. » `LDB 10 l.109` (Béni) : « Dans des conditions normales, vous
   ne pouvez connaître qu'un seul Savoir divin pour le Talent Béni. »
   Question : que défend Invocation, que défend Béni ? Invocation défend Magie mineure et Magie des Arcanes à qui la
   possède ; Béni ne défend rien, son Maxi 1 compté sur le Talent suffit. Aucun sens inverse n'est imprimé.
6. `LDB 07 l.105` : « **Les Augmentations de Talent coûtent 100 PX + 100 PX par Augmentation** déjà achetée pour ce
   Talent. » ; table `l.156` : « 100 PX +100 PX par fois où le Talent a déjà été pris ».
   Question : sur quoi se compte le coût ? Sur le Talent, toutes parenthèses confondues, Magie des Arcanes comprise
   (LDB 46 l.177 n'imprime aucun coût).
7. `LDB 05 l.484` : « Tous les Talents aléatoires sont déterminés par le Tableau des Talents aléatoires. Si vous tombez
   sur un Talent que vous possédez déjà, vous pouvez relancer. »
   Question : que fait la création d'un Talent tiré déjà possédé ? Le joueur PEUT relancer ; s'il ne relance pas, il
   le prend de nouveau, sous son Maxi. Un Talent que le verdict refuse ne peut pas être pris : la relance est forcée.
8. `LDB 46 l.152` : « Les Lanceurs de Sorts possédant le Talent Magie Arcanique (Métal) peuvent porter des armures
   métalliques sans pénalité. Les Lanceurs de Sorts possédant le Talent Magie Arcanique (Bêtes) peuvent ignorer les
   pénalités des armures de cuir. » Question : l'exemption suit-elle le Sort lancé ou la possession ? La possession.

## Cas canonique déjà couvert

- `talentMaxById` (`src/engine/careerSlots.ts:367-371`) lit le Maxi que DÉCLARE l'entrée effective (`effectiveEntry`,
  `src/engine/variants.ts`, variantes AA 13 l.54-59). La forme de `max` ne change pas.
- `acquerirTalent` (`careerSlots.ts:405`) : seule couture qui écrit `talents`, bornée par `talentMaxReached` (`:388`).
- La condition des Domaines (LDB 46 l.177) : `heldArcaneDomains`, `arcaneDomainCap`, `arcaneDomainGate`
  (`careerSlots.ts:429-470`), déjà codée depuis la donnée, lue seulement par l'achat du store (`src/state/partyFlow.ts:482`,
  clé `specsSource === 'arcaneDomains'`).
- Le comportement particulier d'une entrée est un attribut DÉCLARÉ sur l'entrée ; une table `Record<union fermée, …>`
  est la forme admise par la garde « branchement par identité » (`src/ui/registry-id-branch-guard.test.ts`, historique
  des lots E4/C0+C1, doctrine utilisateur du 2026-07-26 citée en tête de `scripts/guards/lib/registryIdBranch.mjs`).
- Motif de refus typé : `RefusDEmplacement` (`careerSlots.ts:299`) ; D3 en suit la forme.
- Coût : `talentCost` (`src/engine/advancement.ts:56`), six sites qui recomptent une instance : `advancement.ts:95`,
  `src/state/advancement.ts:188-189`, `:206`, `:214-215`, `src/engine/activities.ts:956`, `src/state/interludeFlow.ts:631`.

Le verdict de D3 est une instance de `talentMaxById` : il lit ce que l'entrée déclare (`max`, `specsSource`, et la seule
déclaration neuve `interditDApprendre`), sans branche par Talent.

## Design

- **D1. Deux comptes, un nom chacun.** `prisesDuTalent(porteur, talentId)` : somme des `times` des instances
  PERMANENTES (`talents`) du Talent, toutes spécialisations confondues ; un octroi temporaire
  (`activeEffects[].grantedTalent`, `src/engine/ops.ts:2222-2229`) n'est pas une prise. Le coût (D4) le lit toujours ; le
  Maxi le lit sauf sous le régime de D2. Le paramètre de `talentCost` prend ce nom, ses docstrings suivent.
- **D2. Le régime des spécialisations tenues.** Table du moteur `CONDITION_DE_SPEC_NEUVE: Partial<Record<SpecsSource,
  (porteur, spec) => RefusDeSpecNeuve | undefined>>`, une ligne : `arcaneDomains: arcaneDomainGate` (LDB 46 l.177). Pour
  un Talent dont le `specsSource` a une ligne, le Maxi se compte PAR spécialisation (les `times` de l'instance) et une
  spécialisation neuve passe la condition de la ligne ; pour tout autre Talent, le Maxi compte `prisesDuTalent`. La table
  est keyée par l'union fermée `SpecsSource` que l'entrée déclare déjà : un N+1ᵉ régime coûte une ligne, sans champ neuf
  sur l'entrée ni branche dans le verdict.
  - `grantsArcaneDomain` meurt, avec tous ses lecteurs : `heldArcaneDomains` (`careerSlots.ts:431-441`), le schéma
    (`src/data/schemas/defs/talents.ts:85-90`, `:110`), le type (`src/data/index.ts:1073`), `talents.json:2972`,
    `scripts/data/lib/obtainabilityGraph.ts:140-147` (qui juge « la parenthèse est un Domaine » : il lit
    `specsSource === 'arcaneDomains'`, la déclaration de l'univers de la spécialisation, jamais la condition),
    `src/data/champs-declares-parite.test.ts:20`, `:60-63`, le commentaire de `registry-id-branch-guard.test.ts:52`,
    `docs/index-moteur.md` (régénéré).
  - UNE fonction rend les Domaines tenus : `domainesTenus(porteur): string[]`, les spécialisations des instances
    permanentes dont l'entrée déclare `specsSource: 'arcaneDomains'`. `heldArcaneDomains` la sépare en sombres et non
    sombres ; `arcaneDomainOf`/`arcaneDomainIdOf` (`src/engine/combatFeatures/dispatch.ts:25-35`, aujourd'hui sur
    `castingKind`) la lisent. Ses lecteurs, un par un :
    - `armourCastDRPenalty` (`src/engine/magic.ts:249`) et `hasArcaneTalent` (`src/engine/domainAttributes.ts:48-51`)
      jugent la POSSESSION (LDB 46 l.152, invariant 8) : ils lisent la liste entière, dans ce train.
    - `castingCharKey` (`magic.ts:198`, ADE II 2 l.728), `counterspellDomainOf` (`magic.ts:905`, LDB 46 l.162 « S'ils
      incantent en utilisant le même Domaine ») et `domainBreathType` (`src/state/combatFlow.ts:6106`, LDB 47 l.509)
      jugent le Domaine du Sort LANCÉ, que leurs appelants n'ont pas : ils gardent `arcaneDomainIdOf`, qui rend le
      premier Domaine tenu. C'est un FOSSILE inscrit au registre de #1463, tué par le ticket T2.
  - `arcaneDomainGate` rend un motif typé (`RefusDeSpecNeuve` : plafond, Domaine sombre déjà tenu, Domaine sombre sans
    Domaine, précédent non maîtrisé avec ses deux mesures), plus une chaîne ; le texte vient de D3.
- **D3. Un verdict, une couture, un rendu.**
  - `refusDAcquisition(porteur, ref): RefusDAcquisition | undefined`, lecture PURE : Talent inconnu du registre →
    lève (erreur nommée, jamais un id fantôme) ; `maxi` (selon D2) ; `specNeuve` (la condition de D2) ; `interdit`
    (le Talent possédé qui défend, D5).
  - `acquerirTalent(porteur, ref)` rejoue le verdict, écrit si rien ne refuse, et rend le refus ou `undefined` ; seule
    couture qui écrit `talents`. Ses 9 appelants se convertissent (`src/ui/creator/draft.ts:509`,
    `src/engine/corruption.ts:214`, `src/engine/character.ts:327`, `advancement.ts:98`, `ops.ts:2218`,
    `src/state/devtools.ts:1457`, `src/scenes/test-scenarios/entrainement.ts:56`, `:65`, `_casters.ts:36`).
  - `buyTalent` (`advancement.ts:94-100`) lit le verdict AVANT le contrôle de PX (un Talent refusé rend son motif, pas
    « PX insuffisants »), prend son coût de D4, puis appelle la couture. `partyFlow` (`:478-488`) ne pré-teste plus
    rien : il rend le refus que porte le résultat de `buyTalent`.
  - Seuls les sites d'AFFICHAGE lisent le verdict sans écrire : `state/advancement.ts:189`, `:215` (le booléen
    `maxReached` de `:82` devient le refus), `draft.ts:623`, `:638`, `activities.ts:952`, `character.ts:339`.
    `talentMaxReached` et `talentMax(hero, label)` meurent.
  - UN rendu français du refus, `texteDuRefus(refus)`, sans réf de livre dans le texte montré au joueur (#1922). Y
    migrent ou meurent, grep de l'orphelin à l'appui : `pf.talentMaxed` (`partyFlow.ts:479`), `adv.talentMax`
    (`advancement.ts:98`, `fr.ts:2366`), `op.grantTalent.max` (`ops.ts:2219`, `fr.ts:336`), `slot.darkOnlyOne`,
    `slot.darkNeedsNormal` (dont la réf `fr.ts:2385`), `slot.domainCap`, `slot.prevDomain`, le littéral de
    `draft.ts:623`, celui de `src/ui/CharacterSheet.tsx:797`, et `pf.refused` pour ce motif.
- **D4. Le coût.** `coutDuProchainTalent(porteur, talentId)` = `talentCost(prisesDuTalent(…))` (LDB 07 l.105), lu par
  les six sites du cas canonique, `buyTalent` compris.
- **D5. Les exclusions, seule déclaration neuve.** `interditDApprendre?: id[]` sur l'entrée du Talent (schéma
  `talents.ts`, lue par `effectiveEntry` comme `max`) : posséder une instance permanente de ce Talent refuse
  l'acquisition des Talents listés. Données : `magie-des-arcanes` → `beni`, `invocation` (LDB 10 l.696-698) ;
  `invocation` → `magie-mineure`, `magie-des-arcanes` (LDB 10 l.625). Sens littéral seulement (invariant 5). La réf de la
  valeur est la `source` de l'entrée, la page même qui imprime l'exclusion.
- **D6. Le porteur.** `PorteurDeTalents` (`careerSlots.ts:397`) porte ce que lisent le verdict et la condition des
  Domaines : Caractéristiques, espèce, Compétences, Sorts connus. `heldArcaneDomains`, `arcaneDomainCap` et
  `arcaneDomainGate` le prennent au lieu de `Combatant`. Les sondes de création (`character.ts:325`, `draft.ts:505`)
  le construisent.
- **D7. La création** (`rollRandomTalent`, `resolveSpeciesTalents`, `src/engine/character.ts`) : un tirage que le
  verdict refuse se relance ; un tirage déjà possédé que le verdict admet se prend de nouveau (le joueur n'a pas relancé,
  invariant 7). Les tests `owned.has(refKey(` (`character.ts:154`, `:159`) meurent. `createHero` et `probeHero` ne
  jettent plus un refus en silence. L'offre de relance au joueur est le ticket T3.
- **D8. Les fabriques** passent par la couture comme tout chemin et font échouer bruyamment un refus :
  - `makeSorceress` (`src/scenes/test-scenarios/_casters.ts:61-78`) pose l'espèce `hauts-elfes` AVANT les Talents,
    écrit des ids de Domaine (`feu`, `mort`…) en spécialisation de Magie des Arcanes et de Focalisation, remplace
    « Nécromancie » (id fantôme par `slugId`, `_casters.ts:35`) par Magie des Arcanes (`necromancie`), et reçoit
    Compétences et Sorts d'un Domaine avant le suivant, dans l'ordre de la maîtrise.
  - `makePriest` remplace le Béni du pré-tiré (`retirerTalent` puis `acquerirTalent`) au lieu d'en empiler un second
    (appelants `src/scenes/test-scenarios/magie.ts:97`, `:105`, `:117`, `bestiaire.ts:92-93`).
  - Les tests « déjà possédé » propres aux fabriques (`entrainement.ts:56`, `_casters.ts:36`) meurent.
- **D9. La zone sort aux normes.**
  - Poison : paraphrases `advancement.ts:53-54`, `:91-94`, `careerSlots.ts:7-8`, `:361-363`, `:400-403`, `:435-437`,
    `:452`, `activities.ts:938-943`, `interludeFlow.ts:625-628`, la garde de synchronisation avouée
    `src/ui/InterludeScreen.tsx:779-781` ; chacune devient une réf nue ou meurt.
  - La dérivation de la Caractéristique du Test depuis le Maxi, écrite deux fois (`InterludeScreen.tsx:783-784`,
    `interludeFlow.ts:641-642`), devient UNE fonction du moteur que l'écran et le flux lisent.
  - Le réexport de `splitLabel` pour « importeurs historiques » (`careerSlots.ts:39-41`) meurt ; ses importeurs
    (`draft.ts`, `draft.test.ts`, `character.ts`, `talentEffects.ts`, `_casters.ts`) importent la source.
  - `talentMaxLabel` (`careerSlots.ts:374-377`, lu par `src/ui/compendium/registry.ts:1492`) ne change pas de forme.

## Hors du train, un ticket chacun (ouverts par l'orchestrateur avant le codeur)

- **T1. Magie du Chaos, LDB 10 l.704 et l.708.** Le livre imprime « Maxi : Nombre de Sorts disponibles dans le Domaine de
  Magie du Chaos choisi » et « Lorsque vous prenez ce Talent, qui coûte à chaque fois 100 PX, vous apprenez un autre Sort
  du Domaine choisi et gagnez un Point de Corruption ». La donnée porte `max: 1`, l'achat d'un Sort du Chaos vit dans
  le grimoire (`src/engine/grimoire.ts:147`, `src/state/partyFlow.ts:521-551`) et la première prise n'apprend aucun Sort.
  Un seul hôte pour l'acte, au fil des sorts. Ce train ne touche ni `max` ni le grimoire : compté sur le Talent,
  `max: 1` rend déjà « un seul Savoir de Magie chaotique » (l.708).
- **T2. Le Domaine du Sort lancé** : `castingCharKey`, `counterspellDomainOf`, `domainBreathType` lisent le premier
  Domaine tenu (fossile de D2) au lieu du Domaine du Sort ; au fil des sorts.
- **T3. La relance offerte au joueur à la création** (LDB 05 l.484, « vous pouvez relancer ») : le créateur l'offre au
  tirage d'un Talent déjà possédé que le verdict admet.

## Tests exigés

- Destinée (LDB 10 l.313, Maxi 1) : une seconde Destinée, d'une autre spécialisation, est refusée (`maxi`).
- Haine : deux groupes font deux prises ; au-delà du Bonus de FM, refus `maxi` ; le second groupe coûte 200 PX.
- Sens aiguisé (Vue) puis (Ouïe) : comptés ensemble ; (Ouïe) coûte 200 PX.
- Magie des Arcanes : humain avec Feu, Métal refusé (`specNeuve`, plafond) ; Feu une seconde fois refusé (`maxi`) ;
  Domaine sombre admis après un Domaine, refusé sans ; elfe de Bonus de FM 3 : Métal refusé avant la maîtrise de Feu,
  admis après ; le second Domaine coûte 200 PX.
- Exclusions : avec Magie des Arcanes, Béni refusé (`interdit`, nomme Magie des Arcanes) ; avec Invocation, Magie
  mineure refusée ; avec Béni, Magie des Arcanes admise.
- Le refus passe par TOUS les chemins : achat (motif avant les PX), op `grantTalent`, création, fabriques.
- `domainesTenus` d'un elfe à deux Domaines rend les deux ; l'armure de métal n'est pas pénalisée s'il tient Métal en
  second.
- Talent inconnu : le verdict lève en nommant l'id.
- Création : un halfling (Sens aiguisé (Goût)) qui tire Sens aiguisé sous son Maxi le prend de nouveau ; un tirage
  refusé est relancé, jamais perdu.
- Fabriques : `makeSorceress` tient ses Domaines par ids, la condition les admet ; `makePriest` de Shallya porte un seul
  Béni, (shallya).
- Tests réécrits depuis LDB 10 l.18 : `src/engine/careerSlots.test.ts:16-17`, `:173-182` (dont `:182`, « spec
  distincte »), `:346` ; `src/engine/variants-lot4.test.ts:23`, `:256-263` ; `career-talent-roving.test.tsx:14`.

## Questions (réponse en sortie, citation ou sonde à l'appui)

1. Tout site de donnée ou de scénario (carrières, espèces, Signes, mutations, sorts, traits, statblocs, fabriques) où une
   acquisition est maintenant refusée, avec la phrase du livre qui l'imprime.
2. Les livres autorisés portent-ils d'autres bornes ou exclusions d'acquisition de Talent (« conditions normales »,
   « ne pouvez pas apprendre », « qu'un seul ») ? Chacune devient une ligne de D2 ou de D5, ou se nomme.
3. Reste-t-il un site qui décide « Maxi atteint », recompte un coût ou juge « déjà possédé » hors de D1, D3, D4
   (contre-grep `.times`, `talentCost`, `owned.has(refKey(`) ?
4. Un octroi temporaire (`grantedTalent`) d'un Talent qui défend (Magie des Arcanes, Invocation) existe-t-il dans la
   donnée ? S'il en existe, arrête-toi sur D5 et nomme-les.
5. Le désapprentissage de Magie des Arcanes (LDB 10 l.698) a-t-il un chemin (`fichier:ligne`) ?
6. Les Domaines de moins de 8 Sorts dans la donnée (`gueule` 7, `sorcellerie` 7, `magie-naturelle` 6, `demonologie` 5,
   `necromancie` 4, `domaine-de-la-ruine` 6, relevé du juge v2) ont-ils tous leurs Sorts du livre ? Citation par Domaine.
7. La règle que la fonction de D9 implémente (Caractéristique du Test d'apprentissage d'un Talent) : sa réf.
8. Un autre Talent des livres a-t-il un Domaine pour spécialisation (la réserve écrite à `careerSlots.ts:435-437`) ?

## Périmètre

`src/engine/careerSlots.ts`, `careerSlots.test.ts`, `advancement.ts`, `activities.ts`, `character.ts`, `corruption.ts`,
`ops.ts`, `magic.ts` (`:249` seul), `domainAttributes.ts`, `combatFeatures/dispatch.ts`, `talentEffects.ts` (import),
`variants-lot4.test.ts` ; `src/state/advancement.ts`, `partyFlow.ts`, `interludeFlow.ts`, `devtools.ts` ;
`src/ui/creator/draft.ts`, `draft.test.ts`, `CharacterSheet.tsx`, `InterludeScreen.tsx`, `compendium/registry.ts` (si
touché), `career-talent-roving.test.tsx`, `registry-id-branch-guard.test.ts` ; `src/data/talents.json`,
`schemas/defs/talents.ts`, `index.ts`, `champs-declares-parite.test.ts` ; `src/i18n/messages/fr.ts` ;
`src/scenes/test-scenarios/_casters.ts`, `entrainement.ts`, `magie.ts`, `bestiaire.ts` ;
`scripts/data/lib/obtainabilityGraph.ts`. Tout autre fichier se justifie en sortie.

---
_Generated by [Claude Code](https://claude.ai/code)_
