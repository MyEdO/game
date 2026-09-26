// MESURE du LIBELLÉ DE RÉPONSE qui RECOPIE ce que la fenêtre annonce — le Test de son flux, le coût de
// son `cost` (#1869) — la classe de poison
// que la garde `src/scenes/dialogue-label-sans-test.test.ts` refuse ABSOLUMENT (aucune exemption,
// aucun stock, aucune baseline : le compte attendu est ZÉRO).
//
// POURQUOI : ce qu'une réponse ANNONCE est DÉRIVÉ de son flux et rendu par la fenêtre
// (`state/dialogue.ts` `testAnnonce` → `ui/DialogueBox` « N. [Compétence — Difficulté] libellé »).
// Un auteur qui écrit « (Test de Crochetage) » dans le libellé pose une SECONDE vérité : elle ment
// dès que le flux change de Compétence ou de difficulté, et la réponse dit deux fois la même chose.
// Le coût suit la même loi : la fenêtre le rend en puce (`Coins`), « — 4 pa » dans le libellé le redouble.
//
// MASQUE : `termeRecopie` (`src/state/dialogueLibelle.ts`), le MÊME que la validation de scène rend à
// l'éditeur — cette garde n'en porte que le parcours du corpus et le `fichier:ligne`.
//
// PORTÉE : tous les documents `.json` de `src/scenes`, à toute profondeur (scènes ET campagnes).
// Le `test.label` d'un `FlowTest` est EXCLU PAR CONSTRUCTION — il n'est pas un `choices[].label`, et
// il NOMME légitimement la fenêtre de jet (« Intuition — quelque chose cloche chez Kramer »). Aucune
// liste d'exceptions n'est donc nécessaire, et il n'y en a pas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from './lister.mjs';
import { termeRecopie } from '../../../src/state/dialogueLibelle';

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

/**
 * Les libellés de réponse qui recopient le Test de leur flux, en `fichier:ligne › « libellé » [terme]`.
 * La LIGNE est retrouvée dans le texte source (le libellé est un littéral JSON unique à sa ligne) :
 * une garde qui nomme son site se corrige sans fouille.
 * @param {{ carac: Record<string,string>, difficultes: Record<string,string>, monnaie: { formater: Function, epeler: Function } }} vocabulaire
 *   libellés des Caractéristiques (`CHAR_LABELS`) et des Difficultés (`DIFFICULTY_LABELS`,
 *   `src/engine/types.ts`), écritures canon de la monnaie (`formatMoney`, `spellMoney`,
 *   `src/engine/money.ts`) — INJECTÉS par l'appelant : la garde ne redéclare aucun vocabulaire, elle
 *   les reçoit de leur source. (Les Compétences, elles, sont une DONNÉE : `skills.json`, lue ici.)
 * @returns {string[]} trouvailles triées ; `[]` = la classe est éteinte.
 */
export function mesurerLibellesDeReponse(vocabulaire, root = RACINE_DEPOT) {
  const skills = libellesDeCompetence(root);
  const voc = { ...vocabulaire, competence: (id) => skills.get(id) };
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
          if (!c || typeof c.label !== 'string') continue;
          const terme = termeRecopie(c, voc); // un libellé fautif se nomme UNE fois
          if (!terme) continue;
          const i = lignes.findIndex((l) => l.includes(`"label": ${JSON.stringify(c.label)}`));
          trouves.push(`${relatif}:${i + 1} › « ${c.label} » [${terme}]`);
        }
      }
      for (const x of Object.values(v)) if (x && typeof x === 'object') visite(x);
    };
    visite(JSON.parse(texte));
  }
  return trouves.sort();
}
