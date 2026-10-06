/**
 * Le geste commun des migrations qui ADRESSENT une prose inline par une TABLE FIGÉE `id → cible` : chaque
 * cible est PROUVÉE (`prouver`, `scripts/source/lieux.mjs`) avant d'être écrite ; une seule preuve qui
 * échoue et RIEN n'est écrit. Une entrée inline hors table est NOMMÉE (`restantes`), jamais touchée ;
 * une entrée adressée n'a plus de `desc` : IDEMPOTENT.
 *
 * FORMATAGE PRÉSERVÉ : réécriture TEXTUELLE ancrée sur le couple `"desc": <chaîne JSON>` exact de l'entrée
 * (`remplacerAncre`) ; le compte TEXTUEL est confronté au compte STRUCTUREL.
 */
import { sigleDe } from '../../raw/_lib.mjs';
import { ouDeLaCible, prouver } from '../../source/lieux.mjs';
import { jsonIndente, remplacerAncre } from '../../source/reecriture-ancree.mjs';

/**
 * Migre le TEXTE d'un document (tableau d'entrées) par la table `adresses` ; sur panne, le texte rendu est
 * l'entrée intacte.
 * @param {string} brut
 * @param {Readonly<Record<string, { ch: string, sec: string, secOcc: number, b0: number, b1: number, ajoute?: object[] }>>} adresses
 * @param {string} fichier chemin du document, pour les messages
 * @returns {{ texte: string, gestes: { id: string, adresse: string }[], restantes: string[], echecs: string[] }}
 */
export function migrerParAdressesFigees(brut, adresses, fichier) {
  /** @type {string[]} */
  const echecs = [];
  /** @type {string[]} */
  const restantes = [];
  /** @type {{ id: string, desc: string, ref: object }[]} */
  const gestes = [];

  const data = JSON.parse(brut);
  if (!Array.isArray(data)) return { texte: brut, gestes: [], restantes, echecs: [`${fichier} n'est pas un tableau d'entrées`] };

  for (const [i, entree] of data.entries()) {
    const id = typeof entree?.id === 'string' ? entree.id : `[${i}]`;
    const ou = `${fichier} ${id}`;
    const aDesc = typeof entree?.desc === 'string' && entree.desc.length > 0;
    if (!aDesc) continue;
    if (entree?.descRef !== undefined) {
      echecs.push(`${ou} : \`desc\` ET \`descRef\` — un texte, un porteur`);
      continue;
    }
    const cible = Object.hasOwn(adresses, id) ? adresses[id] : undefined;
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
      echecs.push(`${fichier} ${preuve.erreur}`);
      continue;
    }
    gestes.push({ id, desc: entree.desc, ref: preuve.ref });
  }

  let texte = brut;
  let remplacements = 0;
  if (echecs.length === 0) {
    for (const geste of gestes) {
      const pose = remplacerAncre(texte, `"desc": ${JSON.stringify(geste.desc)}`, ({ indentation }) => `"descRef": ${jsonIndente(geste.ref, indentation)}`);
      if (pose.erreur) {
        echecs.push(`${fichier} ${geste.id} : ${pose.erreur}`);
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
    gestes: gestes.map(({ id, ref }) => ({ id, adresse: `${ref.book} ${ouDeLaCible({ ch: ref.ch, ...ref.parts[0] })}` })),
    restantes,
    echecs,
  };
}
