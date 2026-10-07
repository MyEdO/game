import { evaluate } from './lib.mjs';

const EPSILON = 1;
const deborde = (interieur, exterieur) => !exterieur || interieur.left < exterieur.left - EPSILON || interieur.right > exterieur.right + EPSILON || interieur.top < exterieur.top - EPSILON || interieur.bottom > exterieur.bottom + EPSILON;
const intersecte = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > EPSILON && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > EPSILON;

/** @type {string} Expression d'observation autonome, partagée par le kit et les pilotes externes. */
export const expressionMesureRollRows = `(${observerDomRollRows.toString()})()`;

/**
 * @typedef {{left:number, top:number, right:number, bottom:number, width:number, height:number}} Rectangle
 * @typedef {{rect:Rectangle, texte:string, texteRects:Rectangle[], lignes:number}} Cellule
 * @typedef {{rect:Rectangle, texteRects:Rectangle[], participant:string|null, ligneRect:Rectangle|null, rangees:number[]}} Provenance
 * @typedef {{index:number, visible:boolean, participant:string|null, rect:Rectangle, table:boolean, pending:boolean,
 * calcul:Cellule|null, de:(Cellule & {statut:string, statutRects:Rectangle[], lignesStatut:number})|null,
 * dr:Cellule|null, provenance?:Provenance}} Rangee
 * @typedef {{page:{viewport:{largeur:number, hauteur:number}, scroll:{largeur:number, hauteur:number}, rect:Rectangle},
 * rangees:Rangee[], provenances:Provenance[]}} MesureRollRows
 */

/**
 * @param {MesureRollRows} mesure
 * @returns {string[]} Défauts nommés par page ou index de rangée ; sans accès DOM.
 */
export function defautsEnTete(mesure) {
  const defauts = [];
  const { page } = mesure;
  if (page.scroll.largeur > page.viewport.largeur + EPSILON) defauts.push('page : scroll-horizontal-page');
  if (page.scroll.hauteur > page.viewport.hauteur + EPSILON) defauts.push('page : scroll-vertical-page');
  const visibles = mesure.rangees.filter((r) => r.visible);
  for (const row of visibles) {
    const dire = (classe, detail = '') => defauts.push(`rangée ${row.index} : ${classe}${detail ? ` (${detail})` : ''}`);
    if (row.rect.left < -EPSILON || row.rect.right > page.viewport.largeur + EPSILON) dire('rangee-hors-viewport');
    const cellules = ['calcul', 'de', 'dr'].filter((nom) => !row.table || nom !== 'dr' || row.dr);
    for (const nom of cellules) {
      const cellule = row[nom];
      if (!cellule) { dire('cellule-absente', nom); continue; }
      if (!row.table && cellule.lignes > 1) dire(`${nom}-multiligne`);
      if (deborde(cellule.rect, row.rect)) dire('cellule-hors-rangee', nom);
      if (cellule.texteRects.some((r) => deborde(r, cellule.rect))) dire('texte-hors-cellule', nom);
      for (const autreNom of cellules.filter((autre) => autre !== nom)) {
        if (cellule.texteRects.some((r) => intersecte(r, row[autreNom]?.rect))) dire('texte-superpose', `${nom}/${autreNom}`);
      }
    }
    for (let i = 0; i < cellules.length; i++) for (let j = i + 1; j < cellules.length; j++) {
      if (intersecte(row[cellules[i]]?.rect, row[cellules[j]]?.rect)) dire('cellules-superposees', `${cellules[i]}/${cellules[j]}`);
    }
    if (row.pending && row.de?.statut && row.de.lignesStatut !== 1) dire('statut-multiligne');
    if (row.de?.statutRects?.some((r) => deborde(r, row.de.rect))) dire('texte-hors-cellule', 'statut');
    if (row.provenance && row.provenance.participant !== row.participant) dire('provenance-participant');
  }
  for (const provenance of mesure.provenances ?? []) {
    const attachees = visibles.filter((r) => provenance.rangees.includes(r.index));
    if (!attachees.length || !provenance.ligneRect || provenance.participant === null) defauts.push('marque : provenance-detachee');
    if (provenance.ligneRect && deborde(provenance.rect, provenance.ligneRect)) defauts.push('marque : provenance-hors-ligne');
    if (provenance.texteRects.some((r) => deborde(r, provenance.rect))) defauts.push('marque : texte-hors-cellule (provenance)');
    for (const row of attachees) {
      if (provenance.participant !== row.participant) defauts.push(`rangée ${row.index} : provenance-participant`);
      if (intersecte(provenance.rect, row.rect)) defauts.push(`rangée ${row.index} : provenance-superposee`);
    }
  }
  return [...new Set(defauts)];
}

function observerDomRollRows() {
  const epsilon = 1;
  const rectangle = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  const participants = [...document.querySelectorAll('.prow')];
  const participant = (el) => {
    const prow = el.closest('.prow');
    return prow ? `prow-${participants.indexOf(prow)}` : null;
  };
  const visible = (el) => {
    if (!el?.isConnected || !el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false;
    let cadre = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let parent = el; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || Number(style.opacity) === 0) return false;
      const boite = parent.getBoundingClientRect();
      if (parent !== el && /(auto|scroll|hidden|clip)/.test(style.overflowX)) cadre = { ...cadre, left: Math.max(cadre.left, boite.left), right: Math.min(cadre.right, boite.right) };
      if (parent !== el && /(auto|scroll|hidden|clip)/.test(style.overflowY)) cadre = { ...cadre, top: Math.max(cadre.top, boite.top), bottom: Math.min(cadre.bottom, boite.bottom) };
    }
    return Math.min(r.right, cadre.right) - Math.max(r.left, cadre.left) > 0 && Math.min(r.bottom, cadre.bottom) - Math.max(r.top, cadre.top) > 0;
  };
  const textes = (el) => {
    if (!el) return [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || !visible(node.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(rectangle(r));
    }
    return rects;
  };
  const lignes = (rects) => {
    const groupes = [];
    for (const r of [...rects].sort((a, b) => a.top - b.top)) {
      const groupe = groupes.find((g) => {
        const recouvrement = Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top);
        return recouvrement > Math.min(r.height, g.height) / 2 || Math.abs(r.top - g.top) <= epsilon;
      });
      if (!groupe) groupes.push(r);
    }
    return groupes.length;
  };
  const cellule = (el) => {
    if (!el) return null;
    const texteRects = textes(el);
    return { rect: rectangle(el.getBoundingClientRect()), texte: el.textContent.trim(), texteRects, lignes: lignes(texteRects) };
  };
  const elements = [...document.querySelectorAll('.rm-roll')].filter(visible);
  const provenances = [...document.querySelectorAll('.prow-fixed-mark')].filter(visible).map((el) => {
    const ligne = el.closest('.prow-line');
    return { rect: rectangle(el.getBoundingClientRect()), texteRects: textes(el), participant: participant(el), ligneRect: ligne ? rectangle(ligne.getBoundingClientRect()) : null,
      rangees: elements.flatMap((row, index) => ligne && row.closest('.prow-line') === ligne ? [index] : []) };
  });
  const rangees = elements.map((el, index) => {
    const de = cellule(el.querySelector('.rm-roll-dice'));
    const statut = el.querySelector('.rm-roll-empty');
    const statutRects = textes(statut);
    const provenance = provenances.find((p) => p.rangees.includes(index));
    return { index, visible: true, participant: participant(el), rect: rectangle(el.getBoundingClientRect()), table: el.classList.contains('table'), pending: el.classList.contains('pending'),
      calcul: cellule(el.querySelector('.rm-roll-calc')), de: de ? { ...de, statut: statut?.textContent.trim() ?? '', statutRects, lignesStatut: lignes(statutRects) } : null,
      dr: cellule(el.querySelector('.rm-roll-sl')), ...(provenance ? { provenance } : {}) };
  });
  const root = document.scrollingElement ?? document.documentElement;
  return { page: { viewport: { largeur: innerWidth, hauteur: innerHeight }, scroll: { largeur: root.scrollWidth, hauteur: root.scrollHeight }, rect: rectangle(root.getBoundingClientRect()) }, rangees, provenances };
}

/**
 * @param {object} session Session du kit CDP canonique.
 * @returns {Promise<MesureRollRows>} Rectangles DOM et Range de tous les nœuds texte visibles.
 * Les lignes regroupent les rectangles dont les hauteurs se recouvrent majoritairement,
 * ou les sommets diffèrent d'au plus un pixel. Les identifiants prow sont locaux à l'instantané.
 */
export async function mesurerRollRows(session) {
  return evaluate(session, expressionMesureRollRows);
}
