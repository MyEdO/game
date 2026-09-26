# Scénarios de test

> GÉNÉRÉ par `node scripts/docs/build-test-scenarios.mjs` (`npm run docs:test-scenarios`) — NE PAS ÉDITER À LA MAIN.
> Source : `src/scenes/test-scenarios/*.ts` (même périmètre que le registre `_registry.generated.ts`,
> ramassé par `scripts/gen-registry.mjs`) — le catalogue ci-dessous reflète CHAQUE fichier de scénario,
> jamais un sous-ensemble recopié à la main.

**Périmètre mesuré / angles morts** — la section « Catalogue actuel » énumère chaque fichier
`src/scenes/test-scenarios/<NN>-<slug>.ts` (hors `_*`, `*.test.ts`, `*.ascii.ts`, `index.ts` — même
filtre que `scripts/gen-registry.mjs`), lu par AST (`id`/`order`/`category`/`title`/`tests`/`partyNote`
du littéral `export const scenario`), groupé par section dans le MÊME ordre que `TestScenariosScreen`
(`SCENARIO_SECTIONS` filtré aux catégories présentes, tri `order` croissant dans chaque section) —
un miroir du menu en jeu. Angle mort : aucun `import` runtime n'est fait (voir en-tête du générateur,
cycle `store.ts` ⇄ `triggeredEffects.ts` sous Node ESM natif) — un scénario dont le champ `id`/`order`/
`category`/`title`/`tests`/`partyNote` n'est PAS un littéral statique (variable, ou gabarit dont une
substitution `${…}` ne se réduit à aucun littéral — mesuré une fois, `galerie-modeles.ts`, compte dérivé
de `src/data` au chargement) affiche l'expression source entre accolades (`{creatures.length}`) plutôt
que de fabriquer ou tronquer une valeur en silence. Les sections « Vérifier une feature », « Ajouter un
scénario » et « Conventions »
ci-dessous sont de l'INTENTION ÉDITORIALE (comment écrire un scénario, pourquoi la densité) non
dérivable d'aucune donnée — maintenue à la main DANS CE GÉNÉRATEUR, jamais dans le .md.

## Vérifier une feature au navigateur

1. Lance `npm run dev`, ouvre le menu → **Scénarios de test**.
2. **Passe par le scénario adapté.** S'il n'en existe pas pour ce que tu vérifies, **crée-en un**.

**Angle mort du catalogue, mesuré (recette #1852, 2026-09-21)** : AUCUN scénario n'isole « une
créature à attaque gratuite face à un héros ». Tant qu'il n'existe pas, la composition MINIMALE qui
le monte, au kit de recette (helpers de `src/state/devtools.ts`, vérifiés au code) :

```js
await evaluate(session, `window.__wfrp.scenario('entrainement')`);        // terrain nu, groupe complet
await evaluate(session, `window.__wfrp.fight('enc-entrainement')`);       // l'affrontement du scénario
await evaluate(session, `window.__wfrp.spawn('ours', { x: 8, y: 5 }, { side: 'enemy' })`);
await evaluate(session, `window.__wfrp.quality('hero-1', undefined, 3)`); // 3 Avantages au héros
```

`spawn(creatureId, pos, { side })` prend un id de `src/data/creatures.json` (`'ours'`, pas son
libellé) ; `quality(id, label, advantage)` crédite les Avantages — son 2ᵉ argument RESTE une qualité
d'arme (défaut « Déstabilisante »), passer `undefined` la laisse au défaut, ça n'annule rien. C'est
du MONTAGE d'état : le geste TESTÉ, lui, se joue au clic et au clavier.

## Ajouter un scénario = un fichier

Dépose un fichier `src/scenes/test-scenarios/<NN>-<slug>.ts` exportant `scenario` :

```ts
import { arena } from './_shared';
import type { TestScenario } from './_shared';
// (+ createHero / makePregens / itemFromTrappingById selon le groupe voulu)

const scene = arena({ id: 'test-xxx', nom: '…', heroStart: { x: 2, y: 4 } });
scene.encounters = [{ id: 'enc-xxx', enemies: [{ ref: 'Gobelin', pos: { x: 9, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'xxx', order: 7, category: 'combat', icon: 'scenario/ambush', title: '…',
  tests: 'ce que ça vérifie', partyNote: 'le groupe',
  makeParty: () => [/* … */], scene, autoCombat: 'enc-xxx',
};
```

`category` est une clé SANS emoji (`'combat' | 'magie' | 'creatures' | 'survie' | 'marche' |
'scenarios' | 'naval' | 'rendu'`, `SCENARIO_SECTIONS` dans `_shared.ts`) — le libellé/icône de
section sont portés par la donnée, pas par le scénario. `icon` est un `IconId` du registre SVG
(`src/ui/icons`, famille `scenario/*`), jamais un emoji.

`index.ts` le ramasse via le **registre généré** (`scripts/gen-registry.mjs` → `_registry.generated.ts`,
auto en dev ; après ajout/suppression d'un fichier, lance `npm run gen`). Les scénarios sont triés par
`order`, puis **groupés par `category`** en sections dans le menu (`TestScenariosScreen`). Les `*.test.ts`
et les fichiers `_*` sont exclus.

## Conventions

- **Équipement à la main** : `createHero(...)` puis réassigner `items` (`itemFromTrappingById` +
  `recomputeLoadout`). Ex. arbalétrier = Arbalète + Carreaux équipés (`recomputeLoadout` dérive
  `reload`/`subType`).
- **Ennemis** : vraies créatures du bestiaire via `ref` (`creatures.json`, LDB/ADE) ; fixture
  (`statblock` inline) seulement quand aucun équivalent canon n'existe (ex. le **mannequin** passif
  `M 0`, beaucoup de Blessures).
- Le moteur reste couvert par Vitest ; les scénarios sont des fixtures de vérif manuelle/visuelle.

## Catalogue actuel (par section)

Chaque scénario est volontairement DENSE : il exerce une famille de systèmes liés plutôt qu'une seule
mécanique (un terrain bien agencé, des mannequins bien placés).

| Section | Scénario | Vérifie | Groupe |
|---|---|---|---|
| Combat | Terrain d'entraînement | Sandbox : tir + rechargement & ciblage/LdV (cible derrière un muret, cible au loin dans le brouillard), brouillard de guerre (nuit + lanterne portée + vision nocturne du Nain + sort Lumière), Engagé/charge/désengagement & deux armes sur sparring-partners, forme d’arme (fiche du Bretteur), combat monté (monture libre, +20 vs plus petit), Explosion en zone (Sorcière). | Tireur (arbalète + lanterne) · Bretteur (deux armes, forme changeable) · Tueur nain (vision nocturne) · Sorcière (Lumière/Explosion) |
| Combat | L'Embuscade | Combat complet exploration → dialogue → combat (5 mutants, ch.2). Y surviennent : Critiques & mort (Klein, Destin 0 → cascade À Terre/Inconscient/mort), sauvetage par le Destin & Résilience (Sigmund), Action Soigner & arrêt d'Hémorragie (Frère Anselm) sur un allié qui tombe. | Sigmund (Destin) · Tueur nain · Frère Anselm (soigneur) · Klein le Voleur (fragile, Destin 0) |
| Combat | Poursuite terrestre | L'Effet `startPursuit` (#95, LDB 15 l.88-108) ouvre la boucle de manches JOUABLE (cascade influençable purpose:'pursuite', UNE bande par manche — une rangée par coureur) dès l'entrée ; rattrapage (Distance ≤ 0) bascule en combat contre les mêmes brigands, évasion (Distance ≥ 10) se dénoue au récit. | Groupe fixe (pré-tirés) |
| Combat | Siège — défendre la muraille | Siège à grande échelle (30×46, 2 couches) : champ d'approche profond (~76 m) + camp & BATTERIE assaillante (canon direct + catapulte indirecte) qui BRÈCHE la porte de loin (IA cible la structure, Atout Siège) ; rivière + pont qui canalise l'assaut ; enceinte à porte brèchable (WallSpec sans hauteur) ; chemin de ronde = couche 1 à 4 m, rejoint par UNE RAMPE au FLANC GAUCHE (déportée de la porte), parapet z1 sur l'arête extérieure ; pièces servies + ARCHERS PNJ alliés-IA ; combat VERTICAL (LdV plongeante, mêlée refusée à travers le vide). | Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) : montez au rempart par la rampe du flanc gauche ; le SOLDAT sait servir les pièces (Baliste/Canon). |
| Combat | Bélier — porte | Bélier ADE II = engin de siège CREWÉ (ch.08 l.233), jamais une arme portée : posé en EMPLACEMENT (poste), servi par une Équipe de 6 (le Soldat = chef, 5 servants PNJ) — Équipe incomplète bake −20, sous la moitié rend l'affût INUTILISABLE (`firedAttackBlock`). Le chef POUSSE l'engin (Lot 2 #156 : mouvement simple, aucun jet, plafonné à la vitesse maison, engin+servants translatent en formation) jusqu'à une VRAIE porte (structure brèchable, `Weapon.resolveChar`) puis l'assène : le jet se résout sur sa Force, jamais sa CC ; seule la porte encaisse des Dégâts (Atout Bélier). | Le Soldat sert le bélier (chef de pièce) ; 5 servants PNJ complètent l’Équipe requise. |
| Combat | Pastilles d’entité — Monter / Ramasser / Pousser | Zone 4 de la spec HUD : les gestes d’ENTITÉ (`surface: "pastille-entite"` du registre — `mount`, `pickup`, `push-engine` ; `man-poste` ne s’y offre pas, le Soldat servant DÉJÀ l’unique pièce) naissent de la chose qui les offre et vivent HORS de la console (géométrie immuable). Couvre : une pastille par entité offrante, le panneau-paramètre quand une même entité porte N candidats (coffre à deux objets), le coût affiché, le refus VISIBLE avec sa raison (`equipage-suffisant` si l’Équipe du bélier fond), l’annulation gratuite (Échap, re-clic sur « Pousser »), et le picking : cliquer la pastille ne vaut jamais un clic-monde. | Soldat solo, chef de pièce du bélier — cheval et coffre à une case. |
| Combat | Écuries de la Diligence — voir par-dessus le clayonnage | Opacité déclarée par STRUCTURE (#1680) dans les écuries de La Diligence : un tir par-dessus une séparation de box en clayonnage (`occulte: false`) PART, avec le couvert d’arête « Intermédiaire » (+0) et jamais « pas de Ligne de Vue » ; un tireur adverse posté derrière une autre cloison de box voit le groupe et tire ; à distance comparable, un ennemi derrière un mur à ossature en bois est REFUSÉ (pas de Ligne de Vue) — l’arête de clayonnage restant INFRANCHISSABLE au déplacement. | Chasseur (arc en main) + Soldat — départ dans l’allée est des écuries. |
| Magie | Magie en combat | Grande bataille magique : toutes les familles curées (invocations, drains, enchantements, zones, soins), IA caster des DEUX camps + Contre-sort & dissipation (trio ennemi Eusapia/Envoûteuse/Sorcière), ZdE au clic-case + Surincantation, Péché → Colère (Prêtre, 3 Péchés), Corruption (zone de Malepierre → mutation, Aelindra proche du seuil), mémorisation aux PX, Psychologie (Peur/Terreur de l’Envoûteuse). | Aelindra (Haute Sorcière + Nécromancie) + 10 Prêtres (un par dieu de combat) + flagellant + Tueur |
| Magie | Magie hors combat | Incantation HORS COMBAT depuis la fiche : soin/bénédiction (Prêtre), Focalisation + Sort d’Arcane (Sorcier), refus des Projectiles magiques. | Wilhelmina (Sorcier, +Armure Aethyrique, blessée) + Frère Anselm (Prêtre) |
| Magie | Dôme — la sauvegarde octroyée par une zone (LDB 47 l.410) | Le Dôme OCTROIE un Trait (`LDB 47 l.410`), il n’est pas une sauvegarde à part : son Indice vient de la DONNÉE du sort et rejoint le collecteur unique des sauvegardes « 1d10 ≥ Indice » (`wardSaves`), au même site que Démoniaque/Protection. À voir : un TIR de l’extérieur ouvre la sauvegarde et le journal nomme le Trait qui a sauvé ; un coup de MÊLÉE sous la voûte n’en ouvre aucune ; deux dômes (ou un dôme sur qui porte déjà le Trait) ne donnent qu’UN dé. | Ilyanwe (Haute Sorcière, 4 sorts posés par la scène — le Dôme en tête) · Berta (Soldat), la protégée |
| Créatures | Bestiaire, traits & états | Ménagerie : traits (Éthéré/Instable, Démoniaque/Champion/Perturbant, Régénération/Stupide, Toile/Bestial/Venin, Corruption), états des deux camps + purge Shallya (Empêtré, regard pétrifiant, débuffs), Énorme/Piétinement (Griffon), statblocs d’auteur (Pieuvre 8-tentacules, Sorcier mutant lanceur, Squelette facultatif Élite + Caractéristiques aléatoires), 19 mutations physiques sur les héros (calques/morpho/portraits), Psychologie. | 4 pré-tirés MUTÉS (19 mutations) + Sœur Greta, Prêtresse de Shallya (purge) |
| Créatures | Métamorphose — Enfant d'Ulric | Verbe de transformation volontaire (op transform) : un Enfant d'Ulric humain adopte sa forme hybride (delta de profil RAW + Traits + apparence tête-de-loup, persistant, réversible) au prix de deux Actions ; auto-transformation de l'IA (self-buff valorisé data-driven), rendu du rig hybride. | Groupe standard (Soldat · Sorcière · Tueur nain · Répurgateur) face à deux lycanthropes. |
| Créatures | Grimpant — l’araignée escalade | Trait Grimpant (LDB 85 l.160-162) : une créature grimpe une arête `WallSeg.climb` SANS Test et à vitesse pleine — pathing (`reachable`/`pathTo`, `MoveEnv.traverse`) et IA (`chooseEnemyAction`) exploitent l'arête automatiquement ; le groupe (hors du Talent Grimpeur) reste bloqué en bas. | Chasseur solo, posté sur le plateau (hors d’atteinte au sol). |
| Créatures | Aspersion — créature marine hors de l’eau (#497) | Action « Asperger d'eau » (MDG 16 l.19, #497) : une Créature marine ALLIÉE (anguille mâcheprise, `side:'ally'` → `kind:'hero'`) échouée sur la terre (`offTerrain`, aucune tuile d'eau, adjacente AU SPAWN) suffoque Round après Round (`suffocationTick`, #477) sauf si le Soldat, outre à eau en poche (`hasWaterContainer`), l'asperge (`battleWater` pose `wateredThisRound`, aucun jet, consomme l'Action) ; `waterSprayCandidates` filtre STRICTEMENT par `kind` identique à l'aspergeur. | Soldat solo, outre à eau en poche. |
| Survie | Voyage & temps long | Carte du monde, voyage à pied/diligence, postes d’Étapes PERSISTANTS par héros (Plein air/Aguets/Cartes/Fourrage, règle travel-etapes activable), HALTES de nuit (modale de Repos), LONG voyage 96 km = 3 nuits, bilan de nuit COMPLET (récupération des blessés, faim RAW, Vérole de Greta + contagion, cauchemars, Exposition sous la pluie), péripéties + embuscade + reprise, et INTERLUDE d’Activités à l’arrivée (Revenus/Artisanat/banque/Apprentissage, le temps passe) — la cité d’arrivée est le lieu `altdorf` de la carte : les Activités d’Altdorf (ACE Annexe I : Pénitence, Entraînement inhabituel, Tester des objets, Mécénat, Recherche universitaire), gatées `where`, y deviennent atteignables. | Bjorn (plein air) · Mira (aguets) · Aldric (cartographe, 300 PX) · Greta (fourrage faible, blessée, Vérole, cauchemars) |
| Marché | Commerce fluvial (le Reik) | Commerce de cargaison MSRC 13 JOUABLE : le Reik peuplé de ses VRAIES localités marchandes (Index géographique l.185-270, indices Taille/Richesse/Produits verbatim), reliées par des routes de BARGE. Boucle du marchand : acheter une cargaison à Grünburg (R 2), descendre le fleuve en barge (le convoi persiste sur le chariot de convoi), revendre à Altdorf (Florissant R 5, Mise à prix +10 %, l.156) — profit. Marché à chaque ville, Marchandage/Évaluation du vin/rumeurs (Berta). La descente EXERCE aussi l’exposition hydrique (MSRC 16) : en approchant d’Altdorf, l’équipage risque une maladie de l’eau. | Berta (Marchande — Marchandage/Ragot/Évaluation) · Gunnar (batelier) · Otto (garde) · Lise (scribe) |
| Marché | Marché & équipement | Acheter/Vendre + Marchander (Test opposé −10/−20 %) + Évaluer (révèle la qualité cachée) + Réparer (10 %/PA) ; trois archétypes (armurier direct + herboriste via dialogue, Effet openMerchant + maquignon direct, montures/véhicules) ; écran d’EMPLACEMENTS (couches d’armure LDB 63 souple/Flexible/rigide avec échange auto, cape cosmétique, 2 sets d’armes) ; Troc (onglet du panneau marchand : ratio de Disponibilité, échange objet↔objet sans argent) ; Aubergiste → jeux de taverne (Effet openTavernGames, option `tavern-games` pré-activée, NADJ 16). | Négociant (épée non identifiée + maille endommagée + dague) + Maître d’armes (sac garni) |
| Marché | Taverne — un PNJ à profil standard | Un PNJ typé par le profil standard de son espèce (LDB 77) propose un jeu de taverne depuis son dialogue (Effet openTavernGames, option `tavern-games` pré-activée, NADJ 16) : la table s’ouvre sur son offre et l’opposant joue sa fiche. | Soldat · Chasseur |
| Scénarios complets | Arène 2.0 — le Bourg | campagne vitrine complète : Bourg (bâtiments/intérieurs), échelle des 13 zones, contrats, carte du monde, marchands, fouilles | Groupe d’arène pré-tiré (+1 ration chacun) |
| Scénarios complets | Opéra | Théâtre Staatsoper multi-couches en ASCII (coulisses/scène SURÉLEVÉE/parterre/hall couche 0, RAMPES d'angle → galerie/loges/loge royale couche 1 à 2 m). Intrigues authorées : BOMBE à minuterie de la loge royale (delayedEffect → zoneBlast, désamorçage facilité par la Poudre noire, cancelFlag), pétards + vol des clés par Glimbrin (Test caché à deux issues), étudiants saboteurs (combat optionnel), dialogue gaté de la Comtesse, PX canoniques. | Pré-tirés |
| Scénarios complets | Le Caveau piégé | Vitrine Flow+Condition : interactions (levier/clé → flags), condition composée (clé OU levier) ET NON alarme pour la herse, dalle piégée = Test d’Athlétisme à branches (esquive / piques + À Terre + alarme). | Pré-tirés |
| Scénarios complets | Effets scriptés | Quatre Effets d’auteur testés au moteur mais orphelins de scénario (#96/#97), chacun câblé à un déclencheur réel : `medicalAid` (dialogue du médecin, soins payants distincts de Guérison), `petitePriere` (autel interactif, LDB 25, option `prayer-petites`), `ambitionLost` (dialogue du messager, ADE II Annexe I), `fall`+`inflictTrauma` (trappe vermoulue, LDB 15/18, repositionnement). | Pré-tirés |
| Scénarios complets | Échéance & compte à rebours | `ScheduleSpec` partagée (#668) : `setObjective` pose `Objective.deadline` (compte à rebours J-2/J-1 au bandeau `ObjectiveBanner`) et `delayedEffect` tire le même jour à minuit (journal + flag) — les deux résolus par `scheduleAt` (`engine/clock`). Dormir chez l’aubergiste (`rest`, jour par jour) fait avancer le temps et progresser le compte à rebours jusqu’au tir. | Sigmund (Soldat) · Tueur nain · Sorcier · Chasseur |
| Scénarios complets | Dialogue multi-interlocuteurs | Dialogue #669 : `DialogueNode.speakerId` (id d’entité de scène → portrait + nom) alterne le locuteur d’un nœud à l’autre — Gustav (session, `interactEntity`) → Isolde → Phillipe → Gustav ; ZÉRO nom en clair dans la donnée. `dlg-gustav-repeat` illustre le patron de reprise (`when` sur flag). | Sigmund (Soldat) · Tueur nain · Sorcier · Chasseur |
| Scénarios complets | Presets PNJ — pilotes EDO | Recette #671 (lot C) : trois PNJ authorés en presets (base globale + surcharges embarquées) résolus au chargement du narratif. Spawn (Josef), dialogue avec portrait de preset (Phillipe), et combat (Knud Cratinx) déclenché depuis le dialogue. | Soldat · Chasseur · Prêtre |
| Scénarios complets | Carnet d’enquête | Mécanique MAISON du carnet (#670) : `revealClue` première révélation (dialogue, premier stade) et mise à jour (stade explicite), `discreditClue` (déclencheur de zone, fausse piste écartée). | Pré-tirés |
| Scénarios complets | Conditions étendues (skill/career/species/status) | Les 4 nouveaux kinds de `Condition` party-level (#711) : `skill` (avances), `career`, `species`, `status` — gate de choix de dialogue sur les VIVANTS du groupe, convention de préfixe « [Descripteur] » côté prose. | Pré-tirés |
| Scénarios complets | Revisite (persistance de scène) | Persistance d’état au revisit (#707, couche `sceneInstances`) : fouiller le coffre `interact.consume` de la Réserve (disparaît) + ouvrir sa porte, transiter par le Couloir, revenir en Réserve — le coffre reste absent et la porte reste ouverte (sans capture/apply, `transitionTo` re-clonait la scène authored). | Pré-tirés |
| Scénarios complets | Bataille de masse | Puissance de Bataille (ADE II 08) : Activités pré-combat, SITUATION par Round (sous-ensemble + menace Intrus qui s'impose + enchaînements), Scènes MULTI-PJ en Soutien (Test OU combat qui nourrit la Puissance en touches + kills), Rassemblement (Résistance), Test spectaculaire de Puissance (10 + DR, min 5), issue. | 4 pré-tirés (soldat, chasseur, sorcier, tueur) |
| Naval | Combat naval | Postes d’artillerie SERVIS (MDG 12-13) : 2 héros servent les pierriers de leur barge (« Servir un poste », arc de bordée) au lieu de les porter en inventaire ; navire-Combattant à PV avec Amélioration d’instance « Blindage (fer) » (+2 PA de coque) ; Coup Critique → tables de NAVIRE (Voie d’eau / En flammes) ; équipage lié (crewIds) → Éclats / critique « Équipage » sur de vrais marins ; le Tueur + le Sorcier abordent. L’échelle de la scène (metresPerTile) est éditable : à 10 m/case, vue « mer ouverte » où chaque navire occupe sa Taille. | Groupe d’arène ; le Soldat + le Chasseur servent les pierriers, le Tueur + le Sorcier abordent |
| Naval | Voyage maritime | Traversée en mer JOUABLE (MDG 13/15) : route MARITIME (milles) entre 2 ports, appareillage sur le navire de campagne (cogue), journée = météo/vent + Tests d’équipage de Progression & d’Orientation (modales), phare à l’atterrage (Perception), entretien de coque le soir (part endommagée), haltes de nuit, puis ACCOSTAGE au Grand Port (écran Port : réparer/caréner/commerce). Équipage = les PJ, chacun à son rôle (Capitaine/Timonier/Navigateur/Vigie). | Équipage : Capitaine Brenner (Commandement) · Timonière Hilda (Voile/Charpentier) · Navigateur Ansmann (Orientation + Astromancien : Bienfait de Bel Shanaar) · Vigie Perla (Perception) |
| Naval | Duel naval (échelle Mer) | Modèle DEUX-ÉCHELLES couche MER (MDG 13-14) : 2 jetons-coques sur l’eau à ~150 m, équipage ABSTRAIT (passager, hors ordre/rendu), le joueur joue LE TOUR DU NAVIRE (Manœuvrer / Bordée), l’IA de coque adverse manœuvre pour aligner sa bordée puis fait feu. Reddition à mi-coque. Le combat naval person-scale (abordage) reste le scénario « Combat naval ». | Groupe d’arène embarqué (passagers du Grimm) ; l’équipage abstrait sert les pièces |
| Naval | Chute du gréement (dés à la porte) | La CHUTE passe par la porte des jets (#1508, MDG 13 l.684-688 + LDB 15 l.80) : un Critique « Gréement » impose l’Athlétisme aux matelots de la mâture ; qui rate voit s’ouvrir « Hauteur de chute (2d10) » puis « Dégâts de chute (1d10) » — deux étapes affichées, lançables et POSABLES sous « Dés fixés ». Depuis le NID-DE-PIE, la hauteur est un entier (25 m) : une seule étape. Coque MOYENNE portant l’Amélioration Nid-de-pie (aucun navire livré ne la porte). | Gabier Ott (gréement) · Vigie Nissa (nid-de-pie) — Athlétisme faible, la chute arrive |
| Naval | Embuscade fluviale | Combat de bateau FLUVIAL (MSRC 7) distinct de la mer par ses DONNÉES : coques `barge-fluviale`/`barque-fluviale` portant `locationTable:navire-fluvial` + `criticalTable:river-criticals` → un Coup Critique tire la Localisation MSRC (Gréement/Rames/Gouvernail/Coque/Superstructure) et ses effets (États Dérive / Gouvernail brisé / Voie d’eau, Éclats +5, Test d’Initiative « sur le pont ») via le MÊME moteur naval MDG ; équipage exposé lié (crewIds) → Éclats/critique « Équipage » sur de vrais pirates ; bestiaire ch.13 : Anguille du Reik (Constricteur, Morsure +8, Taille Grande). | Groupe d’arène ; 2 héros sont l’équipage exposé de la barge (Éclats / Test d’Initiative de pont) |
| Rendu | Galerie de modèles | Tous les modèles du monde de campagne : {creatures.length} créatures (empreintes par Taille) + TOUTES les carrières ({careers.length}) + TOUTES les armes de mêlée et de distance + mutants + démo Monstrueuse. Exploration, SANS combat. | Exploration libre, aucun combat |
| Rendu | Siège — exploration (sans combat) | La carte du siège (30×46, 2 couches) chargée en EXPLORATION, SANS démarrer le combat : déplacement et caméra libres pour inspecter le rendu (rempart, rampe du flanc gauche, chemin de ronde à 4 m, parapet, toits, relief, brouillard). Le mode combat ne gêne plus l'inspection de la carte. | Explorez librement : montez au rempart par la rampe du flanc gauche, faites le tour de l'enceinte. Aucune rencontre ne démarre. |
| Rendu | Opéra — plan meublé (Staatsoper) | Rendu en jeu du mobilier du plan NADJ 8 : volumiques d'intérieur (comptoirs, tables, étagères, bancs, sièges du parterre, décors de scène) et billboards restants, posés pièce par pièce sur la géométrie fidèle du Staatsoper (rez + étage). Exploration libre, aucune rencontre. | Explorez librement : coulisses, scène, parterre, foyer, puis la galerie des loges par les rampes d'angle. Aucune rencontre ne démarre. |
| Rendu | Pont — vitrine | Relief métrique 100 % données (2 couches + hauteurs parallèles) : on marche SOUS le pont (couche 0, h=0) et DESSUS (couche 1 'planches', h=2 m) ; accès par 2 RAMPES auto-dérivées (hauteurs 0→1→2, AUCUN escalier) ; un plateau à 1 m ; une FALAISE (rebord h=3 m / creux h=0) infranchissable à pied (surfaceLink → cliff). | Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — promenade libre, aucun combat. |
| Rendu | Étiquettes de zone | Étiquette CUITE au centre d'une zone descriptive (#782, `zoneMap`/`zoneLegend`) : 4 pièces cloisonnées (murs d'arête + portes) sous un toit unique — révélation en cutaway (toit levé dès qu'un allié entre dans l'empreinte), un nom par pièce, jamais au survol. | Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — promenade libre, aucun combat. |
| Rendu | La Diligence — exploration | Exploration libre des deux niveaux : zones, portes/fenêtres, et les deux rampes qui montent à l’étage. | Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — exploration libre, aucun combat. |
| Rendu | La Diligence — salle pleine | La salle meublée VUE HABITÉE : 16 convives authorés assis, un par place des 3 tables rondes et des 2 tables murales, chacun posé sur l’abord effectif de sa place. | Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — départ au milieu de la salle, aucun combat. |

Un scénario peut embarquer **plusieurs scènes** (`extraScenes`) et une **carte du monde** (`worldMap`) :
il est alors chargé comme un projet (`loadProject`).
<!-- sources-empreinte: 00ee7915c2f8f898262bf5c8160c57da8e9dd2c7 (46 fichiers, 1 dossiers) corps: 91b932c7488e7bcb87cf4afd4831481cee7889cf -->
