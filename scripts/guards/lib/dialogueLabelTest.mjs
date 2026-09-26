// MESURE du LIBELLÉ DE RÉPONSE qui RECOPIE le Test de son propre flux (#1869) — la classe de poison
// que la garde `src/scenes/dialogue-label-sans-test.test.ts` refuse ABSOLUMENT (aucune exemption,
// aucun stock, aucune baseline : le compte attendu est ZÉRO).
//
// POURQUOI : ce qu'une réponse ANNONCE est DÉRIVÉ de son flux et rendu par la fenêtre
// (`state/dialogue.ts` `testAnnonce` → `ui/DialogueBox` « N. [Compétence — Difficulté] libellé »).
// Un auteur qui écrit « (Test de Crochetage) » dans le libellé pose une SECONDE vérité : elle ment
// dès que le flux change de Compétence ou de difficulté, et la réponse dit deux fois la même chose.
//
// MASQUE, mot à mot : « un `label` de `choices[]` porteur d'un `flow`, qui contient — en MOT ENTIER,
// casse et accents ignorés — quoi que ce soit que le TAG DÉRIVÉ de ce même flux dira déjà : le
// libellé de la Compétence (nœud `test` ou effet `extendedTest`, à toute profondeur de branche), sa
// spécialisation, le libellé de la Caractéristique, celui de la Difficulté déclarée (forme complète
// ET nom seul), le DR CUMULÉ d'un Test étendu, ou le mot « Test » ».
//
// PORTÉE : tous les documents `.json` de `src/scenes`, à toute profondeur (scènes ET campagnes).
// Le `test.label` d'un `FlowTest` est EXCLU PAR CONSTRUCTION — il n'est pas un `choices[].label`, et
// il NOMME légitimement la fenêtre de jet (« Intuition — quelque chose cloche chez Kramer »). Aucune
// liste d'exceptions n'est donc nécessaire, et il n'y en a pas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from './lister.mjs';

/** Racine du dépôt, déduite de l'emplacement de ce module (`scripts/guards/lib`). */
export const RACINE_DEPOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

/** Dossier des documents de scène/campagne scannés, et le suffixe retenu. */
export const RACINE_SCENES = Object.freeze({ dossier: 'src/scenes', suffixe: '.json' });

/** Libellé d'une Compétence par son `id` STABLE (`src/data/skills.json`) — la donnée, jamais une copie. */
function libellesDeCompetence(root) {
  const brut = JSON.parse(fs.readFileSync(path.join(root, 'src/data/skills.json'), 'utf8'));
  const liste = Array.isArray(brut) ? brut : (brut.skills ?? Object.values(brut).find(Array.isArray) ?? []);
  return new Map(liste.filter((s) => s && typeof s.id === 'string').map((s) => [s.id, s.label]));
}

/** Clé de comparaison : accents déposés, casse repliée (même recette que `lister.mjs`). */
const cle = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Le terme apparaît-il en MOT ENTIER dans ce libellé ? (« Soin » ne se lit pas dans « Soigner ».) */
function contientLeTerme(label, terme) {
  if (!terme || terme.length < 2) return false;
  const motif = new RegExp(`(^|[^\\p{L}\\p{N}])${cle(terme).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u');
  return motif.test(cle(label));
}

/** Le MOT que le jeu emploie pour NOMMER un jet : un libellé de réponse qui le porte annonce le Test
 *  à la place du tag dérivé (« (Test de …) », « (Test étendu, 5 DR) »). « Tester », « testament » ne
 *  sont pas ce mot : la comparaison est en MOT ENTIER. */
const MOT_DU_JET = 'Test';

/**
 * Termes qu'un flux INTERDIT à son PROPRE libellé de réponse — tout ce que le tag DÉRIVÉ dira déjà :
 *  · la Compétence testée, sa spécialisation, la Caractéristique testée ;
 *  · la DIFFICULTÉ déclarée, sous sa forme complète (« Difficile (−20) ») ET sous son seul nom
 *    (« Difficile ») — la difficulté EFFECTIVE d'un test sans `difficulty` n'est pas nommée ici : elle
 *    n'est pas dans la donnée, et le mot du jet ci-dessous couvre « (Test intermédiaire) » ;
 *  · le DR CUMULÉ d'un Test étendu (« 5 DR »), que le tag porte depuis `targetDR` ;
 *  · le mot « Test » lui-même.
 * Le parcours descend dans TOUTES les branches (`seq`, `if`, `test`, et le `yes`/`no` d'un `choice`) :
 * un jet enfoui annonce autant qu'un jet de tête.
 */
function termesDuFlux(flow, vocabulaire, out = []) {
  if (!flow || typeof flow !== 'object') return out;
  const { skills, carac, difficultes } = vocabulaire;
  const prendre = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.skill && typeof n.skill.id === 'string') {
      out.push(skills.get(n.skill.id) ?? n.skill.id);
      if (typeof n.skill.spec === 'string') out.push(n.skill.spec);
    }
    if (typeof n.characteristic === 'string' && carac[n.characteristic]) out.push(carac[n.characteristic]);
    const diff = typeof n.difficulty === 'string' ? difficultes[n.difficulty] : undefined;
    if (diff) out.push(diff, diff.replace(/\s*\(.*$/, ''));
    if (typeof n.targetDR === 'number') out.push(`${n.targetDR} DR`);
    out.push(MOT_DU_JET);
  };
  if (flow.kind === 'test') prendre(flow.test);
  if (flow.kind === 'do' && flow.effect?.type === 'extendedTest') prendre(flow.effect);
  for (const suite of [flow.steps, [flow.then, flow.else, flow.success, flow.fail, flow.yes, flow.no]]) {
    for (const s of suite ?? []) termesDuFlux(s, vocabulaire, out);
  }
  return out;
}

/**
 * Les libellés de réponse qui recopient le Test de leur flux, en `fichier:ligne › « libellé » [terme]`.
 * La LIGNE est retrouvée dans le texte source (le libellé est un littéral JSON unique à sa ligne) :
 * une garde qui nomme son site se corrige sans fouille.
 * @param {{ carac?: Record<string,string>, difficultes?: Record<string,string> }} vocabulaire
 *   libellés des Caractéristiques (`CHAR_LABELS`) et des Difficultés (`DIFFICULTY_LABELS`),
 *   `src/engine/types.ts` — INJECTÉS par l'appelant : la garde ne redéclare aucun de ces deux
 *   vocabulaires, elle les reçoit de leur source. (Les Compétences, elles, sont une DONNÉE :
 *   `skills.json`, lue ici.)
 * @returns {string[]} trouvailles triées ; `[]` = la classe est éteinte.
 */
export function mesurerLibellesDeReponse(vocabulaire = {}, root = RACINE_DEPOT) {
  const voc = { skills: libellesDeCompetence(root), carac: vocabulaire.carac ?? {}, difficultes: vocabulaire.difficultes ?? {} };
  const dossier = path.join(root, RACINE_SCENES.dossier);
  const fichiers = listerArbre(dossier, { absent: 'vide', descendre: () => true, filtre: (rel) => rel.endsWith(RACINE_SCENES.suffixe) });
  const trouves = [];
  for (const rel of fichiers) {
    const abs = path.join(dossier, rel);
    const texte = fs.readFileSync(abs, 'utf8');
    const lignes = texte.split(/\r?\n/);
    const relatif = `${RACINE_SCENES.dossier}/${rel}`;
    const visite = (v) => {
      if (Array.isArray(v)) { v.forEach(visite); return; }
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v.choices)) {
        for (const c of v.choices) {
          if (!c || typeof c.label !== 'string' || !c.flow) continue;
          for (const terme of termesDuFlux(c.flow, voc)) {
            if (!contientLeTerme(c.label, terme)) continue;
            const i = lignes.findIndex((l) => l.includes(`"label": ${JSON.stringify(c.label)}`));
            trouves.push(`${relatif}:${i + 1} › « ${c.label} » [${terme}]`);
            break; // un libellé fautif se nomme UNE fois, par le premier terme qu'il recopie
          }
        }
      }
      for (const x of Object.values(v)) if (x && typeof x === 'object') visite(x);
    };
    visite(JSON.parse(texte));
  }
  return trouves.sort();
}
