/**
 * COMPLÉTUDE de l'enjeu DÉRIVÉ (#1262 V2 L6d) — la garde qui remplace une dotation à la main.
 *
 * Arbitrage user 2026-08-12 (verbatim au ticket #1262) : « Le socle dérive l'enjeu de l'entité
 * porteuse ("ce qui se joue : [sort/objet X]" + renvoi Codex […]). Zéro saisie, les 74 nœuds sont
 * couverts par construction […]. Un auteur PEUT toujours surcharger par un texte authoré. »
 *
 * Ce que ce fichier mesure, sur la DONNÉE RÉELLE (jamais une liste recopiée) : CHAQUE nœud Flow
 * `kind:'test'` de `src/data/*.json` produit un enjeu RÉSOLU non vide, au bout du chemin de
 * production — `withDerivedStake` (les deux étages) → `simpleTriggeredTestStep` (le mint, qui exige
 * désormais l'enjeu au TYPE) → `resolveStake` (la porte unique de la surface).
 *
 * CE QU'ELLE VOIT (fail-closed sur l'avenir) : un fichier de données NEUF portant un `kind:'test'`
 * sans nature de source déclarée ici rougit — la table `KIND_PAR_FICHIER` est le seul endroit où une
 * famille d'entités se rattache à son `EffectSourceKind`, et l'oublier ne peut pas passer en silence.
 * Seconde porte, MEME contrat : `ENJEU_AU_PRODUCTEUR`, pour les nœuds dont l'enjeu n'est PAS dérivable
 * d'une nature de source (rangée de Critique — cf. sa déclaration).
 *
 * CE QU'ELLE NE PEUT PAS VOIR, et pourquoi (limite STRUCTURELLE, pas un manque de zèle) : la RÉF
 * PENDANTE. L'enjeu dérivé ne stocke aucun id authoré — il LIT celui de l'entrée qui porte le nœud
 * (`entree.id`). Renommer une entrée déplace donc l'entrée ET sa réf du même geste, et `findById` la
 * retrouve : aucune mutation de renommage ne peut rendre cette garde rouge. C'est le corollaire de la
 * forme choisie (dérivée, jamais authorée) — le risque de réf morte n'existe que pour les datasets
 * d'enjeux à `rule`/`entryId` authorés, où il est mesuré ailleurs (`data/stake-rule-ratchet.test.ts`,
 * volet « aucun renvoi MORT »). La mutation qui MORD ici est la dérivation débranchée, pas le renommage.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simpleTriggeredTestStep, withDerivedStake } from './combat/triggeredTest';
import { effectSourcesOf } from './triggeredEffects';
import { EMPTY_FLOW, type Flow } from './flow';
import { noeudsDeTest, KIND_PAR_FICHIER } from './noeudsDeTest.testkit';
import { resolveStake, findById, combatStakeRef, type StakeRef } from '../data';
import { CRITIQUE_DOCS } from '../data/criticals';
import { scanFlowTestEngineRoll, siteLabel } from '../../scripts/guards/lib/flowTestEngineRoll.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, type ShipCritSet, type ShipCritKey } from '../data/shipCriticals';
import { resolveCritique } from '../engine/critical';
import { rollShipCritical } from '../engine/shipCritical';
import { makeRNG } from '../engine/dice';
import { applyOps } from '../engine/ops';
import { recomputeLoadout, parseDamage } from '../engine/items';
import type { TriggeredEffect } from '../engine/flowCore';
import { CATEGORY_BY_SOURCE_KIND, type Combatant, type HitLocation, type ItemInstance } from '../engine/types';

/**
 * Familles dont l'ENJEU est POSÉ PAR LE PRODUCTEUR moteur (patron `miscast.mkTest`) — ni une exemption
 * ni un silence : le fichier listé ici est tenu au MÊME contrat positif, mais interrogé par SON
 * producteur au lieu de la dérivation par nature de source.
 *
 * POURQUOI cette seconde porte, nommée : `KIND_PAR_FICHIER` est une table 1:1 `fichier →
 * EffectSourceKind → UNE catégorie Codex`, et elle rattache le nœud à l'entrée de TÊTE du document.
 * Une rangée de Critique ne tient dans NI l'un NI l'autre : son foyer est la LIGNE (`nez-casse`), pas le
 * document-table (`criticals-ldb-tete`), et cette ligne vit dans l'une des 8 catégories que la porte (b)
 * `entryCategory` choisit AU TIRAGE (`data/index.ts`, `STAKE_ENTRY_POOLS` : `criticalsTete`…
 * `aaCriticalsJambe`). Le producteur est donc le seul à pouvoir la nommer — exactement comme
 * `miscast.mkTest`, dont le nœud n'existe pas non plus en donnée.
 *
 * Chaque entrée rend, pour CHAQUE nœud `test` du fichier, l'enjeu que la production pose réellement.
 */
const ENJEU_AU_PRODUCTEUR: Record<string, () => { entryId: string; stake: StakeRef | undefined }[]> = {
  'criticals.json': enjeuxDesRangeesDeCritique,
  // Coup à l'ÉQUIPAGE d'un Critique de coque (MSRC 07 l.78/l.94, MDG 13 l.763) : même raison exactement
  // — le foyer est la RANGÉE (`greement-fluvial`, `canon-detache`), qui vit dans l'une des 10
  // catégories Codex de coque choisies à la LOCALISATION touchée, jamais le document-table.
  'river-criticals.json': () => enjeuxDesCoupsAEquipage(RIVER_CRIT_SET),
  'ship-criticals.json': () => enjeuxDesCoupsAEquipage(SHIP_CRIT_SET),
};

/** Les enjeux RÉELLEMENT posés par `rollShipCritical` sur les nœuds `test` d'un jeu de Critiques de
 *  coque : un par rangée portant un coup à l'équipage À ÉPREUVE (un coup CERTAIN — `ops`, MSRC 07
 *  l.82 — n'a pas de nœud, donc rien à nommer). Dé FORCÉ sur le `min` de la rangée → c'est bien SA
 *  ligne qui sort. */
function enjeuxDesCoupsAEquipage(jeu: ShipCritSet): { entryId: string; stake: StakeRef | undefined }[] {
  const out: { entryId: string; stake: StakeRef | undefined }[] = [];
  for (const [loc, rows] of Object.entries(jeu.tables)) {
    for (const e of rows ?? []) {
      if (!e.crewHit?.test) continue;
      const resolu = rollShipCritical(loc as ShipCritKey, makeRNG(1), e.min, jeu);
      out.push({ entryId: e.id, stake: resolu.crewHit?.test?.test.stake });
    }
  }
  return out;
}

/**
 * Nœuds `test` que le PRODUCTEUR fabrique EN PLUS de ceux écrits en donnée — cardinal MESURÉ au
 * 2026-09-03 (#1657 B3-1b) : les 26 rangées `amputation` de `criticals.json` imposent 28 Tests de
 * Résistance (LDB 18 l.237), les 2 rangées à gate `loss.difficulty` (« Coupure à l'orteil », l.171)
 * en portant DEUX. Sans ce cardinal, la sonde pourrait perdre un nœud fabriqué sans rougir.
 */
const NOEUDS_FABRIQUES: Record<string, number> = { 'criticals.json': 28 };

/** LOCALISATION représentative d'une table (`critTableKeyFor` la reprojette à l'identique). */
const LOC_PAR_TABLE: Record<string, HitLocation> = { tete: 'tete', bras: 'brasD', corps: 'corps', jambe: 'jambeD' };

/** Tous les nœuds `test` d'un Flow, dans l'ordre de jeu — le producteur en pose plusieurs (rangée,
 *  puis Test(s) d'Amputation) et le contrat les tient TOUS, jamais le premier seulement. */
function noeudsDuFlow(f: Flow | undefined): Extract<Flow, { kind: 'test' }>[] {
  if (!f) return [];
  switch (f.kind) {
    case 'test': return [f, ...noeudsDuFlow(f.success), ...noeudsDuFlow(f.fail)];
    case 'seq': return f.steps.flatMap(noeudsDuFlow);
    case 'if': return [...noeudsDuFlow(f.then), ...noeudsDuFlow(f.else)];
    case 'choice': return [...noeudsDuFlow(f.yes), ...noeudsDuFlow(f.no)];
    default: return [];
  }
}

/**
 * Les enjeux RÉELLEMENT posés par `resolveCritique` sur les nœuds `test` de `criticals.json` : ceux de
 * la rangée et de son/ses Test(s) d'Amputation (dé FORCÉ sur son propre `min` → c'est bien SA ligne qui
 * sort), celui du nœud ARMÉ sur le marqueur d'amputation DIFFÉRÉE (`Trauma.pendingAmputation`), et celui
 * du nœud d'escalade armé sur la séquelle (`Trauma.critTrigger`, posé par `stampCriticalEscalation`).
 * Un nœud produit SANS enjeu est un jet muet : il rougit ici, quelle que soit sa place dans le Flow.
 */
function enjeuxDesRangeesDeCritique(): { entryId: string; stake: StakeRef | undefined }[] {
  const out: { entryId: string; stake: StakeRef | undefined }[] = [];
  for (const doc of CRITIQUE_DOCS) {
    const loc = LOC_PAR_TABLE[doc.localisation];
    for (const e of doc.entries) {
      if (!e.test && !e.amputation && !e.escalation?.onNextCritWhileCondition) continue;
      const crit = resolveCritique(doc.jeu, hero(), loc, makeRNG(1), { forcedRoll: e.min });
      const differee = crit.traumas.find((t) => t.pendingAmputation)?.pendingAmputation;
      const noeuds = [...noeudsDuFlow(crit.testFlow), ...noeudsDuFlow(differee)];
      // Cardinal ATTENDU, nommé : 1 par rangée à `test` + les Tests que l'Amputation impose (2 quand la
      // ligne porte un gate `loss.difficulty`, 1 sinon) — un nœud PERDU en route ne peut pas se cacher.
      const attendus = (e.test ? 1 : 0) + (e.amputation ? (e.amputation.loss?.difficulty ? 2 : 1) : 0);
      expect(noeuds.length, `${e.id} : ${noeuds.length} nœud(s) produits pour ${attendus} attendu(s)`).toBe(attendus);
      for (const n of noeuds) out.push({ entryId: e.id, stake: n.test.stake });
      const arme = crit.traumas.find((t) => t.critTrigger)?.critTrigger;
      if (e.escalation?.onNextCritWhileCondition) out.push({ entryId: e.id, stake: arme?.test.test.stake });
    }
  }
  return out;
}

const hero = (): Combatant => ({
  id: 'H1', label: 'Sonde', kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [], talents: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
} as unknown as Combatant);

const BRANCHES = { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW };

describe('#1262 V2 L6d — TOUT `FlowTest` de la donnée dit ce qui se joue', () => {
  const noeuds = noeudsDeTest();

  it('la sonde MESURE quelque chose (sinon elle serait verte à vide)', () => {
    expect(noeuds.length, 'aucun nœud `kind:test` trouvé : le scan de la donnée a glissé').toBeGreaterThanOrEqual(70);
  });

  it('chaque famille porteuse de `FlowTest` a sa NATURE de source déclarée (ou son producteur)', () => {
    const orphelines = [...new Set(noeuds.map((n) => n.fichier))]
      .filter((f) => !KIND_PAR_FICHIER[f] && !ENJEU_AU_PRODUCTEUR[f]);
    expect(orphelines, 'famille de données porteuse d’un jet sans nature de source : son enjeu ne pourrait pas se dériver').toEqual([]);
  });

  /** MÊME contrat positif que la dérivation, sur les familles dont le producteur pose l'enjeu : chaque
   *  nœud dit ce qui se joue, et le renvoi Codex descend à LA RANGÉE qui exige le jet (jamais au
   *  document-table, jamais au foyer générique du `kind`). Mesuré sur la production, pas sur une liste. */
  it('enjeu POSÉ PAR LE PRODUCTEUR : chaque nœud renvoie à la fiche de SA rangée', () => {
    const muets: string[] = [];
    let mesures = 0;
    for (const [fichier, produire] of Object.entries(ENJEU_AU_PRODUCTEUR)) {
      const poses = produire();
      const attendus = noeuds.filter((n) => n.fichier === fichier).length + (NOEUDS_FABRIQUES[fichier] ?? 0);
      expect(poses.length, `${fichier} : ${poses.length} enjeu(x) pour ${attendus} nœud(s) — la sonde a glissé`).toBe(attendus);
      for (const { entryId, stake } of poses) {
        mesures++;
        if (!stake) { muets.push(`${fichier}:${entryId} — nœud sans enjeu`); continue; }
        const resolu = resolveStake(stake);
        if (!resolu.rule) muets.push(`${fichier}:${entryId} — aucun renvoi Codex`);
        // Le renvoi doit descendre à la RANGÉE : un `entryId` que le pool de sa catégorie ne connaît
        // pas replie sur le foyer du `kind` (`blessures-critiques`) — c'est ce repli que cette
        // comparaison attrape, sans jamais avoir à lister les 8 catégories ici.
        else if (resolu.rule.id !== entryId) muets.push(`${fichier}:${entryId} — renvoi hors de sa propre rangée (${resolu.rule.category}:${resolu.rule.id})`);
      }
    }
    expect(mesures, 'la sonde du producteur n’a rien mesuré').toBeGreaterThanOrEqual(70);
    expect(muets, ['Jet de donnée MUET — chaque nœud posé par son producteur dit ce qui se joue :', ...muets].join('\n')).toEqual([]);
  });

  it('chaque nœud produit une étape MINTÉE dont l’enjeu se résout en texte + renvoi Codex', () => {
    const muets: string[] = [];
    for (const n of noeuds) {
      const kind = KIND_PAR_FICHIER[n.fichier];
      if (!kind) continue; // dit par le test précédent
      const ft = withDerivedStake(n.ft, { kind, id: n.entryId });
      const step = simpleTriggeredTestStep(hero(), ft, BRANCHES, EMPTY_FLOW, 'intermediaire');
      if (!step?.stake) { muets.push(`${n.fichier}:${n.entryId} — étape sans enjeu`); continue; }
      const resolu = resolveStake(step.stake);
      const label = findById(CATEGORY_BY_SOURCE_KIND[kind], n.entryId)?.label;
      if (!resolu.text?.trim()) muets.push(`${n.fichier}:${n.entryId} — enjeu résolu vide`);
      else if (label && !resolu.text.includes(label)) muets.push(`${n.fichier}:${n.entryId} — l’enjeu ne nomme pas l’entité (« ${resolu.text} »)`);
      if (!resolu.rule) muets.push(`${n.fichier}:${n.entryId} — aucun renvoi Codex`);
      else if (resolu.rule.id !== n.entryId) muets.push(`${n.fichier}:${n.entryId} — renvoi hors de sa propre fiche (${resolu.rule.category}:${resolu.rule.id})`);
    }
    expect(muets, ['Jet de donnée MUET — chaque `FlowTest` dit ce qui se joue :', ...muets].join('\n')).toEqual([]);
  });

  /**
   * ASSERTION INVERSE (#1657 B3-3) — « un chemin de résolution par la porte existe, ET AUCUN AUTRE ».
   *
   * Les `it` ci-dessus tiennent le premier bout : chaque nœud authoré atteint un routeur canonique, qui
   * monte une étape à enjeu résolu. Ça ne dit RIEN du second : un résolveur de `src/engine/**` qui LIT
   * un nœud et le ROULE consomme le jet AVANT la porte, et la donnée reste pourtant « routée » sur le
   * papier — c'est exactement ce que faisaient les 42 nœuds de Critiques/équipage/maladie jusqu'en B3.
   *
   * Le second bout se mesure donc sur le MOTEUR, avec le scanner du garde (aucun second socle) : la
   * population attendue est VIDE. Contrat POSITIF, sans liste ni exemption — le seul moyen d'y échapper
   * serait de RENDRE le nœud (`miscast.mkTest`) ou de le DIFFÉRER (`UpkeepDeferTest`), c'est-à-dire de
   * repasser par la porte.
   */
  it('assertion INVERSE : les 3 portes existent, et AUCUN moteur ne résout un nœud hors d’elles', () => {
    const portes: [string, string][] = [
      ['resolveFlowTest', 'src/state/combat/triggeredTest.ts'],
      ['resolveInlineFlowTest', 'src/state/triggeredEffects.ts'],
      ['bandeTriggeredTest', 'src/state/combat/triggeredTest.ts'],
    ];
    const RACINE = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
    const absentes = portes.filter(([nom, fichier]) =>
      !new RegExp(`function\\s+${nom}\\b`).test(readFileSync(join(RACINE, fichier), 'utf8')));
    expect(absentes.map(([n]) => n), 'porte de résolution introuvable : la thèse n’est plus mesurable').toEqual([]);

    const corpus = readCorpus(['src/engine']).map(({ rel, text }) => ({ rel, text }));
    const rouleurs = scanFlowTestEngineRoll(corpus).map(siteLabel);
    expect(
      rouleurs,
      'un résolveur de `src/engine/**` consomme un nœud `test` AVANT la porte : la donnée serait « routée »\n'
      + 'sans que le joueur voie rien (ni enjeu, ni Chance, ni Résilience, et la valeur ne serait pas celle\n'
      + 'de la porte). Sites :\n' + rouleurs.join('\n'),
    ).toEqual([]);
    expect(noeuds.length + Object.values(NOEUDS_FABRIQUES).reduce((s, n) => s + n, 0),
      'la sonde doit couvrir une population RÉELLE de nœuds, sinon « aucun autre chemin » ne dit rien').toBeGreaterThanOrEqual(100);
  });

  /** L'ENJEU DÉCLARÉ PRIME — l'étage 1 du contrat : la dérivation ne recouvre jamais ce que le
   *  producteur (dataset) ou l'auteur (document) a dit lui-même. */
  it('un enjeu DÉCLARÉ sur le nœud prime sur celui du porteur', () => {
    const declare = combatStakeRef('fatigue');
    const ft = withDerivedStake({ skill: { id: 'resistance' }, label: 'Résister', stake: declare }, { kind: 'condition', id: 'empoisonne' });
    expect(ft.stake, 'la dérivation a recouvert un enjeu déclaré').toBe(declare);

    const authore = { authored: 'Tenir la corniche, ou tomber.' };
    const ftA = withDerivedStake({ skill: { id: 'escalade' }, stake: authore }, { kind: 'spell', id: 'chute' });
    expect(ftA.stake).toBe(authore);
  });

  /** FAIL-CLOSED de la dérivation : sans porteur, ou avec un porteur qui ne nomme aucune fiche, on
   *  se TAIT (jamais une phrase qui nommerait un id brut ou renverrait vers un foyer mort). */
  it('sans porteur résoluble, la dérivation se tait (elle n’invente rien)', () => {
    expect(withDerivedStake({ skill: { id: 'resistance' }}, undefined).stake).toBeUndefined();
    expect(withDerivedStake({ skill: { id: 'resistance' }}, { kind: 'spell', id: 'sort-qui-n-existe-pas' }).stake).toBeUndefined();
  });
});

/**
 * PROVENANCE des effets FONDUS dans un objet (#1262 V2 L6d, verdict du juge G1) — un enjeu qui NOMME
 * la mauvaise entité est pire qu'un silence : il se lit comme une vérité.
 *
 * Cinq entités de donnée exigent un jet par un `onHitEffects`, en DEUX classes que ce volet sépare :
 *  · FONDUE par une op (`augmentWeapon`) — les sorts `morsure-de-l-hiver` / `epee-de-justice` et les
 *    poisons `lotus-noir` / `racine-des-tombes` (consommables qui enduisent la lame) : l'effet vit
 *    ensuite dans `weapon.onHitEffects` (`applyEnchants`, engine/weaponDamage) et le dispatcher
 *    (`effectSourcesOf`) tague au porteur ce qui n'a pas déjà de source. Sans provenance conservée,
 *    l'enjeu disait « ce qui se joue : Épée » ;
 *  · EN PROPRE sur l'objet (`TrappingData.onHitEffects`) — `dechireur-de-sociabilite` : là,
 *    l'attribution à l'objet est JUSTE, c'est bien lui qui exige le jet. Ce volet le fige aussi,
 *    pour qu'une « correction » ne le casse pas au passage.
 */
describe('#1262 V2 L6d — l’enjeu nomme l’entité qui EXIGE le jet, jamais l’arme qui la porte', () => {
  const arme = (): ItemInstance => ({ uid: 'w', label: 'Épée', kind: 'melee', damage: parseDamage('+BF+4'), reach: 'Moyenne', range: null, qualities: [], enc: 1, equipped: true } as unknown as ItemInstance);

  const porteur = (): Combatant => {
    const c = hero();
    (c as unknown as { items: ItemInstance[] }).items = [arme()];
    (c as unknown as { loadouts: unknown[] }).loadouts = [{ id: 'lo', main: 'w' }];
    (c as unknown as { activeLoadoutId: string }).activeLoadoutId = 'lo';
    recomputeLoadout(c);
    return c;
  };

  /** Le Test « à la touche » authoré par le sort (forme réelle de `morsure-de-l-hiver`). */
  const testOnHit = { trigger: 'onHit', on: 'victim', flow: { kind: 'test', test: { skill: 'resistance', difficulty: 'intermediaire' }, success: EMPTY_FLOW, fail: EMPTY_FLOW } } as unknown as TriggeredEffect;

  it('effet FONDU par un sort : l’enjeu nomme le SORT (jamais l’épée qui le porte)', () => {
    const c = porteur();
    applyOps(c, [{ op: 'augmentWeapon', onHitEffects: [testOnHit] }], { label: 'Morsure de l’hiver', source: { kind: 'spell', id: 'morsure-de-l-hiver' }, defaultDurationRounds: 4 });
    const src = effectSourcesOf(c, c.weapons[0]).find((s) => s.key.startsWith('weapon:'))!;
    const eff = src.effects[0];
    expect(eff.source, 'la provenance du sort est perdue en route').toEqual({ kind: 'spell', id: 'morsure-de-l-hiver' });
    const stake = withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake!;
    const texte = resolveStake(stake).text!;
    expect(texte).toContain(findById('spells', 'morsure-de-l-hiver')!.label);
    expect(texte, 'l’enjeu nomme l’ARME : il ment sur ce qui se joue').not.toContain('Épée');
    expect(resolveStake(stake).rule).toEqual({ category: 'spells', id: 'morsure-de-l-hiver' });
  });

  it('effet FONDU par un POISON bu : l’enjeu nomme le poison (même règle, autre nature de source)', () => {
    const c = porteur();
    applyOps(c, [{ op: 'augmentWeapon', onHitEffects: [testOnHit] }], { label: 'Lotus noir', source: { kind: 'trapping', id: 'lotus-noir' }, defaultDurationRounds: 4 });
    const eff = effectSourcesOf(c, c.weapons[0]).find((s) => s.key.startsWith('weapon:'))!.effects[0];
    const texte = resolveStake(withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake!).text!;
    expect(texte).toContain(findById('trappings', 'lotus-noir')!.label);
    expect(texte).not.toContain('Épée');
  });

  it('effet EN PROPRE de l’objet : l’enjeu nomme l’OBJET — c’est lui qui exige le jet', () => {
    const c = hero();
    const w = { label: 'Déchireur de sociabilité', trappingId: 'dechireur-de-sociabilite', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], onHitEffects: [testOnHit] } as unknown as Combatant['weapons'][number];
    const eff = effectSourcesOf(c, w).find((s) => s.key.startsWith('weapon:'))!.effects[0];
    expect(eff.source).toEqual({ kind: 'trapping', id: 'dechireur-de-sociabilite' });
    expect(resolveStake(withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake!).text)
      .toContain(findById('trappings', 'dechireur-de-sociabilite')!.label);
  });

  /** SANS provenance (op appliquée hors de tout contexte d'entité) : le socle SE TAIT — il ne se
   *  rabat pas sur l'arme. C'est la règle du lot : se taire plutôt que mentir. */
  it('effet fondu SANS provenance : la dérivation se tait plutôt que de nommer l’arme', () => {
    const c = porteur();
    applyOps(c, [{ op: 'augmentWeapon', onHitEffects: [testOnHit] }], { label: 'Enchantement anonyme', defaultDurationRounds: 4 });
    const eff = effectSourcesOf(c, c.weapons[0]).find((s) => s.key.startsWith('weapon:'))!.effects[0];
    // Le dispatcher tague au porteur ce qui n'a pas de source : ici l'arme est SANS id de catalogue
    // (arme forgée pour la sonde) → aucune fiche à nommer, la dérivation rend `undefined`.
    expect(withDerivedStake({ skill: { id: 'resistance' }}, eff.source).stake).toBeUndefined();
  });
});
