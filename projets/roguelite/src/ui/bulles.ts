/**
 * Les survols du kit, posés par délégation sur tout le document : la bulle (`raison`, `.bulle-refus` sur parchemin)
 * pour un mot (`data-bulle`), l'aperçu (`apercu`) pour une chose qu'on possède ou qu'on achète (`data-apercu`, voir
 * `./pieces`) : son nom, sa nature, le texte du livre et, au pied, ce qui la refuse. La bulle se pose au-dessus de ce
 * qu'elle qualifie, dessous s'il manque la place ; l'aperçu à sa droite, à gauche s'il manque la place ; tous deux
 * restent dans l'écran.
 */
import { parseTable } from '../noyau';
import type { Apercu } from './pieces';

/** Le sens des abréviations du livre que l'interface affiche, en bulle au survol. */
const GLOSSAIRE: Record<string, string> = {
  BF: 'Bonus de Force', BE: 'Bonus d’Endurance', PA: 'Points d’Armure', PB: 'Points de Blessures', DR: 'Degrés de Réussite',
  CC: 'Capacité de Combat', CT: 'Capacité de Tir', Ag: 'Agilité', Dex: 'Dextérité', Int: 'Intelligence', FM: 'Force Mentale',
  Soc: 'Sociabilité', PX: 'Points d’Expérience', CO: 'Couronnes d’or', 'Enc.': 'Encombrement',
};
const ABREVIATION = new RegExp(`(?<![\\p{L}\\d])(${Object.keys(GLOSSAIRE).map((k) => k.replace('.', '\\.')).join('|')})(?![\\p{L}\\d])`, 'gu');
const PRESENTE = new RegExp(ABREVIATION.source, 'u');

/** Pose sa bulle sur chaque abréviation du glossaire dans les textes de `racine`. */
export function gloserDans(racine: ParentNode): void {
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('button, [data-bulle], [data-apercu], svg, .bulle-du-jeu, .apercu-du-jeu') || !PRESENTE.test(n.nodeValue ?? '') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const noeuds: Text[] = [];
  while (marcheur.nextNode()) noeuds.push(marcheur.currentNode as Text);
  for (const n of noeuds) {
    const morceaux = document.createDocumentFragment();
    let fin = 0;
    for (const m of (n.nodeValue ?? '').matchAll(ABREVIATION)) {
      morceaux.append(n.nodeValue!.slice(fin, m.index));
      const abbr = document.createElement('abbr');
      abbr.textContent = m[0];
      abbr.dataset.bulle = GLOSSAIRE[m[0]];
      morceaux.append(abbr);
      fin = m.index! + m[0].length;
    }
    morceaux.append(n.nodeValue!.slice(fin));
    n.replaceWith(morceaux);
  }
}

/** La bulle et l'aperçu de la page, posés par `installerLesSurvols`. */
interface Survols { bulle: HTMLElement; apercu: HTMLElement }

function cacher({ bulle, apercu }: Survols) {
  bulle.hidden = true;
  apercu.hidden = true;
}

function poserLaBulle(bulle: HTMLElement, porteur: HTMLElement, texte: string) {
  bulle.textContent = texte;
  bulle.hidden = false;
  const r = porteur.getBoundingClientRect();
  const q = bulle.getBoundingClientRect();
  const dessous = r.top - q.height - 11 < 4;
  const x = Math.max(6, Math.min(window.innerWidth - q.width - 6, r.left + r.width / 2 - q.width / 2));
  bulle.classList.toggle('dessous', dessous);
  bulle.style.left = `${x}px`;
  bulle.style.top = `${dessous ? r.bottom + 11 : r.top - q.height - 11}px`;
  bulle.style.setProperty('--pointe', `${r.left + r.width / 2 - (x + q.width / 2)}px`);
}

/** Le texte d'une ligne, son gras (`**…**`) et son italique (`*…*`, `_…_`) en éléments, sans HTML injecté. */
function enLigne(texte: string): Node[] {
  return texte.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|(?<![\p{L}\d])_[^_]+_(?![\p{L}\d]))/u).filter(Boolean).map((morceau) => {
    const gras = /^\*\*(.+)\*\*$/.exec(morceau);
    const italique = /^[*_](.+)[*_]$/.exec(morceau);
    if (!gras && !italique) return document.createTextNode(morceau);
    const el = document.createElement(gras ? 'b' : 'i');
    el.textContent = (gras ?? italique)![1];
    return el;
  });
}

/** Une table du texte du livre (`parseTable`) : son titre, ses en-têtes et ses rangées. */
function tableDuTexte(table: NonNullable<ReturnType<typeof parseTable>>): HTMLTableElement {
  const el = document.createElement('table');
  if (table.titre) el.createCaption().append(...enLigne(table.titre));
  const rangee = (cellules: string[], balise: 'th' | 'td') => {
    const tr = document.createElement('tr');
    for (const c of cellules) { const cellule = document.createElement(balise); cellule.append(...enLigne(c)); tr.append(cellule); }
    return tr;
  };
  el.createTHead().append(rangee(table.headers, 'th'));
  el.createTBody().append(...table.rows.map((r) => rangee(r, 'td')));
  return el;
}

/** Le texte du livre, verbatim, rendu : ses paragraphes, ses listes, ses tables, son gras et son italique (Markdown). */
function corpsDuTexte(texte: string): HTMLElement {
  const corps = document.createElement('div');
  corps.className = 'corps-apercu';
  for (const bloc of texte.split(/\n{2,}/)) {
    const lignes = bloc.split('\n');
    const table = lignes.every((l) => /^\s*\|/.test(l)) ? parseTable(bloc) : null;
    if (table) {
      corps.append(tableDuTexte(table));
      continue;
    }
    if (lignes.every((l) => /^\s*[-*] /.test(l))) {
      const ul = document.createElement('ul');
      for (const l of lignes) { const li = document.createElement('li'); li.append(...enLigne(l.replace(/^\s*[-*] /, ''))); ul.append(li); }
      corps.append(ul);
      continue;
    }
    const p = document.createElement('p');
    lignes.forEach((l, i) => { if (i) p.append(document.createElement('br')); p.append(...enLigne(l.replace(/^#+\s*/, ''))); });
    corps.append(p);
  }
  return corps;
}

function poserLApercu(apercu: HTMLElement, porteur: HTMLElement, a: Apercu) {
  apercu.replaceChildren();
  apercu.classList.toggle('parchemin', !a.planche);
  apercu.classList.toggle('bois', !!a.planche);
  const tete = document.createElement('div');
  tete.className = 'tete';
  const nom = document.createElement('div');
  nom.className = 'nom-propre moyen gothique';
  nom.textContent = a.nom;
  tete.append(nom);
  apercu.append(tete);
  if (a.nature) { const n = document.createElement('div'); n.className = 'sous-titre'; n.textContent = a.nature; apercu.append(n); }
  if (a.texte) apercu.append(corpsDuTexte(a.texte));
  if (a.planche) { const p = document.createElement('div'); p.className = 'planche-apercu'; p.innerHTML = a.planche; apercu.append(p); }
  if (a.pied) { const p = document.createElement('div'); p.className = 'pied glose avertissement'; p.textContent = a.pied; apercu.append(p); }
  apercu.hidden = false;
  const r = porteur.getBoundingClientRect();
  const q = apercu.getBoundingClientRect();
  const cote = r.right + 14 + q.width <= window.innerWidth - 6 ? 'vers-gauche' : r.left - 14 - q.width >= 6 ? 'vers-droite'
    : r.bottom + 14 + q.height <= window.innerHeight - 6 ? 'vers-haut' : 'vers-bas';
  const lateral = cote === 'vers-gauche' || cote === 'vers-droite';
  const x = cote === 'vers-gauche' ? r.right + 14 : cote === 'vers-droite' ? r.left - 14 - q.width
    : Math.max(6, Math.min(window.innerWidth - q.width - 6, r.left + r.width / 2 - q.width / 2));
  const y = lateral ? Math.max(6, Math.min(window.innerHeight - q.height - 6, r.top + r.height / 2 - 30))
    : cote === 'vers-haut' ? r.bottom + 14 : Math.max(6, r.top - 14 - q.height);
  for (const c of ['vers-gauche', 'vers-droite', 'vers-haut', 'vers-bas']) apercu.classList.toggle(c, c === cote);
  apercu.style.left = `${x}px`;
  apercu.style.top = `${y}px`;
  apercu.style.setProperty('--pointe', `${lateral ? Math.max(10, Math.min(q.height - 26, r.top + r.height / 2 - y - 8)) : Math.max(10, Math.min(q.width - 26, r.left + r.width / 2 - x - 8))}px`);
}

function montrer(survols: Survols, cible: EventTarget | null) {
  const el = cible instanceof Element ? cible : null;
  const porteur = el?.closest<HTMLElement>('[data-apercu], [data-bulle]');
  cacher(survols);
  if (!porteur) return;
  if (porteur.dataset.apercu) {
    const a = JSON.parse(porteur.dataset.apercu) as Apercu;
    poserLApercu(survols.apercu, porteur, porteur.dataset.bulle && !a.pied ? { ...a, pied: porteur.dataset.bulle } : a);
  }
  else if (porteur.dataset.bulle) poserLaBulle(survols.bulle, porteur, porteur.dataset.bulle);
}

/** Pose les survols une fois pour toute la page. */
export function installerLesSurvols(): void {
  const bulle = document.createElement('span');
  bulle.className = 'bulle-refus parchemin bulle-du-jeu';
  const apercu = document.createElement('div');
  apercu.className = 'apercu parchemin apercu-du-jeu';
  const survols: Survols = { bulle, apercu };
  const cacherLesSurvols = () => cacher(survols);
  cacherLesSurvols();
  document.body.append(bulle, apercu);
  document.addEventListener('mouseover', (ev) => montrer(survols, ev.target));
  document.addEventListener('focusin', (ev) => montrer(survols, ev.target));
  document.addEventListener('scroll', cacherLesSurvols, true);
  document.addEventListener('click', cacherLesSurvols, true);
}
