import { nommerChamps } from './meta';
/**
 * Grammaire du NARRATIF de campagne (`narratif`, `defs-scenes/narratif.ts`) : la Condition évaluée hors combat,
 * l'identité d'un état de campagne `heros`, le cadre du chapitre et les Effets qui écrivent un état ou remettent
 * une entrée du narratif ; les nœuds que les concepts du lexique des structures portent (`interne/poses.ts`,
 * #3012). #717 ; #2539 ; #679 ; EDO 02 l.91.
 */
import { z } from 'zod';
import { alternationDe } from '../../../lib/regex';
import { raceKeySchema, sexeSchema, sourceRefSchema } from './valeurs';
import { conditionSchema } from './mecanique';
import { listeCle } from './collection-cle';
import { champAdapteDe, proseNommee, refineAdapteDe, META_ADAPTE_DE } from './prose';
import type { Condition } from '../../../engine/flowCore';

/**
 * Kinds de `Condition` réellement ÉVALUABLES avec le contexte de la CARTE (`condCtx`,
 * `src/noyau/bourseFlow.ts` : `flags`, `etats`, `gameTime`, `party`, `money`). Les autres kinds lisent
 * `target`/`caster`/`sl`/`location`/état de combat — absents ici, et `evalCondition`
 * (`src/engine/flowCore.ts`) les rend alors FAUX : un lieu disparaîtrait de la carte, ou un trajet
 * se fermerait, EN SILENCE et sans qu'aucune donnée ne soit fautive. Le sous-ensemble se vérifie
 * kind par kind dans `evalCondition` ; tout kind non listé est REFUSÉ à l'authoring (fail-fast).
 * Exporté : les panneaux de carte du studio en DÉRIVENT l'offre de leur `ConditionEditor`
 * (prop `kinds`), au lieu d'une seconde liste recopiée dans l'UI.
 */
export const CONDITION_KINDS_CARTE: ReadonlySet<Condition['kind']> = new Set<Condition['kind']>([
  'always', 'flag', 'etat', 'time', 'hasItem', 'money', 'partyDead',
  'skill', 'career', 'species', 'status',
  'all', 'any', 'not',
]);

/** Kinds hors portée rencontrés dans une `Condition` authored (récursif : `all`/`any`/`not`). */
function kindsHorsCarte(cond: unknown, out: Set<string> = new Set()): Set<string> {
  if (!cond || typeof cond !== 'object') return out;
  const c = cond as { kind?: unknown; of?: unknown };
  // La Condition arrive ICI encore NON VALIDÉE (`unknown`) : son `kind` est une chaîne quelconque.
  if (typeof c.kind === 'string' && !(CONDITION_KINDS_CARTE as ReadonlySet<string>).has(c.kind)) out.add(c.kind);
  if (Array.isArray(c.of)) for (const sub of c.of) kindsHorsCarte(sub, out);
  else if (c.of) kindsHorsCarte(c.of, out);
  return out;
}

/** `Condition` d'un `when` évalué au contexte HORS COMBAT (`condCtx`) — l'algèbre complète,
 *  restreinte aux kinds évaluables là : le `when` d'un lieu/trajet de carte, et celui de la CLÔTURE
 *  d'un chapitre (#717), qui passe par le MÊME `condCtx`. */
export const conditionCondCtxSchema = conditionSchema.superRefine((cond, ctx) => {
  const hors = [...kindsHorsCarte(cond)];
  if (hors.length) {
    ctx.addIssue({
      code: 'custom',
      message:
        `Condition : « ${hors.join(' », « ')} » n'est pas évaluable au contexte hors combat ` +
        `(drapeaux, états de campagne, horloge, groupe, bourse — « condCtx », src/noyau/bourseFlow.ts) : la Condition serait ` +
        `FAUSSE en silence. Kinds admis : ${[...CONDITION_KINDS_CARTE].join(', ')}.`,
    });
  }
});

/** Métacaractères Markdown refusés dans un texte d'identité : il est substitué dans une prose AVANT son parse. */
const METACARACTERES_MARKDOWN = /[\\`*_[\]<>#|~]/;
const sansMarkdown = (sujet: string) => z.string().regex(/\S/, `${sujet} vide.`).refine((t) => !METACARACTERES_MARKDOWN.test(t), `${sujet} : métacaractère Markdown refusé (\\ \` * _ [ ] < > # | ~).`);

/** Les `fragments` comme mots entiers (bornes Unicode), le plus long d'abord (`alternationDe`) : `nommer`
 *  (`src/noyau/monde/identites.ts`) et le contrôle d'ancre la partagent. */
export function motifEnMot(fragments: readonly string[], drapeaux = 'u'): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${alternationDe(fragments)})(?!\\p{L})`, drapeaux);
}

/** Un REPÈRE d'identité : un fragment VERBATIM du paquet, à l'id STABLE que désigne chaque valeur (`repere`). */
export const repereDIdentiteSchema = nommerChamps(z.strictObject({
  id: z.string().min(1, 'id vide.'),
  fragment: sansMarkdown('fragment du repère'),
}), { id: { label: "identifiant", texte: { regime: "technique" } }, fragment: { label: "fragment du repère", texte: { regime: "technique", usage: "fragment verbatim du paquet remplacé à l’affichage" } } });

/** La forme d'un repère (`repere`, id d'un repère de la même identité) pour une espèce et un sexe : copie
 *  (`source`) ou adaptation (`adapteDe`) d'un passage. */
export const valeurDIdentiteSchema = nommerChamps(z.strictObject({
  repere: z.string().min(1, 'repère vide.'),
  valeur: sansMarkdown('valeur'),
  source: sourceRefSchema.optional(),
  ...champAdapteDe(),
})
  .superRefine(refineAdapteDe)
  .superRefine((v, ctx) => {
    if (v.source === undefined && v.adapteDe === undefined) ctx.addIssue({ code: 'custom', path: ['source'], message: 'provenance manquante : la page copiée (source) ou le passage adapté (adapté de).' });
  }), { repere: { label: "repère", texte: { regime: "technique" } }, valeur: { label: "valeur", texte: { regime: "designation" } }, source: { label: "source" }, ...META_ADAPTE_DE });

/** Une ligne d'identité : la valeur de chaque repère pour une espèce (`RaceKey`) et un sexe. */
export const ligneDIdentiteSchema = nommerChamps(z.strictObject({
  espece: raceKeySchema,
  sexe: sexeSchema,
  valeurs: listeCle(valeurDIdentiteSchema, 'repere'),
}), { espece: { label: "espèce" }, sexe: { label: "sexe" }, valeurs: { label: "valeurs" } });

/** IDENTITÉ d'un état `heros` (EDO 02 l.112-127) : les repères du paquet et leur forme par espèce et sexe du héros désigné. */
export const identiteSchema = nommerChamps(z.strictObject({
  ancres: z.array(sansMarkdown('ancre')).min(1, 'aucune ancre : une identité en déclare au moins une.'),
  reperes: listeCle(repereDIdentiteSchema, 'id', { min: { taille: 1, message: 'aucun repère : une identité en déclare au moins un.' } }),
  lignes: listeCle(ligneDIdentiteSchema, { nom: 'espèce et sexe', de: (l) => (l.espece && l.sexe ? `${l.espece} ${l.sexe}` : undefined) }),
})
  .superRefine((id, ctx) => {
    const ancres = motifEnMot(id.ancres);
    id.reperes.forEach((r, i) => {
      if (!ancres.test(r.fragment)) ctx.addIssue({ code: 'custom', path: ['reperes', i, 'fragment'], message: `repère « ${r.fragment} » sans ancre : il contient au moins l’une de « ${id.ancres.join(' », « ')} ».` });
    });
    const reperes = new Set(id.reperes.map((r) => r.id));
    id.lignes.forEach((l, j) => {
      const couverts = new Set(l.valeurs.map((v) => v.repere));
      for (const r of reperes) if (!couverts.has(r)) ctx.addIssue({ code: 'custom', path: ['lignes', j, 'valeurs'], message: `repère « ${r} » sans valeur : une ligne couvre tous les repères.` });
      l.valeurs.forEach((v, k) => {
        if (!reperes.has(v.repere)) ctx.addIssue({ code: 'custom', path: ['lignes', j, 'valeurs', k, 'repere'], message: `repère inconnu « ${v.repere} ».` });
      });
    });
  }), { ancres: { label: "ancres", texte: { regime: "technique", usage: "noms du paquet que portent les repères" } }, reperes: { label: "repères" }, lignes: { label: "lignes" } });

/** Ouverture CÉRÉMONIELLE du chapitre (#717, `OuvertureBlock`). Rendu par `<Prose>` : titre et
 *  pitch non vides sont la seule exigence. */
export const sousTitreOuvertureSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'narratif.ouverture.sousTitre.texte');
export const sousTitreClotureSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'narratif.cloture.sousTitre.texte');
export const ouvertureSchema = proseNommee(nommerChamps(z.strictObject({
  surtitre: z.string().optional(),
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: sousTitreOuvertureSchema.optional(),
  chapitre: z.string().optional(),
  ambiance: z.enum(['veillee', 'parchemin']).optional(),
}), { surtitre: { label: "surtitre" , texte: { regime: "designation"} }, titre: { label: "titre" , texte: { regime: "designation"} }, sousTitre: { label: "sous-titre" }, chapitre: { label: "chapitre" , texte: { regime: "designation"} }, ambiance: { label: "ambiance"  } }), 'narratif.ouverture.pitch');

/** CLÔTURE du chapitre (#717, `ClotureBlock`) — `when` évalué au contexte HORS COMBAT (`condCtx`),
 *  d'où le MÊME schéma borné que le `when` d'un lieu de carte (un kind non évaluable serait FAUX
 *  en silence : le chapitre ne se fermerait jamais, sans qu'aucune donnée ne soit fautive). */
export const clotureSchema = nommerChamps(z.strictObject({
  when: conditionCondCtxSchema,
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: sousTitreClotureSchema.optional(),
}), { when: { label: "condition" }, titre: { label: "titre" , texte: { regime: "designation"} }, sousTitre: { label: "sous-titre" } });

/** Pose la VALEUR `valeur` (id déclaré) de l'état de campagne ÉNUMÉRÉ `etat` (`narratif.etats`, #2539) —
 *  EDO 01 l.241. Forme et valeur contrôlées au chargement (`fautesDUsageDEtat`). */
export const poserEtatSchema = nommerChamps(z.strictObject({ type: z.literal('poserEtat'), etat: z.string(), valeur: z.string() }), { type: { label: "type"  }, etat: { label: "état de campagne" , texte: { regime: "technique"} }, valeur: { label: "valeur" , texte: { regime: "technique"} } });

/** Ouvre la DÉSIGNATION d'un héros vivant pour l'état de campagne `etat` de forme `heros` — choix du
 *  joueur, non annulable (EDO 02 l.91) ; `invite` = la prose que la modale affiche. */
export const designerHerosSchema = proseNommee(nommerChamps(z.strictObject({ type: z.literal('designerHeros'), etat: z.string() }), { type: { label: "type"  }, etat: { label: "état de campagne" , texte: { regime: "technique"} } }), 'designerHeros.invite');

/** Remet au joueur un document du narratif (#679) : `documentId` → `narratif.documents`, résolu au parse
 *  du projet (`refsNarrativesPendantes`, `./refs-narratives.ts`). */
export const documentSchema = nommerChamps(z.strictObject({ type: z.literal('document'), documentId: z.string() }), { type: { label: "type"  }, documentId: { label: "document" , texte: { regime: "technique"} } });

/** Mécanique MAISON du carnet d'enquête (#670, aucune règle RAW) : révèle/avance un `Indice` de
 *  `campaignNarratif`. `stade` omis → `revealClue` (`noyau/monde/clues.ts`). */
export const revealClueSchema = nommerChamps(z.strictObject({
  type: z.literal('revealClue'),
  indiceId: z.string(),
  stade: z.string().optional(),
}), { type: { label: "type"  }, indiceId: { label: "indice" , texte: { regime: "technique"} }, stade: { label: "stade" , texte: { regime: "technique"} } });
