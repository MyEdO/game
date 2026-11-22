/**
 * Les survols du kit, posés par délégation sur tout le document : la bulle (`raison`, `.bulle-refus` sur parchemin)
 * pour un mot (`data-bulle`), l'aperçu (`apercu`) pour une chose qu'on possède ou qu'on achète (`data-apercu`, voir
 * `./pieces`) : son nom, sa nature, le texte du livre et, au pied, ce qui la refuse. La bulle se pose au-dessus de ce
 * qu'elle qualifie, dessous s'il manque la place ; l'aperçu à sa droite, à gauche s'il manque la place ; tous deux
 * restent dans l'écran.
 */
import type { Apercu } from './pieces';

const bulle = document.createElement('span');
bulle.className = 'bulle-refus parchemin bulle-du-jeu';
const apercu = document.createElement('div');
apercu.className = 'apercu parchemin apercu-du-jeu';

function cacher() {
  bulle.hidden = true;
  apercu.hidden = true;
}

function poserLaBulle(porteur: HTMLElement, texte: string) {
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

function poserLApercu(porteur: HTMLElement, a: Apercu) {
  apercu.replaceChildren();
  const tete = document.createElement('div');
  tete.className = 'tete';
  const nom = document.createElement('div');
  nom.className = 'nom-propre moyen gothique';
  nom.textContent = a.nom;
  tete.append(nom);
  apercu.append(tete);
  if (a.nature) { const n = document.createElement('div'); n.className = 'sous-titre'; n.textContent = a.nature; apercu.append(n); }
  if (a.texte) { const p = document.createElement('p'); p.textContent = a.texte; apercu.append(p); }
  if (a.pied) { const p = document.createElement('div'); p.className = 'pied glose avertissement'; p.textContent = a.pied; apercu.append(p); }
  apercu.hidden = false;
  const r = porteur.getBoundingClientRect();
  const q = apercu.getBoundingClientRect();
  const aDroite = r.right + 14 + q.width <= window.innerWidth - 6;
  const x = aDroite ? r.right + 14 : Math.max(6, r.left - 14 - q.width);
  const y = Math.max(6, Math.min(window.innerHeight - q.height - 6, r.top + r.height / 2 - 30));
  apercu.classList.toggle('vers-gauche', aDroite);
  apercu.classList.toggle('vers-droite', !aDroite);
  apercu.style.left = `${x}px`;
  apercu.style.top = `${y}px`;
  apercu.style.setProperty('--pointe', `${Math.max(10, Math.min(q.height - 26, r.top + r.height / 2 - y - 8))}px`);
}

function montrer(cible: EventTarget | null) {
  const el = cible instanceof Element ? cible : null;
  const porteur = el?.closest<HTMLElement>('[data-apercu], [data-bulle]');
  cacher();
  if (!porteur) return;
  if (porteur.dataset.apercu) poserLApercu(porteur, JSON.parse(porteur.dataset.apercu) as Apercu);
  else if (porteur.dataset.bulle) poserLaBulle(porteur, porteur.dataset.bulle);
}

/** Pose les survols une fois pour toute la page. */
export function installerLesSurvols(): void {
  cacher();
  document.body.append(bulle, apercu);
  document.addEventListener('mouseover', (ev) => montrer(ev.target));
  document.addEventListener('focusin', (ev) => montrer(ev.target));
  document.addEventListener('scroll', cacher, true);
  document.addEventListener('click', cacher, true);
}
