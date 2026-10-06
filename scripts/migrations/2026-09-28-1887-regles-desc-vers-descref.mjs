/**
 * Migration #1887 (campagne #1390, épique #1388) — la famille `regles` passe à l'ADRESSE : les entrées
 * de `src/data/regles.json` cessent de DUPLIQUER le texte du livre, elles l'ADRESSENT (`descRef`).
 * Patron : le pilote `2026-09-05-1389-psychology-desc-vers-descref.mjs`.
 *
 * ENTRÉES :
 *   - `src/data/regles.json`  (le SEUL document écrit)
 *   - `Source/**`             (les chapitres du livre cité, lus par `scripts/source/lecteur-fs.mjs`)
 *   - `src/data/books.json`   (id de livre → dossier d'extraction, via `sigleDe`)
 *
 * TABLE FIGÉE (`ADRESSES`) : les décisions de cette migration, relevées dans l'arbre le 2026-10-05 —
 * `id → { ch, parts }`, les fragments sans empreinte (`fragmentBlocs` la pose). Elle ne consomme pas
 * `judge` : un changement de son verdict ne fait pas rejouer la migration autrement. Chaque adresse
 * est PROUVÉE avant d'être écrite (`prouver`) : elle RÉSOUT (`resoudreAdresse`), et son rendu CONTIENT
 * la desc (`aligner`). V2b (`schemas/grammaire/prose.ts`) : l'adresse cite le livre de la `source`.
 * Une preuve qui échoue : RIEN n'est écrit, sortie 1 nominative.
 *
 * Une entrée inline hors table est NOMMÉE au bilan, jamais touchée : celles qu'une ligne de table ou
 * une partie stricte d'un bloc porte, `2026-10-05-1887-regles-adresses-prouvees.mjs`.
 * IDEMPOTENT : une entrée adressée n'a plus de `desc` — elle est sautée, second passage sans écriture.
 *
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"desc": <chaîne JSON>` exact de
 * l'entrée (`remplacerAncre`, `scripts/source/reecriture-ancree.mjs`) ; le compte TEXTUEL est
 * confronté au compte STRUCTUREL — divergence = sortie 1.
 *
 * `migrer(brut)` ne lit que le Source sur le disque : `src/data/regles-migration-fidelite.test.ts`
 * la rejoue sur la pré-image.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sigleDe } from '../raw/_lib.mjs';
import { lireChapitre } from '../source/lecteur-fs.mjs';
import { jsonIndente, remplacerAncre } from '../source/reecriture-ancree.mjs';
import { aligner, estErreur, fragmentBlocs, ouDeLAdresse, unitesDeLAdresse, unitesDuTexte } from '../../src/data/source/decoupe.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const FICHIER = 'src/data/regles.json';

/** Table FIGÉE : l'adresse (chapitre, fragments sans empreinte) de chaque entrée que cette migration adresse. */
export const ADRESSES = Object.freeze({
  encombrement: { ch: '61', parts: [{ sec: 'surcharge', secOcc: 1, b0: 0, b1: 1 }] },
  soutien: { ch: '12', parts: [{ sec: 'soutien', secOcc: 1, b0: 0, finSec: 'limites-du-soutien', finSecOcc: 1, b1: 1 }] },
  'sombre-pacte': { ch: '19', parts: [{ sec: 'sombres-pactes', secOcc: 1, b0: 0, b1: 1 }] },
  'combat-deux-armes': { ch: '14', parts: [{ sec: 'combat-sup-a-sup-deux-armes', secOcc: 1, b0: 0, b1: 1 }] },
  'tirer-dans-le-tas': { ch: '14', parts: [{ sec: 'tirer-dans-le-tas', secOcc: 1, b0: 0, b1: 0 }] },
  empoignade: { ch: '14', parts: [{ sec: 'empoignade', secOcc: 1, b0: 0, b1: 5 }] },
  'retenir-ses-coups': { ch: '07', parts: [{ sec: 'retenir-vos-coups', secOcc: 1, b0: 0, b1: 0 }] },
  'double-critique-maladresse': { ch: '12', parts: [{ sec: 'options-critiques-et-maladresses', secOcc: 1, b0: 0, b1: 1 }] },
  'focalisation-etendue': { ch: '46', parts: [{ sec: 'test-de-focalisation', secOcc: 1, b0: 0, b1: 0 }] },
  'lecture-au-grimoire': { ch: '46', parts: [{ sec: 'grimoires', secOcc: 1, b0: 0, b1: 0 }] },
  'calme-d-approche': { ch: '21', parts: [{ sec: 'peur-indice', secOcc: 1, b0: 1, b1: 1 }] },
  'sur-la-defensive': { ch: '13', parts: [{ sec: 'option-sur-la-defensive', secOcc: 1, b0: 0, b1: 0 }] },
  'faim-et-soif': { ch: '18', parts: [{ sec: 'faim-et-soif', secOcc: 1, b0: 0, b1: 2 }] },
  'tableau-augure': { ch: '03', parts: [{ sec: 'augure-int', secOcc: 1, b0: 5, b1: 7 }] },
  'resultat-de-psychometrie': { ch: '03', parts: [{ sec: 'du-balai-sorciere', secOcc: 1, b0: 4, b1: 4 }] },
  avantage: { ch: '14', parts: [{ sec: 'les-benefices-de-l-avantage', secOcc: 1, b0: 0, b1: 0 }] },
  amputation: { ch: '18', parts: [{ sec: 'amputation', secOcc: 1, b0: 0, finSec: 'pied', finSecOcc: 1, b1: 0 }] },
  'portee-d-une-arme': { ch: '62', parts: [{ sec: 'portee-d-une-arme', secOcc: 1, b0: 0, finSec: 'calcul-des-fourchettes-de-portee', finSecOcc: 1, b1: 3 }] },
  'allonge-longueur-d-arme': { ch: '62', parts: [{ sec: 'option-longueur-d-arme-et-combat-au-contact', secOcc: 1, b0: 0, finSec: 'au-contact', finSecOcc: 1, b1: 0 }] },
  'taille-modificateurs-en-combat': { ch: '85', parts: [{ sec: 'modificateurs-de-taille-en-combat', secOcc: 1, b0: 0, b1: 3 }] },
  'taille-cible-au-tir': { ch: '14', parts: [{ sec: 'taille', secOcc: 1, b0: 0, b1: 0 }] },
  'superiorite-numerique': { ch: '14', parts: [{ sec: 'superiorite-numerique', secOcc: 1, b0: 0, b1: 0 }] },
  'tir-dans-un-combat-au-corps-a-corps': { ch: '14', parts: [{ sec: 'option-tirer-dans-un-combat-au-corps-a-corps', secOcc: 1, b0: 0, b1: 1 }] },
  'combat-monte': { ch: '14', parts: [{ sec: 'combat-monte', secOcc: 1, b0: 0, b1: 1 }] },
  'equipe-incomplete-machine-de-guerre': { ch: '08', parts: [{ sec: 'machines-de-guerre', secOcc: 1, b0: 2, b1: 2 }] },
  'possession-pas-a-sa-taille': { ch: '02', parts: [{ sec: 'un-lourd-fardeau', secOcc: 1, b0: 1, b1: 1 }] },
  'navigation-agilite-de-rame': { ch: '07', parts: [{ sec: 'regles-de-navigation', secOcc: 1, b0: 3, b1: 3 }] },
  'navigation-echouage': { ch: '07', parts: [{ sec: 's-echouer', secOcc: 1, b0: 0, b1: 0 }] },
  'navigation-coque-percee': { ch: '07', parts: [{ sec: 'y-a-un-trou', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-progression': { ch: '14', parts: [{ sec: 'tests-de-navigation-pour-la-progression-du-bateau', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-progression-poursuite': { ch: '14', parts: [{ sec: 'tests-de-navigation-pour-la-progression-du-bateau-lors-d-une-poursuite', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-manoeuvre': { ch: '14', parts: [{ sec: 'tests-de-navigation-pour-les-man-uvres', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-perception': { ch: '14', parts: [{ sec: 'tests-de-perception', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-orientation': { ch: '14', parts: [{ sec: 'tests-d-orientation', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-affaler': { ch: '14', parts: [{ sec: 'affaler-les-voiles', secOcc: 1, b0: 0, b1: 0 }] },
  'test-equipage-extermination-nuisibles': { ch: '14', parts: [{ sec: 'extermination-des-nuisibles', secOcc: 1, b0: 0, b1: 1 }] },
  'test-equipage-rude-epreuve': { ch: '14', parts: [{ sec: 'rude-epreuve', secOcc: 1, b0: 0, b1: 1 }] },
  'test-equipage-entretien': { ch: '14', parts: [{ sec: 'entretien', secOcc: 1, b0: 0, b1: 2 }] },
  'test-equipage-batterie': { ch: '14', parts: [{ sec: 'tir-de-batterie', secOcc: 1, b0: 0, b1: 0 }] },
  'guerison-des-blessures': { ch: '18', parts: [{ sec: 'guerison-des-blessures', secOcc: 1, b0: 0, b1: 3 }] },
  exposition: { ch: '18', parts: [{ sec: 'exposition', secOcc: 1, b0: 0, b1: 3 }] },
  fractures: { ch: '18', parts: [{ sec: 'fractures', secOcc: 1, b0: 0, finSec: 'majeure', finSecOcc: 1, b1: 2 }] },
  'resistance-a-l-alcool-dessoulage': { ch: '09', parts: [{ sec: 'resistance-a-l-alcool-e-de-base', secOcc: 1, b0: 3, b1: 3 }] },
  trauma: { ch: '21', parts: [{ sec: 'trauma', secOcc: 1, b0: 0, b1: 1 }] },
  'temps-de-voyage': { ch: '51', parts: [{ sec: 'temps-de-voyage', secOcc: 1, b0: 0, b1: 2 }] },
  'symptomes-des-maladies': { ch: '20', parts: [{ sec: 'symptomes', secOcc: 1, b0: 0, b1: 0 }] },
  mouvement: { ch: '15', parts: [{ sec: 'mouvement-au-cours-d-un-combat', secOcc: 1, b0: 0, b1: 1 }] },
  course: { ch: '15', parts: [{ sec: 'course', secOcc: 1, b0: 0, b1: 0 }] },
  charger: { ch: '15', parts: [{ sec: 'charge', secOcc: 1, b0: 0, b1: 1 }] },
  desengagement: { ch: '15', parts: [{ sec: 'desengagement', secOcc: 1, b0: 0, b1: 2 }] },
  fuite: { ch: '15', parts: [{ sec: 'fuite', secOcc: 1, b0: 0, b1: 2 }] },
  chute: { ch: '15', parts: [{ sec: 'chute', secOcc: 1, b0: 0, b1: 2 }] },
  'influences-corruptrices': { ch: '19', parts: [{ sec: 'influences-corruptrices', secOcc: 1, b0: 0, b1: 1 }] },
  dissipation: { ch: '46', parts: [{ sec: 'dissipation', secOcc: 1, b0: 0, finSec: 'dissiper-des-sorts-permanents', finSecOcc: 1, b1: 1 }] },
  'au-contact': { ch: '62', parts: [{ sec: 'au-contact', secOcc: 1, b0: 0, b1: 0 }] },
  poursuite: { ch: '15', parts: [{ sec: 'poursuite', secOcc: 1, b0: 1, b1: 2 }] },
  'exposition-hydrique': { ch: '16', parts: [{ sec: 'exposition', secOcc: 1, b0: 0, b1: 0 }, { sec: 'tableau-d-exposition-2-blessures-et-etats', secOcc: 1, b0: 2, b1: 2 }] },
  'critiques-de-bateau': { ch: '07', parts: [{ sec: 'coups-critiques-au-bateau', secOcc: 1, b0: 0, b1: 0 }] },
  'blessures-critiques': { ch: '18', parts: [{ sec: 'tableaux-de-critiques', secOcc: 1, b0: 0, b1: 0 }] },
  'incantation-imparfaite': { ch: '46', parts: [{ sec: 'incantations-imparfaites', secOcc: 1, b0: 0, b1: 0 }] },
  'interruption-de-focalisation': { ch: '46', parts: [{ sec: 'interruptions', secOcc: 1, b0: 0, b1: 0 }] },
  'precieuses-entrailles': { ch: '13', parts: [{ sec: 'quelles-pieces', secOcc: 1, b0: 0, b1: 1 }] },
  'tests-opposes': { ch: '12', parts: [{ sec: 'tests-opposes', secOcc: 1, b0: 0, b1: 0 }, { sec: 'tests-opposes', secOcc: 1, b0: 2, b1: 2 }] },
  'tests-etendus': { ch: '12', parts: [{ sec: 'tests-etendus', secOcc: 1, b0: 0, b1: 1 }] },
  'embuscade-surprise': { ch: '13', parts: [{ sec: 'talents-de-surprise', secOcc: 1, b0: 2, b1: 4 }] },
  'combiner-les-difficultes': { ch: '14', parts: [{ sec: 'combiner-les-difficultes', secOcc: 1, b0: 0, b1: 1 }] },
  statut: { ch: '08', parts: [{ sec: 'charme', secOcc: 1, b0: 0, b1: 1 }] },
  'meteo-etape': { ch: '08', parts: [{ sec: 'meteo', secOcc: 1, b0: 0, b1: 1 }] },
  'evenements-de-bord': { ch: '15', parts: [{ sec: 'evenements-en-mer', secOcc: 1, b0: 3, b1: 3 }] },
  'disponibilite-des-biens': { ch: '13', parts: [{ sec: '1-disponibilite-des-biens', secOcc: 1, b0: 0, b1: 1 }] },
});

/**
 * PROUVE l'adresse figée d'une entrée inline : `{ ref }`, ou `{ erreur }` nominative.
 * @param {{ id: string, desc: string, source: { book: string } }} entree
 * @param {{ ch: string, parts: object[] }} cible
 */
export function prouver(entree, cible) {
  const livre = entree.source.book;
  const chapitre = lireChapitre(livre, cible.ch);
  if (!chapitre) return { erreur: `${entree.id} → ${livre} ch.${cible.ch} : chapitre introuvable` };
  const ref = { book: livre, ch: cible.ch, parts: cible.parts.map((choix) => fragmentBlocs(chapitre, choix)) };
  const ou = `${entree.id} → ${ouDeLAdresse(ref)}`;
  const unites = unitesDeLAdresse(chapitre, ref);
  if (estErreur(unites)) return { erreur: `${ou} : ne résout pas — ${unites.error} : ${unites.detail}` };
  if (!aligner(unitesDuTexte(entree.desc), unites.unites)) return { erreur: `${ou} : la desc n'est pas contenue dans le rendu de l'adresse` };
  return { ref };
}

/**
 * Migre le TEXTE d'un `regles.json` ; sur panne, le texte rendu est l'entrée intacte.
 * @param {string} brut
 * @returns {{ texte: string, gestes: { id: string, adresse: string }[], restantes: string[], echecs: string[] }}
 */
export function migrer(brut) {
  /** @type {string[]} */
  const echecs = [];
  /** @type {string[]} */
  const restantes = [];
  /** @type {{ id: string, desc: string, ref: object }[]} */
  const gestes = [];

  const data = JSON.parse(brut);
  if (!Array.isArray(data)) return { texte: brut, gestes: [], restantes, echecs: [`${FICHIER} n'est pas un tableau d'entrées`] };

  for (const [i, entree] of data.entries()) {
    const id = typeof entree?.id === 'string' ? entree.id : `[${i}]`;
    const ou = `${FICHIER} ${id}`;
    const aDesc = typeof entree?.desc === 'string' && entree.desc.length > 0;
    if (aDesc && entree?.descRef !== undefined) {
      echecs.push(`${ou} : \`desc\` ET \`descRef\` — un texte, un porteur`);
      continue;
    }
    if (!aDesc) continue;
    const cible = Object.hasOwn(ADRESSES, id) ? ADRESSES[id] : undefined;
    if (!cible) {
      restantes.push(`${ou} : hors table`);
      continue;
    }
    const livre = entree?.source?.book;
    if (typeof livre !== 'string' || !sigleDe(livre)) {
      echecs.push(`${ou} : ${livre ? `livre sans extraction FR (${livre})` : 'sans `source.book`'}`);
      continue;
    }
    const preuve = prouver(entree, cible);
    if (preuve.erreur) {
      echecs.push(`${FICHIER} ${preuve.erreur}`);
      continue;
    }
    gestes.push({ id, desc: entree.desc, ref: preuve.ref });
  }

  let texte = brut;
  let remplacements = 0;
  if (echecs.length === 0) {
    for (const geste of gestes) {
      const ancre = `"desc": ${JSON.stringify(geste.desc)}`;
      const pose = remplacerAncre(texte, ancre, ({ indentation }) => `"descRef": ${jsonIndente(geste.ref, indentation)}`);
      if (pose.erreur) {
        echecs.push(`${FICHIER} ${geste.id} : ${pose.erreur}`);
        continue;
      }
      texte = pose.texte;
      remplacements += 1;
    }
  }
  if (echecs.length === 0 && remplacements !== gestes.length) {
    echecs.push(`compte TEXTUEL (${remplacements}) ≠ compte STRUCTUREL (${gestes.length})`);
  }
  return {
    texte: echecs.length === 0 ? texte : brut,
    gestes: gestes.map(({ id, ref }) => ({ id, adresse: ouDeLAdresse(ref) })),
    restantes,
    echecs,
  };
}

if (import.meta.main) {
  const cible = path.join(ROOT, FICHIER);
  const brut = readFileSync(cible, 'utf8');
  const { texte, gestes, restantes, echecs } = migrer(brut);
  console.log(`${FICHIER} — ${gestes.length} adressée(s), ${restantes.length} hors table`);
  for (const g of gestes) console.log(`  ${g.id.padEnd(40)} ${g.adresse}`);
  for (const r of restantes) console.log(`  · ${r}`);
  if (echecs.length) {
    console.error(`\nPANNE — ${echecs.length} adresse(s) refusée(s), RIEN n'a été écrit :`);
    for (const e of echecs) console.error(`  ${e}`);
    process.exit(1);
  }
  if (texte !== brut) writeFileSync(cible, texte, 'utf8');
  console.log(`\nRemplacements écrits : ${gestes.length}`);
}
