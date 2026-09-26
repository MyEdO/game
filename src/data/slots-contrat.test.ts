import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  champDuPath,
  champsJoints,
  champsSansSlot,
  estTypeDuRegistre,
  idsDuType,
  slotsDeclares,
  valeursAuPath,
} from '../../scripts/docs/lib/slots-registre.mjs';
import { listerDocuments, scanDuCorpus } from '../../scripts/docs/lib/structures-scan.mjs';
import { ANGLES_MORTS_SLOTS, MANDAT_SLOTS } from '../../scripts/docs/lib/structures-lexique.mjs';
import { SLOTS_INTERNES, SLOTS_SANS_DECLARATION } from '../../scripts/guards/lib/slotsStock.mjs';
import { champsAveugles, ecartsDeStock, lignesMalQualifiees } from '../../scripts/guards/lib/stock.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — quelles références les schémas des DEUX racines DÉCLARENT-ils, à quel path ? ' +
    'B — les valeurs posées à ces paths RÉSOLVENT-elles toutes contre le registre des ids ? ' +
    'C — quels champs portent des références OBSERVÉES qu’AUCUN slot ne déclare (la dette d’adoption) ?',
  primitive:
    '`slotsDe` (`src/data/schemas/grammaire/slots.ts`) pour le DÉCLARÉ, `scannerDonnees` ' +
    '(`scripts/docs/lib/structures-scan.mts`) pour l’OBSERVÉ, joints par `scripts/docs/lib/slots-registre.mts`.',
  /** Le MANDAT ne se reformule pas : il se LIT à sa source unique. */
  mandat: MANDAT_SLOTS,
  perimetre:
    'Les documents authorés des deux racines `src/data` et `src/scenes` et leurs schémas zod des registres ' +
    '`SCHEMA_DEFS` / `SCHEMA_DEFS_SCENES`, joints par BASENAME (`nomDeDocument`).',
  angleMort: ANGLES_MORTS_SLOTS,
  baseline: {
    fichier: 'scripts/guards/lib/slotsStock.mjs',
    decroissant: true,
    raison:
      'Le stock EST la dette d’ADOPTION du registre : une ligne se solde en faisant ADOPTER la fabrique de ' +
      'référence par le schéma du champ (L2/L3, #1473), et part dans le MÊME commit que l’adoption.',
  },
  ticket: '#1466',
} as const;

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
/** La composition defs → familles/enums → scan vit dans `scanDuCorpus` (`structures-scan.mts`) : la
 *  MÊME que lisent `structures-contrat.test.ts`, `build-structures.mts` et `horsStrateAudit.ts`. */
const { defs: DEFS, scan } = scanDuCorpus(ROOT);
const SLOTS = slotsDeclares(DEFS);
const DOCUMENTS = new Map(listerDocuments(ROOT).map((d) => [d.nom, JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')) as unknown]));

/** Clé de la dette d'ADOPTION : le couple (dataset, champ) ET son compte d'occurrences — une
 *  occurrence de plus est une entrée neuve, pas une ligne qui bouge. */
const CLE_DETTE = (c: { dataset: string; champ: string; occurrences: number }) =>
  `${c.dataset} | ${c.champ} | ${c.occurrences}`;

/**
 * Plafond du cliquet — const du TEST, jamais dans `slotsStock.mjs` (même patron que `MANUAL_DOCS_MAX`,
 * `scripts/docs/manual-docs-ratchet.test.mjs`) : sans lui, le chemin le plus court pour « solder » une
 * dette neuve resterait d'ajouter une ligne au stock, CI verte. Il ne descend qu'en faisant ADOPTER
 * la fabrique de référence par le schéma du champ (L2/L3, #1473).
 *
 * État COURANT : 338, ajusté au fil des lots #1467 L1b puis L2 #1548 (git porte le détail des crans).
 * Dernier cran (L2 #1548 commit 4, 341 → 338) : le champ d'AVANCEMENT quitte ses graphies
 * enveloppantes — 7 lignes s'éteignent (`careerLevels` : `ref`, `specOptions`, `wildcard` ;
 * `species` : `choice`, `ref`, `specOptions`, `wildcard` — la 7ᵉ est `species.choice`, dont
 * l'enveloppe de choix devient `choix`), 4 naissent (`careerLevels.choix`/`of`,
 * `species.choix`/`of`) : 7 mortes − 4 nées = les 3 crans. `careerLevels.choice` demeure, son compte
 * seul bouge (38 → 27). Les références vivent maintenant SOUS le champ métier `skills`/`talents`,
 * dont la ligne demeure : `champDuPath` ne voit pas l'adoption à travers
 * l'union de `avancement()`, angle mort déjà déclaré ci-dessus. Une ligne voit son COMPTE bouger sans
 * cran (le plafond porte sur le NOMBRE de lignes) : `arcane-phenomena.json › environments` 3 → 4, la
 * valeur « montagnes » résolvant désormais vers la spécialisation `bon-marcheur/montagnes` ajoutée au
 * catalogue (COLLISION d'ids, angle mort déclaré).
 * CRAN À LA HAUSSE (338 → 339, #862, 2026-08-31) — le seul de ce stock, et il ne se solde PAS par
 * une adoption au champ visé : `mutations.json` porte sa première op AUTHORÉE (`[removeTrait,
 * grantTrait]`, re-ciblage quotidien de Haine sporadique), donc une référence de Trait apparaît au
 * champ `ops` d'un dataset qui n'en portait aucune. MESURÉ : typer `removeTrait.traitId` avec
 * `idDe('trait')` (fait, `grammaire/mecanique.ts`) DÉCLARE bien le slot, mais son path projette sur le
 * champ `traitId` quand le scan mesure l'objet-op au champ `ops` — la ligne ne bouge pas d'un pouce.
 * C'est l'angle mort DÉCLARÉ ci-dessus (projection sur le dernier segment-clé) : ces lignes `ops`
 * (criticals 215, activities 16, traits 21…) meurent en L3 #1473, quand la référence de Trait
 * s'écrit `trait: { id }` comme la Compétence s'écrit `skill: { id, spec? }` depuis L2 #1548 — pas avant.
 * Cause de l'essentiel des crans — jamais de la donnée neuve : le CHAMP PORTEUR bouge (la référence
 * de Compétence sort de son conteneur et devient son propre champ `skill`/`skills`), ce qui SCINDE
 * des lignes existantes, et le détecteur voit plus loin (les champs d'un `document()`). `champDuPath`
 * ne retenant que le DERNIER segment (`ANGLES_MORTS_SLOTS`, dériveur à descendre d'un niveau pour
 * #1473), l'adoption de `refOuSpec('skill')` reste invisible à cette mesure. Au fil du lot, une seule
 * ligne est née d'une donnée devenue référence : `arene-projet.skill`, valeur de Test du PNJ soigneur,
 * jusque-là un nombre nu.
 */
// Cliquet DESCENDU 339 → 337 (L2 #1548, commit 4bis) : `careerLevels.json | choix` et
// `species.json | choix` étaient des couples FANTÔMES — `choix` est une CLÉ DE GRAPHIE du nœud de
// référence, et ses ids sont des SPÉCIALISATIONS bornées par le catalogue de l'entrée visée, jamais
// une FK vers un dataset (DESIGN v2 S2). Le scan ne les compte plus comme un champ porteur à part
// entière (`structures-scan.mts`, boucle des listes d'ids nus) ; la même correction empêche le
// couple `creatures.json | choix` que le commit aurait posé par COLLISION d'ids.
// Cliquet REMONTÉ 337 → 340 (#674, 2026-08-31) : 3 champs PORTEURS de référence apparaissent dans
// `maladies.json` avec la Pneumonie et le Rhume commun (EDOC 08 l.94-122) — `mutation` (maladie
// visée), `onFail` et `otherwise` (les ops du cycle quotidien). MESURÉ : typer les quatre champs de
// `aggravateSymptom`/`grantSymptom` avec `idDe('maladie')`/`idDe('symptome')` (fait,
// `grammaire/mecanique.ts`) ne déplace PAS ces lignes — même angle mort que `removeTrait.traitId`
// ci-dessus : le scan mesure l'objet-op au champ porteur (`onFail`), le slot se projette sur
// `disease`/`symptomId`. Ces lignes meurent avec le dernier segment-clé en L3 #1473, pas avant.
// Cliquet REMONTÉ 340 → 344 (#684 L4, 2026-08-31) : le premier tronçon de carte du chapitre 1 fait
// entrer `diligence-projet.json` dans les champs porteurs de la CARTE — `a`, `b`, `scene` (lieux et
// route) et `modes` — plus un cran d'occurrences sur `tiles` (la scène d'arrivée). Ce sont les MÊMES
// couples que les trois autres projets portent déjà pour leur worldMap : l'adoption de la fabrique
// de référence se fait au schéma de carte (`defs-scenes/worldmap.ts`), en L2/L3 #1473, pour les
// quatre projets à la fois.
// Cliquet REMONTÉ 344 → 345 (équipage de la Louve grise, 3fe450675, 2026-09-01) : les entités
// d'équipage de la barge reçoivent `appearance` — le MÊME couple que `loup-et-saumure`, `arene` et
// `creatures.json` portent déjà. Aucune fabrique n'est disponible à adopter : dans
// `entityAppearanceSchema` (`src/data/schemas/grammaire/valeurs.ts`), `species` et `tenue` sont des
// `z.string()` nus, et `TYPES` (`grammaire/ref.ts`) n'a ni type `espece` ni type `tenue`. L'adoption
// est celle de ce schéma, en L2/L3 #1473, pour les quatre porteurs à la fois.
// Cliquet DESCENDU 345 → 343 (#1463 L-ref-2, dff0e31c5, 2026-09-01) : `spells.json | range` (22) et
// `spells.json | target` (16) n'ont plus AUCUNE réf observée sans slot — les 54 Portées/Cibles qui
// nommaient le lanceur portent `{kind:'self'}` ; les deux entrées périmées se retirent, le plafond suit.
// Cliquet REMONTÉ 343 → 345 (#1657 geste A, 2026-09-01) : `activities.json | rule` (1) et
// `maladies.json | dailyTest` (1) ENTRENT au dénominateur. Aucune référence neuve n’est authorée : le
// concept `test` revendiquait ces objets par le seul `difficulty` et masquait la référence qu’ils
// portent (`regles.json`, `symptoms.json`) ; les comptes de `activities | skills` (61 → 63) et de
// `maladies | symptoms` (54 → 62) montent par la même mesure. La dette d’adoption qu’ils nomment
// existait avant d’être visible — c’est le lot L2/L3 #1473 qui l’éteint, comme leurs sœurs.
// Cliquet DESCENDU 345 → 344 (#1657 B2b, 2026-09-02) : `symptoms.json | onFail` (2) meurt — le cycle
// d’un symptôme porte désormais sa conséquence sous la feuille `EffectOp` du nœud `test`, et ses deux
// réfs rejoignent `symptoms.json | ops` (10 → 12), un couple déjà au dénominateur. `maladies.json |
// onFail` (1) devient `| ops` par le même geste : même dette, autre champ porteur.
// Cliquet REMONTÉ 344 → 345 (#1657 B3-1, 2026-09-02) : `criticals.json | skill` (39) ENTRE au
// dénominateur. Aucune donnée neuve — les 39 nœuds `test` des rangées de Critique NOMMENT désormais
// la Compétence que leur `desc` verbatim exige (`LDB 18` « Réussissez un Test de Résistance… » ;
// `AA 07 l.165` « Test d'Athlétisme », seul nœud qui la nommait déjà) : sans elle, la porte n'a rien
// à tester et la valeur se recalculait à la main dans le moteur. La dette d'ADOPTION qu'elle nomme
// est celle, déjà au stock, de `spells | skill` (50), `talents | skill` (123), `miscast | skill`
// (26)… — 21 datasets portent le MÊME couple : l'adoption est celle de `refOuSpec('skill')` au
// schéma de `FlowTest`, en L2/L3 #1473, pour tous à la fois.
// Cliquet DESCENDU 339 → 338 (#1686 lot 3a-1) : `arene-projet.json | material` porte
// `idDe('material','roof')` (`defs-scenes/scene.ts` `couvertureSchema`, adopté par `BuildingMass.material`
// et `RoofDefaults.material`) — le champ a son slot déclaré, l'entrée de stock est périmée.
// Cliquet DESCENDU 345 → 341 (#1690) : les QUATRE `<projet>.json | tiles` portent `idDe('terrain')`
// (`defs-scenes/scene.ts` `layerSchema`) — 18 154 cellules résolues au parse contre `terrains.json` ;
// les quatre entrées de stock sont périmées et se retirent.
// Cliquet RECALÉ 334 → 336 après rebase sur 6a30233aa (#1690, 2026-09-06) : la mesure d'avant rebase valait
// 334 (les 4 `tiles` adoptent `idDe('terrain')`) ; le tronc a ajouté entre-temps 2 entrées de stock
// (`scripts/guards/lib/slotsStock.mjs`, train #1599 — États portés par un passif). La valeur suit la MESURE.
// Cliquet 336 → 339 (#1612, 2026-09-06, après le rebase sur #1690 — entrées réelles 336 → 339, plafond recalé au réel) : QUATRE champs ENTRENT au dénominateur — `cible`
// (1), `factor` (1) et `mod` (2) côté `activities.json`, `of` (1) côté `tables.json`, les quatre
// porteurs du terme `{rule}` d'une `Formula` posés par l'Activité Mendier et sa table MAISON (le
// montant de l'amende des gardes vit en règle optionnelle). Ils ONT leur fabrique (`formulaSchema` compose
// `idDe('regleOptionnelle')`, `grammaire/valeurs.ts`) : ce que le déclaré n'atteint pas ici est
// l'ANGLE MORT déjà nommé par ce volet — « `valeursAuPath` ne descend PAS dans une branche d'union
// (`|N`) », et `formulaSchema` EST une union. Même dette, même solde que les autres porteurs de
// `{rule}` : elle se retire quand le marcheur de slots saura descendre une union.
// Dans le MÊME geste, `activities.json | rule` (1) SORT du dénominateur : le slot déclaré par
// `formulaSchema` projette sur la clé `rule`, et cette projection couvre désormais le champ `rule`
// de l'Activité elle-même. Plafond au réel mesuré (339) : le cliquet ne laisse aucun mou.
// CRAN À LA HAUSSE (339 → 343, #1691, 2026-09-07) : les QUATRE `<projet>.json | reliefDefaults`
// entrent au dénominateur — la matière de chaque partie de relief passe en donnée, et le record que
// chaque scène porte est vu par le scan comme UN nœud de référence (champ porteur `reliefDefaults`,
// signature `cliff,deck,pilier,ramp`). MESURÉ : le slot EST déclaré et il RÉSOUT
// (`defs-scenes/scene.ts › reliefDefaultsSchema`, `idDe('material','relief')` sur chaque partie,
// 28/28 valeurs posées résolues au volet RÉSOLUTION) ; ce qui laisse la ligne au stock est l'angle
// mort DÉCLARÉ ci-dessus — `scenes[].reliefDefaults.cliff` projette sur `cliff`, jamais sur le champ
// porteur. Même forme que `props.json | light` : ces lignes meurent avec le dériveur d'un niveau
// (L3 #1473), pas par une adoption au champ.
// CRAN À LA HAUSSE 342 → 346 (#1715 volet b, 2026-09-09) : les QUATRE `<projet>.json | roofDefaults`
// entrent au dénominateur — la toiture par défaut d'une scène passe en donnée, et le record que
// chaque scène porte est vu par le scan comme UN nœud de référence (champ porteur `roofDefaults`,
// signature `material,pitchDeg,riseMaxStoreys`). MESURÉ : le slot EST déclaré et il RÉSOUT
// (`defs-scenes/scene.ts › sceneRoofDefaultsSchema`, `idDe('material','roof')` sur `material`) ; ce
// qui laisse la ligne au stock est l'angle mort DÉCLARÉ — `scenes[].roofDefaults.material` projette
// sur `material`, jamais sur le champ porteur. Même solde que `reliefDefaults`.
// Cliquet DESCENDU 343 → 342 (#1715, 2026-09-09) — DEUX lignes meurent, une naît :
// `arene-projet.json | style` (2) MEURT de la DONNÉE : ses deux corps COMPOSITES (le Bourg, Felsbach)
// ne sont pas des bâtiments et ne portent plus de type ; le champ y est absent, et le seul `style`
// restant (`diligence-projet.json`, `maison`) est ATTEINT par le slot déclaré `idDe('building')`.
// `domains.json | when` (2) SORT du dénominateur, non par un stock mais par la FORME VRAIE du champ —
// les circonstances d'un modificateur de Vent sont un vocabulaire FERMÉ, déclaré par `enumNomme`
// (`domainCircumstanceSchema`, `defs/domains.ts`, partagé avec `cancelledBy.circumstance`) : un
// littéral d'enum du schéma n'ouvre plus de référence. La ligne existait depuis le 2026-08-26 et son
// compte venait de monter 2 → 3, le dataset `buildings.json` (#1715) rendant la circonstance `tour`
// homonyme d'un id de bâtiment — une FK que la donnée n'a jamais voulue.
// `buildings.json | features` (4) ENTRE, et ce n'est PAS une référence sans fabrique : `features:
// z.array(ref('prop', { anchor }))` est adoptée et RÉSOUT 4/4 au volet RÉSOLUTION. C'est l'angle mort
// DÉCLARÉ de la référence ENVELOPPÉE — `[].features[].id` projette sur `id`, jamais sur le champ
// porteur — celui-là même que `structures.json | traits`, `vehicles.json | traits` et
// `ship-stations.json | requiresTrait` portent déjà : il meurt avec le dériveur d'un niveau (L3 #1473).
// Cliquet REMONTÉ 346 → 348 (#1716, 2026-09-18) : `semences-de-scene.json | reliefDefaults` et
// `| roofDefaults` ENTRENT, et pour la MÊME raison que `buildings.json | features` ci-dessus — la
// fabrique est ADOPTÉE, pas absente. La semence d'une scène neuve compose les schémas PARTAGÉS de la
// scène (`reliefDefaultsSchema`, `sceneRoofDefaultsSchema` de `defs-scenes/scene.ts`) : MESURÉ, les 5
// slots `idDe('material', …)` sont déclarés pour ce dataset et résolvent 5/5 au volet RÉSOLUTION.
// Ce qui laisse ces deux lignes est la PROJECTION sur le dernier segment (`cliff`, `material`), face
// au champ PORTEUR que le scan observe : les 8 lignes jumelles des quatre projets de scène sont au
// stock depuis #1691/#1715, et les dix meurent ensemble avec le dériveur d'un niveau (L3 #1473).
// Cliquet REMONTÉ 348 → 349 (#1882, 2026-09-23) : `species.json | profilStandard` ENTRE, fabrique
// ADOPTÉE (`ref('creature')`, `defs/species.ts`) — même angle mort de la référence ENVELOPPÉE que
// `species.json | previewCareer` : `[].profilStandard.id` projette sur `id`. Meurt avec le dériveur
// d'un niveau (L3 #1473).
const DETTE_ADOPTION_MAX = 349;

describe('registre des SLOTS — déclaré × observé (#1466 L1a, volet A)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('slots.ts');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines mesurées.').toMatch(/src\/data.*src\/scenes/s);
    expect(GARDE.angleMort, 'les angles morts se lisent dans UNE source (`ANGLES_MORTS_SLOTS`), jamais recopiés.').toBe(ANGLES_MORTS_SLOTS);
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(4);
    expect(GARDE.mandat, 'le mandat se lit dans UNE source (`MANDAT_SLOTS`), jamais reformulé.').toBe(MANDAT_SLOTS);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/slotsStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1466');
  });

  it('MANDAT et ANGLES MORTS ont UNE source : le lexique, recopié nulle part (stock, doc)', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/slotsStock.mjs'), 'utf8');
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(
      ANGLES_MORTS_SLOTS.filter((a) => !stock.includes(a)),
      'l’en-tête de `slotsStock.mjs` ne porte plus les angles morts de `ANGLES_MORTS_SLOTS` — la copie a divergé.',
    ).toEqual([]);
    expect(
      ANGLES_MORTS_SLOTS.filter((a) => !doc.includes(a)),
      'le §6.3 de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS_SLOTS`.',
    ).toEqual([]);
    for (const porteur of [stock, doc])
      expect(porteur.includes(MANDAT_SLOTS), 'le MANDAT du volet a été reformulé quelque part au lieu d’être cité.').toBe(true);
  });

  it('la JOINTURE déclaré × observé est NON VIDE (sans elle, ce volet serait un no-op à faux vert)', () => {
    const joints = champsJoints(scan.formes, SLOTS);
    expect(
      joints,
      'aucun champ porteur de références OBSERVÉES n’est atteint par un slot DÉCLARÉ — la jointure (basename, projection path → champ) est cassée, et tout le volet rendrait vert sans rien mesurer.',
    ).toContain('merchants.json | curated');
    expect(SLOTS.length, 'aucun slot déclaré : la marche des schémas ne rend rien.').toBeGreaterThan(0);
  });

  it('PROJECTION path → champ : fonction PURE, cas `merchants.curated` committé', () => {
    expect(champDuPath('[].curated[]')).toBe('curated');
    expect(champDuPath('narratif.presetsPnj[].base')).toBe('base');
    expect(champDuPath('|0.of[].id')).toBe('id');
    expect(champDuPath('{}.id')).toBe('id');
    expect(champDuPath('[]'), 'un path sans segment-clé porte sur l’entrée elle-même.').toBe('(racine)');
    const curated = SLOTS.find((s) => s.dataset === 'merchants.json' && s.espece === 'id')!;
    expect(curated.path).toBe('[].curated[]');
    expect(champDuPath(curated.path)).toBe('curated');
    expect(
      scan.formes.some((f) => f.strate === 'Référence' && f.dataset === 'merchants.json' && f.champ === champDuPath(curated.path)),
      'le champ projeté ne rejoint aucune forme OBSERVÉE de `merchants.json` : la projection a divergé du champ que le scan mesure.',
    ).toBe(true);
  });

  it('RÉSOLUTION : toute valeur posée à un slot typé du registre résout, et le rouge est NOMINATIF', () => {
    const fautives: string[] = [];
    let posees = 0;
    for (const s of SLOTS) {
      if (s.espece !== 'id' || !estTypeDuRegistre(s.type)) continue;
      const ids = new Set(idsDuType(s.type));
      for (const v of valeursAuPath(DOCUMENTS.get(s.dataset), s.path)) {
        posees++;
        if (!ids.has(v.valeur)) fautives.push(`${s.dataset} › ${s.path}${v.chemin} = « ${v.valeur} » (type \`${s.type}\`)`);
      }
    }
    expect(
      posees,
      'AUCUNE valeur posée sous un slot typé : la résolution ne mesurerait rien (jointure vide, faux vert).',
    ).toBeGreaterThan(0);
    expect(
      fautives.sort(),
      'valeur(s) posée(s) à un slot DÉCLARÉ qui ne résolvent pas contre `_ids.generated` — une FK morte que le parse laisserait passer.',
    ).toEqual([]);
  });

  it('les slots NON résolubles ici sont au stock `SLOTS_INTERNES` : observé == stock, croissance = rouge', () => {
    const cle = (s: { dataset: string; path: string; type?: string }) => `${s.dataset} | ${s.path} | ${s.type ?? '—'}`;
    const internes = SLOTS.filter((s) => s.espece === 'id' && !estTypeDuRegistre(s.type));
    expect(
      internes.map(cle).sort(),
      'écart entre les slots d’espèce `id` visant un type INCONNU du registre et `SLOTS_INTERNES` — un slot en trop côté observé vise une entité interne à une scène que ce volet ne sait pas résoudre : il s’inscrit au stock (et se solde par `typedRef` en L2, #1473) ; un slot en trop côté stock est périmé.',
    ).toEqual(SLOTS_INTERNES.map(cle).sort());
    expect(SLOTS_INTERNES.length, 'le stock des slots INTERNES a GONFLÉ.').toBeLessThanOrEqual(0);
    expect(SLOTS_INTERNES.filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s.date))).toEqual([]);
    expect(
      GARDE.angleMort.some((a) => a.includes('`acteur`')),
      'l’espèce `acteur` sort de la résolution sans que l’angle mort le dise.',
    ).toBe(true);
    expect(SLOTS.filter((s) => s.espece === 'acteur').length, 'aucun slot `acteur` : l’angle mort porterait sur du vide.').toBeGreaterThan(0);
  });

  it('COUVERTURE : les champs porteurs de réfs OBSERVÉES sans slot déclaré == stock, et ne CROISSENT pas', () => {
    const ecarts = ecartsDeStock({ observe: champsSansSlot(scan.formes, SLOTS), stock: SLOTS_SANS_DECLARATION, cle: CLE_DETTE });
    expect(
      ecarts.neuves,
      'champ(s) en trop côté OBSERVÉ : une référence neuve qui n’a pas adopté la fabrique — elle s’adopte, elle ne s’inscrit pas au stock.',
    ).toEqual([]);
    expect(
      ecarts.perimees,
      'champ(s) en trop côté STOCK : entrée périmée — elle se retire dans le commit de l’adoption.',
    ).toEqual([]);
    expect(
      ecarts.taille,
      'clé(s) DUPLIQUÉE(S) au stock : la comparaison travaille sur des clés DISTINCTES, un doublon inscrit y passerait invisible.',
    ).toBe(SLOTS_SANS_DECLARATION.length);
    expect(ecarts.taille, 'la dette d’adoption du registre des slots a GONFLÉ.').toBeLessThanOrEqual(DETTE_ADOPTION_MAX);
  });

  it('chaque ligne du stock porte sa DATE et son LOT de mort', () => {
    expect(
      lignesMalQualifiees(SLOTS_SANS_DECLARATION.map((c) => [`${c.dataset} | ${c.champ}`, c])),
      'une ligne sans lot de mort ni date est un régime, pas un cliquet.',
    ).toEqual([]);
  });

  it('MUTATION par champ : chaque champ du stock entre dans la clé comparée', () => {
    expect(
      champsAveugles(SLOTS_SANS_DECLARATION, CLE_DETTE, ['dataset', 'champ', 'occurrences']),
      'champ(s) de stock HORS de la clé comparée : les muter laisse la garde verte.',
    ).toEqual([]);
  });

  it('le volet est ÉMIS dans `docs/structures-donnees.md` (le doc et la garde lisent la MÊME mesure)', () => {
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(doc, 'le §6 du doc a disparu : le volet SLOTS n’aurait plus de face lisible.').toContain(
      '## 6. Slots DÉCLARÉS × réfs OBSERVÉES',
    );
    expect(doc).toContain(`**${SLOTS_SANS_DECLARATION.length}** couples (dataset, champ) sans slot déclaré.`);
    expect(doc).toContain(`Slots déclarés : **${SLOTS.length}**`);
  });
});
