/**
 * Schéma de `activities.json` — catalogue UNIQUE des Activités (LDB 23, EDOC 8, MDG 15,
 * ADE II 8 Bataille de masse), miroir strict de `ActivityDef` (`src/engine/activities.ts`,
 * étend `TestSpec` de `src/engine/skills.ts`) + `OutcomeBand`/`BattleOutcome`/`BattleCond`
 * (`.../activities.ts`). Inventaire réel (40 entrées, script node) : tous les champs déclarés
 * ci-dessous sont observés au moins une fois ; aucun champ de l'interface n'est ABSENT du JSON.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, enumNomme, formulaSchema, moneyPartialSchema, stakeFormSchema } from '../grammaire/valeurs';
import { conditionSchema, gameOpSchema, stageOutcomeSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'activities.json';
export const famille = 'entite';

// `difficulty?` = Difficulté PROPRE à cette voie quand le RAW en attache une différente par
// Compétence (Punchausen, AA 12 l.45-49) — absente, la voie retombe sur `difficulty` de l'Activité.
const voieDeCompetenceSchema = refOuSpec('skill', { difficulty: difficultySchema.optional() });

/** Termes de `Formula` dont la valeur ne se connaît QU'AU jet. Un modificateur de Test d'Activité est
 *  affiché AVANT l'engagement (`activityTestMod` → volet d'Activité, ligne de pré-jet) : la valeur
 *  montrée est celle qui s'applique. Le parse les REFUSE sur `testMods[].mod`, nominativement — `sl`
 *  (les DR du Test COURANT) n'est pas davantage connu avant l'engagement. */
const TERMES_ALEATOIRES = ['dice', 'rolled', 'sl'] as const;

/** Premier terme aléatoire rencontré dans une `Formula` (les seules imbrications du dialecte :
 *  `sum[]`, `times.of`, `times.factor`), ou `null`. PURE. */
const termeAleatoire = (f: unknown): string | null => {
  if (f == null || typeof f !== 'object') return null;
  const o = f as Record<string, unknown>;
  const direct = TERMES_ALEATOIRES.find((t) => t in o);
  if (direct) return direct;
  if (Array.isArray(o.sum)) {
    for (const terme of o.sum) {
      const trouve = termeAleatoire(terme);
      if (trouve) return trouve;
    }
  }
  const times = o.times as { of?: unknown; factor?: unknown } | undefined;
  if (times) return termeAleatoire(times.of) ?? termeAleatoire(times.factor);
  return null;
};

const activityContextSchema = enumNomme({
  interlude: 'Entre deux aventures',
  voyage: 'Voyage (terre)',
  mer: 'Mer',
  bataille: 'Bataille — préparation',
  'bataille-round': 'Bataille — Scène de Round',
  auberge: 'Auberge (hub de ville)',
});

export const battleSideSchema = enumNomme({ ally: 'Armée alliée', enemy: 'Armée ennemie' });
export const battleOutcomeTargetSchema = enumNomme({
  might: 'Puissance courante',
  startMight: 'Puissance de départ',
  allyTestMod: 'Mod. Tests alliés (permanent)',
  firstRoundBonus: 'Bonus au 1er Round',
  planningBonus: 'Bonus au prochain Test de Planification',
});
export const battleOutcomeScaleSchema = enumNomme({
  fixed: 'Plat',
  perDR: '× DR',
  perHit: '× touches',
  perKill: '× ennemis tués',
});

const battleOutcomeSchema = z.strictObject({
  side: battleSideSchema.optional(),
  target: battleOutcomeTargetSchema,
  scale: battleOutcomeScaleSchema,
  amount: z.number(),
});

export const battleCondSchema = enumNomme({
  generalDown: 'Général ennemi tombé',
  intervention: 'Un autre PJ a frappé',
  noIntervention: 'Aucune intervention',
  combatWon: 'Combat gagné',
  combatLost: 'Combat perdu',
});

/** `ActivityResolver` (`src/engine/activities.ts`) — VOCABULAIRE FERMÉ des résolveurs bespoke
 *  d'Activité (dispatch `runActivityResolver`/`seaActivities`/`travelPostes`/`battleActivities`).
 *  Dupliqué à l'identique côté schéma (même patron que `stageOutcomeSchema`, `grammaire/mecanique.ts`) : un
 *  résolveur de plus = une ligne ici ET sa branche moteur. */
const activityResolverSchema = z.enum([
  // Interlude — socle (LDB 23, ACE Annexe I)
  'income', 'craftExtended', 'learnTalent', 'identify', 'entrainement', 'mecenat',
  // Interlude — bespoke
  'ritualFocus', 'masterWeapon', 'identifyByResearch', 'memorizeDiscount', 'combatTraining',
  'punchausen', 'knowledgeResearch', 'reputation', 'wrathOfTheGods', 'dissensionScout',
  'dissensionEmeute', 'contremaitre',
  // Voyage (EDOC 8) · Mer (MDG)
  'forage', 'seaChart', 'opportunityTrade', 'crewTraining',
]);

/** Nature d'une Scène de Round de Bataille de masse (ADE II 8). */
export const sceneKindSchema = enumNomme({
  test: 'Test',
  combat: 'Combat',
  threat: 'Menace',
  hold: 'Tenue',
  rally: 'Rassemblement',
});

/** Issue du Test qui ouvre une bande (absente = toute issue). */
export const outcomeOnSchema = enumNomme({ success: 'Succès', failure: 'Échec', fumble: 'Maladresse' });

const outcomeBandSchema = z.strictObject({
  on: outcomeOnSchema.optional(),
  minSL: z.number().optional(),
  maxSL: z.number().optional(),
  ops: z.array(gameOpSchema).optional(),
  resolver: activityResolverSchema.optional(),
  payoutPct: z.number().optional(),
  note: z.string().optional(),
  battle: z.array(battleOutcomeSchema).optional(),
  when: battleCondSchema.optional(),
  chains: z.array(z.string()).optional(),
});

const doc = document(
  'activities',
  famille,
  {
    contexts: z.array(activityContextSchema),
    // ── TestSpec (src/engine/skills.ts) ──
    skills: z.array(voieDeCompetenceSchema).optional(),
    char: z.string().optional(),
    difficulty: difficultySchema.optional(),
    combined: z.boolean().optional(),
    // ── ActivityDef propre ──
    freeSkill: z.boolean().optional(),
    extended: z.strictObject({ drPerStage: z.number() }).optional(),
    failExtenue: z.boolean().optional(),
    /** Modificateurs de SITUATION du Test (miroir de `ActivityDef.testMods`) : quantité `Formula` — donc
     *  un `{rule}` éditable — éventuellement gatée par une `Condition` sur l'acteur. */
    testMods: z.array(z.strictObject({
      when: conditionSchema.optional(),
      mod: formulaSchema,
      label: z.string().optional(),
    })).optional(),
    /** Dés de MONDE après le Test (miroir de `ActivityDef.worldRolls`). */
    worldRolls: z.array(z.strictObject({
      id: z.string().min(1),
      label: z.string().min(1),
      cible: formulaSchema,
      ops: z.array(gameOpSchema),
      unless: conditionSchema.optional(),
    })).optional(),
    weatherMod: z.record(z.string(), z.number()).optional(),
    resolver: activityResolverSchema.optional(),
    onSuccess: z.array(gameOpSchema).optional(),
    outcomes: z.array(outcomeBandSchema).optional(),
    where: z.array(z.string()).optional(),
    minInvest: moneyPartialSchema.optional(),
    stageOutcome: stageOutcomeSchema.optional(),
    unavailableIfExtenue: z.boolean().optional(),
    // ── Bataille de masse (ADE II 8) ──
    assisted: z.boolean().optional(),
    requires: z.array(z.string()).optional(),
    grantsFlag: z.string().optional(),
    /** Réservoir de modificateur d'armée CONSOMMÉ par le Test de cette Activité (miroir de
     *  `ActivityDef.testModFrom`) — Planification dépense `planningBonus` (ADE II 8 l.75/100). */
    testModFrom: z.enum(['allyTestMod', 'firstRoundBonus', 'planningBonus']).optional(),
    /** Difficulté DÉRIVÉE d'un écart de mesure d'armée (miroir de `ActivityDef.difficultyFrom`) —
     *  Discours inspirant : écart de Puissance arrondi à la dizaine (ADE II 8 l.71). */
    difficultyFrom: z.strictObject({
      gap: z.enum(['armyMight']),
      roundTo: z.number().optional(),
    }).optional(),
    sceneKind: sceneKindSchema.optional(),
    encounter: z.string().optional(),
    rounds: z.number().optional(),
    hold: z.strictObject({
      breakpoint: z.number(),
      maxRounds: z.number(),
      enemyBonusPerHold: z.number(),
    }).optional(),
    threat: z.strictObject({ penalty: z.number() }).optional(),
    generalDownOn: z.enum(['success', 'stupefying']).optional(),
    classGate: z.strictObject({
      classes: z.array(z.string()),
      outsidePenalty: z.number(),
      scope: z.enum(['current', 'ever']).optional(),
    }).optional(),
    // `blocked` = dette bloquante d'une Activité curée dont l'issue n'a aucun support moteur
    // (`ActivityDef.blocked`) : retirée des catalogues jouables par `activitiesFor`.
    blocked: z.strictObject({ ticket: z.string(), raison: z.string() }).optional(),
    // ── ENJEU du jet (#1117 L3) — `activities` est le 5ᵉ dataset d'enjeux, porté par l'ENTITÉ
    //    elle-même (pas de fichier tiers) : une Activité qui LANCE dit ce que son jet met en jeu.
    /** Texte d'enjeu — descripteur mécanique de ce que le résolveur applique, et/ou verbatim court. */
    stake: z.string().optional(),
    /** FORME DÉCLARÉE du `stake` (même contrat que `night-stakes`/`flow-stakes`). */
    stakeForm: stakeFormSchema.optional(),
    /** FOYER de la règle derrière le jet — id de l'entité qui la PORTE. Absent : le foyer est
     *  l'Activité elle-même (sa `desc` verbatim, catégorie Codex `activities`). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'skills'`, `'etats'`…) — exigée avec `rule`. */
    ruleCategory: z.string().optional(),
  },
  {
    contexts: {
      label: 'Contextes d’offre',
      hint: 'Situations (interlude, voyage, mer, bataille…) où l’Activité est proposée',
    },
    skills: { label: 'Compétences du Test' },
    char: { label: 'Caractéristique du Test', hint: 'Utilisée quand aucune Compétence n’est requise' },
    difficulty: { label: 'Difficulté' },
    combined: {
      label: 'Test combiné',
      hint: 'UN jet confronté aux deux premières Compétences listées ; réussi seulement si les deux cibles sont atteintes',
    },
    freeSkill: { label: 'Compétence libre', hint: 'Le joueur choisit lui-même la Compétence pratiquée' },
    extended: { label: 'Test étendu', hint: 'DR requis = un montant par Étape' },
    failExtenue: { label: 'Échec inflige Exténué' },
    weatherMod: { label: 'Modificateur météo', hint: 'Modificateur au Test, par météo' },
    resolver: { label: 'Résolveur dédié', hint: 'Logique de résolution dédiée, réutilisée plutôt que dupliquée' },
    onSuccess: { label: 'Effets de réussite' },
    outcomes: {
      label: 'Table d’issues',
      hint: 'Issues par bande de DR/résultat — prime sur les Effets de réussite simples',
    },
    where: {
      label: 'Lieux requis',
      hint: 'Lieux de la carte du monde où l’Activité est proposable ; absent = partout',
    },
    testMods: {
      label: 'Modificateurs du Test',
      hint: 'Modificateurs de situation, chacun éventuellement conditionné à l’état de l’acteur',
    },
    worldRolls: {
      label: 'Tirages d’environnement',
      hint: 'Pourcentages roulés après le Test ; une condition d’exemption peut en dispenser l’acteur',
    },
    minInvest: { label: 'Mise minimale', hint: 'Montant minimal engagé (dépôt bancaire…)' },
    stageOutcome: { label: 'Issue par Étape', hint: 'Effet de portée Étape, pour les Activités de voyage' },
    unavailableIfExtenue: { label: 'Indisponible si Exténué' },
    assisted: { label: 'Test à soutien', hint: 'Les assistants capables ajoutent un bonus au meneur du Test' },
    requires: { label: 'Préparations requises', hint: 'Préparations à satisfaire avant de proposer l’Activité' },
    grantsFlag: {
      label: 'Préparation octroyée',
      hint: 'Préparation accordée sur réussite, débloquant une autre Activité',
    },
    testModFrom: {
      label: 'Réservoir de modificateur consommé',
      hint: 'Réserve de modificateur d’armée dépensée par le Test de cette Activité',
    },
    difficultyFrom: {
      label: 'Difficulté dérivée',
      hint: 'Difficulté calculée depuis un écart de mesure d’armée, plutôt que fixe',
    },
    sceneKind: {
      label: 'Genre de Scène',
      hint: 'Nature de la Scène de Round (test/combat/menace/tenue de position/rassemblement)',
    },
    encounter: { label: 'Rencontre', hint: 'Identifiant de la rencontre démarrée par la Scène' },
    rounds: { label: 'Durée en Rounds', hint: 'Durée indicative de la Scène' },
    hold: {
      label: 'Tenue de position',
      hint: 'Seuil de rupture, Rounds max, bonus d’opposition cumulatif par Round tenu',
    },
    threat: {
      label: 'Pénalité de menace',
      hint: 'Pénalité infligée aux Tests des autres Scènes tant que la Scène Menace est active',
    },
    generalDownOn: {
      label: 'Chute du général',
      hint: 'Résultat de Test requis pour faire tomber le général/capitaine ennemi',
    },
    classGate: { label: 'Restriction de Classe', hint: 'Classes couvertes par l’Activité et pénalité hors Classe' },
    blocked: {
      label: 'Dette bloquante',
      hint: 'Sous-système non modélisé : l’Activité est retirée des catalogues jouables tant que non soldée',
    },
    stake: { label: 'Enjeu' },
    stakeForm: { label: 'Forme de l’enjeu' },
    rule: {
      label: 'Règle associée',
      hint: 'Identifiant de l’entité qui porte la règle derrière le jet ; absent, c’est l’Activité elle-même',
    },
    ruleCategory: { label: 'Catégorie de la règle', hint: 'Catégorie Codex de l’entité désignée par « Règle associée »' },
  },
  {
    codex: { keys: ['activities'] },
    edit: { dataset: 'activities' },
  },
  {
    exiges: ['source', 'icon'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const a = v as { id: string; stake?: string; stakeForm?: string; rule?: string; ruleCategory?: string };
        if (a.stake && !a.stakeForm) {
          ctx.addIssue({ code: 'custom', message: `${a.id} : enjeu sans forme déclarée (stakeForm)` });
        }
        if (a.stakeForm && !a.stake) {
          ctx.addIssue({ code: 'custom', message: `${a.id} : forme d’enjeu déclarée sans enjeu` });
        }
        if (a.rule && !a.ruleCategory) {
          ctx.addIssue({ code: 'custom', message: `${a.id} : rule sans ruleCategory` });
        }
        for (const m of (v as { testMods?: { mod?: unknown; label?: string }[] }).testMods ?? []) {
          const terme = termeAleatoire(m.mod);
          if (terme) {
            ctx.addIssue({
              code: 'custom',
              path: ['testMods'],
              message: `${a.id} : testMods${m.label ? ` « ${m.label} »` : ''} — le terme \`{${terme}}\` est tiré au jet, or un modificateur de Test est AFFICHÉ avant l'engagement. Emploie un littéral ou un \`{rule}\` éditable.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
