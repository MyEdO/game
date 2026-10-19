import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** NADJ 16 l.11 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, enumNomme, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { facilitationSchema, gameOpSchema, jetSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'tavernGames.json';
export const famille = 'entite';

const charKeySchema = z.enum([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

/** Les effets de LANCER enregistrés (`registerSequenceThrow`, `src/state/sequenceCore.ts`) — ce qui
 *  indexe est le nom d'un EFFET, jamais l'identité d'une entrée de catalogue. */
const throwEffectSchema = z.enum([
  'dr', 'dr-ecrete', 'toute-la-reserve', 'points-de-la-ligne', 'points-de-la-ligne-suivante',
  'chiffres-du-de', 'gain-au-choix', 'aucun-gain', 'termine-le-passage',
]);

/** Le paramètre que chaque effet de Spécial exige — et lui seul. */
const PARAMETRE_DE_L_EFFET = { cran: 'steps', difficulte: 'difficulty' } as const;

/** Les effets d'un Spécial, et leurs libellés. */
const EFFETS_DE_SPECIAL = { cran: 'Décalage de Difficulté (crans)', difficulte: 'Difficulté imposée' } as const;

/** Les libellés des champs d'un Spécial — ceux de l'éditeur ET des refus du schéma. */
const META_DE_SPECIAL = {
  effet: { label: 'Effet' },
  hasTalent: { label: 'Talent' },
  steps: { label: 'Crans (plus facile si positif)' },
  difficulty: { label: 'Difficulté imposée' },
  source: { label: 'Source' },
} as const;

/** NADJ 16 l.82 ; le Talent et les crans sont ceux de la facilitation d'un jet (`facilitationSchema`),
 *  la Difficulté posée celle du jet (`jetSchema`). */
const specialSchema = nommerChamps(z.strictObject({
  effet: enumNomme(EFFETS_DE_SPECIAL),
  ...facilitationSchema.pick({ hasTalent: true, steps: true }).shape,
  ...jetSchema.pick({ difficulty: true }).shape,
  source: sourceRefSchema,
}).superRefine((v, ctx) => {
  const champ = (cle: keyof typeof META_DE_SPECIAL) => META_DE_SPECIAL[cle].label;
  const effet = (e: keyof typeof EFFETS_DE_SPECIAL) => EFFETS_DE_SPECIAL[e];
  if (v.hasTalent === undefined) ctx.addIssue({ code: 'custom', path: ['hasTalent'], message: `Spécial : « ${champ('hasTalent')} » est requis.` });
  if (v.effet === 'cran' && v.steps === 0) ctx.addIssue({ code: 'custom', path: ['steps'], message: `Spécial « ${effet('cran')} » : « ${champ('steps')} » à 0 ne décale rien.` });
  for (const [e, cle] of Object.entries(PARAMETRE_DE_L_EFFET) as [keyof typeof EFFETS_DE_SPECIAL, keyof typeof META_DE_SPECIAL][]) {
    const pose = v[cle] !== undefined;
    if (e === v.effet && !pose) {
      ctx.addIssue({ code: 'custom', path: [cle], message: `Spécial « ${effet(v.effet)} » : « ${champ(cle)} » est requis.` });
    }
    if (e !== v.effet && pose) {
      ctx.addIssue({ code: 'custom', path: [cle], message: `Spécial « ${effet(v.effet)} » : « ${champ(cle)} » appartient à l’effet « ${effet(e)} ».` });
    }
  }
}), META_DE_SPECIAL);

/** Le jeu se résout-il par un TEST ? — seule capacité qu'un Spécial exige (NADJ 16 l.82). */
function joueUnTest(jeu: { mode?: string }): boolean {
  return jeu.mode !== undefined;
}

const doc = document(
  'tavernGames',
  famille,
  {
    /** NADJ 16 l.90, l.105, l.125, l.145 */
    ...jetSchema.shape,
    /** NADJ 16 l.11 */
    fastSkill: nommerChamps(z.strictObject({
      skill: refOuSpec('skill').optional(),
      char: charKeySchema.optional(),
      /** Tag MAISON obligatoire : cet override n'est pas dans la source. */
      maison: z.string(),
    }), {
      skill: { label: 'Compétence' },
      char: { label: 'Caractéristique' },
      maison: { label: 'Arbitrage maison' },
    }).optional(),
    /** Absent quand le jeu ne se résout pas au Test : l'Al-zahr est un jeu de MISE (`pot`). */
    mode: z.enum(['opposed', 'extended']).optional(),
    target: z.number().optional(),
    drCap: z.number().optional(),
    /** Id du départage d'égalité résolu par le socle de séquence (`units-lowest` Dominos l.105,
     *  `nul` Boules l.57) — consommé par `src/state/sequenceCore.ts` (`resolveSequenceTie`). */
    tieBreak: z.enum(['units-lowest', 'nul']).optional(),
    /** Bonus de Caractéristique ajouté au DR de chaque manche (Bras de fer l.34 : Force) — consommé
     *  par `SequenceParams.drBonus` (`src/state/sequenceCore.ts`). */
    drBonus: charKeySchema.optional(),
    /** L'Avantage est en jeu, aux règles habituelles (NADJ 16 l.34, l.119) — `options[].combatTest` dit
     *  quel Test d'un jeu à options admet le +10 (LDB 14 l.215). */
    avantage: z.boolean().optional(),
    /** Effets PAR MANCHE en `GameOp[]` (Bras de fer l.34 : +1 Avantage au vainqueur du tour,
     *  +1 Exténué tous les (Bonus d'Endurance) tours) — `SequenceParams.rounds`. */
    roundOps: nommerChamps(z.strictObject({
      winner: z.array(gameOpSchema).optional(),
      attrition: z.array(gameOpSchema).optional(),
      attritionEvery: z.union([z.number(), nommerChamps(z.strictObject({ charBonus: charKeySchema }), { charBonus: { label: 'Bonus de Caractéristique' } })]).optional(),
    }), {
      winner: { label: 'Vainqueur' },
      attrition: { label: 'Attrition' },
      attritionEvery: { label: 'Fréquence d’attrition' },
    }).optional(),
    /** Effectif RAW d'un camp d'un jeu d'ÉQUIPE (Middenball l.119 : 11 par équipe) — le groupe le
     *  complète de figurants (`src/state/tavernFlow.ts`). */
    team: nommerChamps(z.strictObject({ size: z.number() }), { size: { label: 'Taille' } }).optional(),
    /** FORME d'un tour (capacité DÉCLARÉE, jamais déduite d'un effectif) : `team` = tous testent et on
     *  somme par équipe (Middenball l.119) ; `thrower` = un tour, un lanceur (Torchon l.111). */
    roundShape: z.enum(['team', 'thrower', 'pot', 'volley']).optional(),
    /** Options de Test d'une manche (Middenball l.119 : Bagarre (+20) OU Athlétisme (+0)) — le choix
     *  va au joueur ; la 1ʳᵉ option est celle que suivent les porteurs sans siège et les figurants. */
    options: z.array(nommerChamps(z.strictObject({
      skill: refOuSpec('skill').optional(),
      char: charKeySchema.optional(),
      difficulty: difficultySchema,
      /** LDB 14 l.215 */
      combatTest: z.boolean().optional(),
    }), {
      skill: { label: 'Compétence' },
      char: { label: 'Caractéristique' },
      difficulty: { label: 'Difficulté' },
      combatTest: { label: 'Test de combat' },
    })).min(2).optional(),
    /** Formule de score d'un CAMP (`registerSequenceScore` : `sum` pour une équipe, l.119). */
    campScore: z.enum(['min', 'max', 'sum', 'first']).optional(),
    /** Seuil d'un acquis de manche (Middenball l.119 : but à 25 DR d'équipe). */
    scoreThreshold: z.number().optional(),
    /** Mi-temps (Middenball l.119 : deux mi-temps de trois tours). */
    phases: nommerChamps(z.strictObject({ count: z.number(), rounds: z.number() }), { count: { label: 'Nombre' }, rounds: { label: 'Rounds' } }).optional(),
    /** Effectif du cercle qui esquive (Torchon l.109-111 : 11 danseurs, cible tirée au sort). */
    dancers: z.number().optional(),
    /** Table de score par plage de DR (Torchon l.111) — lue par `findTableEntry` via le socle. */
    table: z.array(nommerChamps(z.strictObject({
      ...plageSchema.shape, points: z.number(), label: z.string(),
    }), { ...metaDesChamps(plageSchema, { exigees: true }), points: { label: 'Points' }, label: { label: 'Libellé' } })).optional(),
    /** VOLÉE de lancers (famille 7 du socle) : Bête l.42, Arène l.70, Fléchettes l.97, Boules l.57.
     *  `gain`/`critique`/`maladresse`/`depassement` nomment un effet de lancer ENREGISTRÉ
     *  (`registerSequenceThrow`, `src/state/sequenceCore.ts`), jamais un id de jeu. */
    volley: nommerChamps(z.strictObject({
      throws: z.number(),
      reserve: z.number().optional(),
      pick: z.enum(['reserve', 'choix']).optional(),
      rows: z.array(nommerChamps(z.strictObject({
        min: z.number().optional(),
        max: z.number().optional(),
        difficulty: difficultySchema.optional(),
        points: z.number().optional(),
        label: z.string(),
      }), {
        min: { label: 'Minimum' },
        max: { label: 'Maximum' },
        difficulty: { label: 'Difficulté' },
        points: { label: 'Points' },
        label: { label: 'Libellé' },
      })).optional(),
      gain: throwEffectSchema,
      critique: throwEffectSchema.optional(),
      maladresse: throwEffectSchema.optional(),
      depassement: throwEffectSchema.optional(),
      libre: plageSchema.optional(),
      exact: z.number().optional(),
      manches: z.number().optional(),
      ordre: z.enum(['declare', 'tirage']).optional(),
      /** Unité de borne de la famille quand la règle ne fixe aucun terme (anti-boucle, pas une règle). */
      manchesBorne: z.number().optional(),
    }), {
      throws: { label: 'Lancers' },
      reserve: { label: 'Réserve' },
      pick: { label: 'Sélection' },
      rows: { label: 'Rangées' },
      gain: { label: 'Gain' },
      critique: { label: 'Critique' },
      maladresse: { label: 'Maladresse' },
      depassement: { label: 'Dépassement' },
      libre: { label: 'Libre' },
      exact: { label: 'Résultat exact' },
      manches: { label: 'Manches' },
      ordre: { label: 'Ordre' },
      manchesBorne: { label: 'Limite de manches' },
    }).optional(),
    /** NADJ 16 l.90 */
    combined: nommerChamps(z.strictObject({
      second: nommerChamps(z.strictObject({
        skill: refOuSpec('skill').optional(),
        char: charKeySchema.optional(),
      }), { skill: { label: 'Compétence' }, char: { label: 'Caractéristique' } }),
      failEvery: z.number().optional(),
      eraseEvery: z.number().optional(),
      ops: z.array(gameOpSchema).optional(),
      markLoser: z.boolean().optional(),
      /** Id d'État (`etats.json`) dont l'apparition arrête la partie (l.88 « rouler sous la table »). */
      stopCondition: z.string().optional(),
      tours: z.number().optional(),
    }), {
      second: { label: 'Second Test' },
      failEvery: { label: 'Fréquence d’échec' },
      eraseEvery: { label: 'Fréquence d’effacement' },
      ops: { label: 'Opérations' },
      markLoser: { label: 'Marquer le perdant' },
      stopCondition: { label: 'Condition d’arrêt' },
      tours: { label: 'Tours' },
    }).optional(),
    /** SANCTION DU LANCEUR QUI MANQUE (famille 10 du socle) — Torchon l.111 : le Test que le raté
     *  impose, ce que son échec coûte au camp (`points`) et applique au lanceur (`ops`), et le prix
     *  du balayage final des trop sobres (`sobrietyPoints`). Consommée par
     *  `SequenceParams.throwerPenalty` (`src/state/sequenceCore.ts`). */
    throwerPenalty: nommerChamps(z.strictObject({
      test: nommerChamps(z.strictObject({
        skill: refOuSpec('skill').optional(),
        char: charKeySchema.optional(),
      }), { skill: { label: 'Compétence' }, char: { label: 'Caractéristique' } }),
      difficulty: difficultySchema,
      label: z.string().optional(),
      points: z.number().optional(),
      ops: z.array(gameOpSchema).optional(),
      sobrietyPoints: z.number().optional(),
      /** RÉCIT de la sanction (gabarits `{who}`/`{points}`/`{s}`/`{mien}`… interpolés par le socle) —
       *  sans eux, un second jeu à lanceurs raconterait la pinte du premier. */
      lines: nommerChamps(z.strictObject({
        manque: z.string().optional(),
        reussite: z.string().optional(),
        echec: z.string().optional(),
        balayage: z.string().optional(),
      }), {
        manque: { label: 'Manque' },
        reussite: { label: 'Réussite' },
        echec: { label: 'Échec' },
        balayage: { label: 'Balayage' },
      }).optional(),
    }), {
      test: { label: 'Test' },
      difficulty: { label: 'Difficulté' },
      label: { label: 'Libellé' },
      points: { label: 'Points' },
      ops: { label: 'Opérations' },
      sobrietyPoints: { label: 'Points de sobriété' },
      lines: { label: 'Lignes' },
    }).optional(),
    /** Unité de ce que le jeu compte, au pluriel (affichage : « quilles », « points »…). */
    scoreUnit: z.string().optional(),
    /** La même unité au singulier (« quille », « point »…), accordée au compte du dénouement. */
    scoreUnitSingular: z.string().optional(),
    /** CAMPS ASYMÉTRIQUES (famille 8 du socle) — Alvatafl l.25-28 : chaque camp convertit son total en
     *  prises sur l'adversaire (`div`), et sa victoire au Critique se lit au dé des unités (`mult`). */
    sides: z.array(nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      pieces: z.number(),
      div: z.number(),
      mult: z.number(),
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      pieces: { label: 'Pièces' },
      div: { label: 'Diviseur' },
      mult: { label: 'Multiplicateur' },
    })).optional(),
    /** NADJ 16 l.82 */
    specials: z.array(specialSchema).optional(),
    /** MISE / POT / ABANDON / ÉLIMINATION (Al-zahr l.17) — famille (5) du socle de séquence,
     *  consommée par `SequenceParams.pot` (`src/state/sequenceCore.ts`). `potEffectId` est le nom d'un
     *  effet de pot ENREGISTRÉ (`registerSequencePotEffect`), jamais un id de jeu — la clé nomme donc
     *  ce qu'elle porte : une CLÉ DE REGISTRE, ni de la prose ni l'issue du tour. */
    pot: nommerChamps(z.strictObject({
      dice: nommerChamps(z.strictObject({ count: z.number(), faces: z.number() }), { count: { label: 'Nombre' }, faces: { label: 'Faces' } }),
      targetRange: plageSchema.optional(),
      manchesPerPlayer: z.number().optional(),
      /** Unité de borne de la famille : tours qu'une manche peut prendre (anti-boucle, pas une règle). */
      roundsPerManche: z.number().optional(),
      rows: z.array(nommerChamps(z.strictObject({
        ...plageSchema.shape,
        potEffectId: z.enum(['rafle-le-pot', 'reprend-mise', 'cible-ou-passe', 'remise-ou-abandon', 'quitte-la-manche']),
        /** Paramètre de l'effet : combien de mises il déplace (défaut 1). */
        mises: z.number().optional(),
        label: z.string(),
      }), {
        ...metaDesChamps(plageSchema, { exigees: true }),
        potEffectId: { label: 'Effet sur le pot' },
        mises: { label: 'Mises' },
        label: { label: 'Libellé' },
      })),
    }), {
      dice: { label: 'Dés' },
      targetRange: { label: 'Plage cible' },
      manchesPerPlayer: { label: 'Manches par joueur' },
      roundsPerManche: { label: 'Rounds par manche' },
      rows: { label: 'Rangées' },
    }).optional(),
  },
  {
    ...metaDesChamps(jetSchema, { exigees: true }),
    difficulty: { label: 'Difficulté du Test', hint: 'Difficulté des Tests du jeu ; absente : Intermédiaire (LDB 12 l.166)' },
    skill: {
      label: 'Compétence testée',
      hint: 'Compétence testée (+ spécialisation si le jeu en exige une), prise au catalogue ; absente, le jeu joue sa Caractéristique, et à défaut Pari (NADJ 16 l.11)',
    },
    characteristic: {
      label: 'Caractéristique testée',
      hint: 'Caractéristique du Test : celle qui porte la Compétence quand les deux sont déclarées (Alvatafl : Savoir sur Int), ou la Caractéristique jouée seule (Bras de fer : Force)',
    },
    fastSkill: {
      label: 'Test rapide (option)',
      hint: 'Test de remplacement joué en régime rapide (règle optionnelle), écart maison tagué',
    },
    mode: { label: 'Mode de résolution', hint: 'Test opposé ou étendu ; absent si le jeu se résout par mise' },
    target: { label: 'Objectif de DR', hint: 'DR cumulé à atteindre pour clore la partie (Test étendu)' },
    drCap: { label: 'Plafond de DR', hint: 'DR de manche plafonné à cette valeur sur une réussite, avant tout bonus' },
    tieBreak: {
      label: 'Départage d’égalité',
      hint: 'Règle appliquée à une égalité de DR : dé des unités le plus bas, ou égalité maintenue (nul)',
    },
    drBonus: { label: 'Bonus de Caractéristique', hint: 'Bonus de la Caractéristique ajouté au DR de chaque manche' },
    avantage: { label: 'Avantage en jeu', hint: 'L’Avantage se gagne et se perd par manche, aux règles habituelles' },
    roundOps: { label: 'Effets par manche', hint: 'Effets mécaniques appliqués au vainqueur de la manche, et par usure' },
    team: { label: 'Effectif d’équipe', hint: 'Effectif requis par camp, complété de figurants si incomplet' },
    roundShape: { label: 'Forme du tour', hint: 'Structure d’un tour : équipe, lanceur unique, mise ou volée' },
    options: {
      label: 'Options de Test',
      hint: 'Compétences/Caractéristiques proposées au choix du joueur pour la manche',
    },
    campScore: { label: 'Calcul du score', hint: 'Formule qui agrège les résultats d’un camp en un score' },
    scoreThreshold: {
      label: 'Seuil de score',
      hint: 'Score de camp qui marque un acquis dans la manche (un but au Middenball) ; la partie se juge au compte des acquis',
    },
    phases: { label: 'Mi-temps', hint: 'Découpage de la partie en mi-temps de plusieurs tours' },
    dancers: { label: 'Effectif du cercle', hint: 'Participants au cercle, dont un tiré au sort est visé' },
    table: { label: 'Table de score', hint: 'Barème de points par plage de DR obtenu' },
    volley: { label: 'Volée de lancers', hint: 'Série de lancers notée par manche (Bête, Fléchettes, Boules…)' },
    combined: { label: 'Test combiné', hint: 'Un seul jet lu deux fois : conséquence principale et secondaire' },
    throwerPenalty: { label: 'Sanction du lanceur', hint: 'Test et coût imposés au lanceur qui manque son lancer' },
    scoreUnit: { label: 'Unité de score', hint: 'Nom au pluriel de ce que le jeu compte (quilles, points…)' },
    scoreUnitSingular: { label: 'Unité de score (singulier)', hint: 'La même unité au singulier (quille, point…)' },
    sides: { label: 'Camps asymétriques', hint: 'Conversion du score de chaque camp en prises sur l’adversaire' },
    specials: {
      label: 'Spéciaux',
      hint: 'Effets d’un Talent sur la Difficulté des Tests du jeu, pour le seul joueur qui le possède',
    },
    pot: { label: 'Mise et pot', hint: 'Mise, pot, et abandon/élimination d’une partie à mise' },
  },
  {
    codex: { keys: ['tavernGames'] },
    edit: { dataset: 'tavernGames' },
  },
  {
    exiges: ['desc', 'source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const jeu = v as { mode?: string; specials?: unknown[] };
        if (jeu.specials?.length && !joueUnTest(jeu)) {
          ctx.addIssue({
            code: 'custom',
            path: ['specials'],
            message: 'Un Spécial modifie un Test : le jeu doit se résoudre par un Test.',
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
