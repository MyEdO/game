// CORPUS de cas de grounding (#903) — chaque cas décrit un échec de grounding RÉEL, vécu (un agent
// sans contexte a cherché et n'a PAS trouvé, ou a trouvé un motif faux), jamais un cas inventé pour
// remplir le corpus. La garde qui le relit vit dans `src/data/grounding-corpus.test.ts`.
//
// CE QUE CE BANC MESURE — et ce qu'il NE mesure PAS. Il vérifie qu'un MOTIF reste trouvable par les
// MOTS-CLEFS d'un agent dans la SURFACE désignée (grep déterministe, quelques ms, aucun agent réel
// impliqué). Ce n'est PAS la même chose qu'un agent qui COMPREND : le banc ne juge ni la pertinence
// de ce qui remonte, ni la capacité d'un agent à interpréter le motif une fois trouvé, ni les cas où
// la bonne réponse existe mais sous des mots-clefs qu'aucun agent ne penserait à essayer. Sa valeur
// est étroite et délibérée : détecter qu'un motif qui répondait à une vraie question CESSE de
// répondre (doc renommée, ligne déplacée, chiffre périmé) — pas certifier que le grounding marche.
//
// Un cas porte : `id` (stable), `question` (FR, telle qu'un agent se la pose), `keywords` (mots-clefs
// de recherche), `surface` (chemin relatif au repo où le motif doit remonter), `status`
// (`'resolu'` | `'attente'`), `incident` (le fait vécu qui a motivé le cas). Un cas résolu porte EN
// PLUS `resolves(text)` (prédicat pur) ET `sabotage(text)` (mutation pure qui retire EXACTEMENT ce
// que le cas prétend vérifier) — les deux sont OBLIGATOIRES (typées non-optionnelles dans
// `groundingCorpus.d.mts`) : sans `sabotage`, rien ne prouve que `resolves` teste la bonne chose au
// lieu d'être vert par accident (« vert à vide », incident du 2026-07-27 — cf. cas 1 ci-dessous). Un
// cas EN ATTENTE n'a ni `surface`/`resolves`/`sabotage` : la surface qui y répondrait n'existe pas
// encore, et il porte à la place `surfaceManquante` (ce qui manque, nommé) — jamais un faux vert.
//
// Forme du corpus — module JS (données) + test qui le relit, PAS un fichier `src/data/*.json` : les
// cas ne sont pas de la donnée de JEU (rien de tout ça n'est chargé en jeu), et le prédicat de
// résolution d'un cas (fonction pure, parfois avec logique dédiée comme le cas `sorts-compte`) ne
// tient pas dans un schéma JSON. Même patron que les autres stocks de garde du dépôt
// (`manualDocsStock.mjs`, `folioRatchetStock.mjs`, `rollSeamWhitelist.mjs`) : la donnée vit dans un
// module `scripts/guards/lib/*.mjs`, la garde dans `src/data/*.test.ts`.
//
// Cas 1 (`carriere-borne-partagee`) — doublon avec `src/data/index-moteur-ratchet.test.ts` (« contrat
// positif rollCareer ») ? DISTINGUÉ, pas absorbé : le test existant verrouille la STRUCTURE exacte de
// la ligne générée (ancre `creation.ts:73` incluse) — il casse si `build-index-moteur.mjs` dérive.
// Ce cas-ci verrouille la DÉCOUVRABILITÉ par mots-clefs, robuste à un déplacement de ligne/reformatage
// (fenêtre de lignes, pas une ligne exacte) — la propriété que #903bis a réellement fait manquer aux
// deux agents. Les deux gardes se complètent ; en retirer une romprait une garantie que l'autre ne
// couvre pas.
//
// `resolves` se borne STRICTEMENT à la section structurelle « ## Index par concept (français) »
// (`sectionSlice`), jamais au document entier : le préambule narratif (« Pourquoi ce fichier ») cite
// `rollCareer` à côté de « carrière »/« aléatoire », et la section « par fichier » nomme aussi le symbole —
// l'un ou l'autre garderait le cas VERT sans la ligne de concept générée.
import spellsJson from '../../../src/data/spells.json' with { type: 'json' };

const WINDOW = 6;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Un motif est trouvable si une fenêtre de `WINDOW` lignes consécutives contient TOUS les
 * mots-clefs ET le motif — simule un agent qui cherche par mots-clefs puis lit son voisinage
 * immédiat, sans exiger que motif et mots-clefs partagent la MÊME ligne (contrairement au contrat
 * positif de `index-moteur-ratchet.test.ts`, volontairement plus strict).
 */
function keywordWindowResolves(text, keywords, motif) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const windowText = lines.slice(i, i + WINDOW).join('\n');
    const hasAllKeywords = keywords.every((k) => new RegExp(escapeRegExp(k), 'i').test(windowText));
    if (hasAllKeywords && motif.test(windowText)) return true;
  }
  return false;
}

/**
 * Bornes [start, end) d'une section `## <heading>` (ligne de titre incluse, jusqu'à la PROCHAINE
 * ligne `## ...` exclue, ou fin de fichier). `null` si le titre n'existe plus — c'est PRÉCISÉMENT le
 * cas qu'un cas ancré sur une section doit détecter comme disparition de la couche.
 */
function sectionBounds(lines, heading) {
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return [start, end];
}

function sectionSlice(text, heading) {
  const lines = text.split('\n');
  const bounds = sectionBounds(lines, heading);
  if (!bounds) return null;
  return lines.slice(bounds[0], bounds[1]).join('\n');
}

/**
 * Bornes d'une SOUS-section (`### …`) : mêmes bornes que `sectionBounds`, mais arrêtées au prochain
 * titre de N'IMPORTE QUEL niveau. Sans ça, un `### Type` court jusqu'au prochain `## …` et avale les
 * tables des types SUIVANTS — une ligne `| `champ` | …` d'un autre type y répondrait à sa place
 * (mesuré : le sabotage du cas `dotation-spec-consommateurs` restait VERT, rattrapé par un `spec`
 * homonyme d'un type voisin).
 */
function sousSectionBounds(lines, heading) {
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return [start, end];
}

function sousSectionSlice(text, heading) {
  const lines = text.split('\n');
  const bounds = sousSectionBounds(lines, heading);
  if (!bounds) return null;
  return lines.slice(bounds[0], bounds[1]).join('\n');
}

function sectionRemoved(text, heading) {
  const lines = text.split('\n');
  const bounds = sectionBounds(lines, heading);
  if (!bounds) return text;
  return [...lines.slice(0, bounds[0]), ...lines.slice(bounds[1])].join('\n');
}

const CONCEPT_HEADING = '## Index par concept (français)';
const TRAPPING_REF_HEADING = '### `TrappingRef` (src/data/index.ts)';
const CAS_FONDATEUR_HEADING = '## Cas fondateur';

export const GROUNDING_CASES = [
  {
    id: 'carriere-borne-partagee',
    question: 'Comment une Carrière rejoint-elle le tirage aléatoire ?',
    keywords: ['carrière', 'tirage', 'aléatoire'],
    surface: 'docs/index-moteur.md',
    status: 'resolu',
    incident:
      "deux agents de grounding ont cherché ce mécanisme et conclu qu'il n'existait pas, alors que " +
      "src/engine/creation.ts (JSDoc de rollCareer, l.67-71) le documentait en français depuis le 2026-06-18.",
    resolves(text) {
      const concepts = sectionSlice(text, CONCEPT_HEADING);
      if (concepts == null) return false;
      return keywordWindowResolves(concepts, this.keywords, /`rollCareer`/);
    },
    // Amputation de la couche entière « Index par concept » — préambule et section « par fichier »
    // restent intacts (et mentionnent tous deux `rollCareer`) : seule la scope structurelle de
    // `resolves` empêche qu'ils sauvent le cas.
    sabotage(text) {
      return sectionRemoved(text, CONCEPT_HEADING);
    },
  },
  {
    id: 'sorts-compte',
    question: 'Combien de sorts le moteur implémente-t-il ?',
    keywords: ['sorts', 'synthèse', 'implémentation'],
    surface: 'docs/sorts-implementation.md',
    status: 'resolu',
    incident:
      "docs/sorts-implementation.md annonçait 416 sorts (doc manuscrit, non chaîné à docs:check) quand " +
      "src/data/spells.json en portait 576 — corrigé par génération (scripts/gen-sorts-doc.mts).",
    resolves(text) {
      const m = text.match(/\*\*Synthèse\*\*\s*:\s*(\d+)\s+sorts/);
      if (!m) return false;
      return Number(m[1]) === spellsJson.length;
    },
    // Retire la ligne « **Synthèse** : N sorts » elle-même — c'est l'unique occurrence du motif que
    // `resolves` cherche, aucune autre ligne du doc ne peut le sauver.
    sabotage(text) {
      return text.split('\n').filter((l) => !/\*\*Synthèse\*\*/.test(l)).join('\n');
    },
  },
  {
    id: 'dotation-spec-consommateurs',
    question: 'Qui lit le champ `spec` sur une référence de dotation ?',
    keywords: ['spec', 'dotation', 'TrappingRef', 'lecteur'],
    surface: 'docs/consommateurs-de-champs.md',
    status: 'resolu',
    incident:
      "« personne ne lit `spec` sur une référence de dotation » affirmé sur la foi d'une recherche trop " +
      "étroite — sans surface de consommateurs-par-champ, l'affirmation n'était pas vérifiable, juste plausible. " +
      "Résolu par scripts/docs/build-field-consumers.mts (#903) : `trappingRefLabel` NE lit PAS `ref.spec` ; " +
      "le lecteur fondateur est `resoudre` (src/engine/trappingChoices.ts). Puis L-ref-1 (75a454653, " +
      "#1463) lui en a ajouté un SECOND, légitime : `itemFromTrappingRef` (src/engine/items.ts:309) " +
      "MATÉRIALISE la spec sur l'`ItemInstance` — le rendu, lui, n'en est toujours pas un (`refLabel`).",
    // Ce que le cas exige est que le doc NOMME ses sites lecteurs, pas qu'il redise un NOMBRE gelé :
    // la version « exactement 1 lecteur » a viré au rouge quand le second lecteur est apparu, alors
    // que le doc répondait toujours — mieux — à la question. Sont exigés les DEUX rôles mesurés
    // (résolution du choix + matérialisation) et l'absence de lecture au RENDU, qui est la réponse
    // exacte au « personne ne lit `spec` » fondateur.
    resolves(text) {
      const section = sousSectionSlice(text, TRAPPING_REF_HEADING);
      if (section == null) return false;
      const m = section.match(/\|\s*`spec`\s*\|\s*(\d+)\s*\|\s*`(src\/[^`:]*):(\d+)`\s*\|/);
      if (!m || Number(m[1]) < 1) return false;
      const fondateur = sectionSlice(text, CAS_FONDATEUR_HEADING);
      if (fondateur == null) return false;
      if (!/`src\/engine\/trappingChoices\.ts:\d+`/.test(fondateur)) return false;
      if (!/`src\/engine\/items\.ts:\d+`/.test(fondateur)) return false;
      return /trappingRefLabel[\s\S]{0,80}ne lit PAS `ref\.spec`[\s\S]{0,60}`refLabel`/.test(fondateur);
    },
    // Fait retomber la ligne `spec` de la section `TrappingRef` à « 0 — JAMAIS LU » (comme les 16
    // autres champs sans lecteur du même rapport) — seule occurrence du motif que `resolves` exige
    // dans cette section, la narration « Cas fondateur » restant intacte ne peut pas sauver le cas.
    sabotage(text) {
      const lines = text.split('\n');
      const bounds = sousSectionBounds(lines, TRAPPING_REF_HEADING);
      if (!bounds) return text;
      const [start, end] = bounds;
      const section = lines.slice(start, end).join('\n')
        .replace(/\|\s*`spec`\s*\|\s*\d+\s*\|\s*`[^`]*`\s*\|/, '| `spec` | **0 — JAMAIS LU** | — |');
      return [...lines.slice(0, start), ...section.split('\n'), ...lines.slice(end)].join('\n');
    },
  },
];
