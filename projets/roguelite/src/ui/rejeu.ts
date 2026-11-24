/**
 * Le rejeu d'un combat, pas à pas, depuis les relevés du noyau (`IssueDuCombat`) : la cour du terrain, les figurines
 * à leurs cases, les coups (fente ou trait, touche, parade, esquive, Critique, sort), l'ordre du round, le journal et
 * la vitesse. Le combat est déjà joué : ce module ne fait que le montrer.
 */
import type * as J from '../jeu';
import { annonceDuCoupSurUnAllie, libelleDEtat, type Coup, type IssueDuCombat, type Pas, type PionDuPlateau } from '../noyau';
import { dessinerLaCour, type Cour } from '../cour';
import { buste, figurine, gabaritDeCreature } from '../figures';
import { cadre, jauge, medaillon, picto, plaque, portrait } from '../kit';
import { gloserDans } from './bulles';
import { busteDuHeros, esc, gabaritDe } from './pieces';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

/** Les héros du groupe, pour les figurines et les portraits du rejeu. */
let roster: J.Heros[] = [];
let rejeu: { issue: IssueDuCombat; suite: string; i: number; vitesse: number; minuteur: number; fin: () => void } | null = null;

function gabaritDuPion(q: PionDuPlateau) {
  if (q.camp === 'heros') {
    const h = roster.find((x) => x.c.id === q.id);
    if (h) return gabaritDe(h);
  }
  return gabaritDeCreature(q.creature ?? '');
}

let cour: Cour | null = null;

/** L'échelle de la cour : elle tient dans l'écran sur un bureau ; sur un écran étroit, elle garde une taille lisible et défile. */
export function mettreALEchelle() {
  const cadreCour = document.querySelector<HTMLElement>('#combat .cour-cadre');
  if (!cadreCour || !cour) return;
  const { x, y, largeur, hauteur } = cour.cadrage;
  const dispo = Math.max(240, window.innerHeight - 290);
  const k = Math.max(0.62, Math.min(1.25, (window.innerWidth - 32) / largeur, dispo / hauteur));
  cadreCour.style.setProperty('--k', String(k));
  cadreCour.style.width = `${largeur * k}px`;
  cadreCour.style.height = `${hauteur * k}px`;
  cadreCour.querySelector<HTMLElement>('.cour')!.style.transform = `scale(${k}) translate(${-x}px, ${-y}px)`;
}

/** Ouvre le rejeu de `issue` ; `suite` dit ce que l'issue laisse (le butin), sous sa bannière ; `fin` rend la main. */
export function ouvrirLeRejeu(issue: IssueDuCombat, suite: string, fin: () => void, terrain: string, heros: J.Heros[]) {
  roster = heros;
  const scene = $('#combat');
  scene.hidden = false;
  cour = dessinerLaCour(issue.largeur, issue.hauteur, terrain);
  scene.innerHTML = `<div class="combat-ecran">
    <header class="combat-tete">
      ${cadre(`<div class="cartouche">${medaillon('epee', 'grand')}<div><div class="titre gothique">Combat</div><div class="sous-titre" id="round">Round 1</div></div></div>`, { balise: 'div', classe: 'cartouche-combat' })}
      <ol class="ordre" aria-label="Ordre du round"></ol>
      <div class="vitesse" role="group" aria-label="Vitesse">${[1, 2, 4].map((v) => `<button type="button" class="plaque petite laiton${v === 1 ? ' armee' : ''}" data-v="${v}"><div>×${v}</div></button>`).join('')}<button type="button" class="plaque petite laiton" data-v="0"><div>Passer</div></button></div>
    </header>
    <div class="tour" id="tour" aria-live="polite"></div>
    <div class="champ"><div class="cour-cadre"><div class="cour" style="width:${cour.largeur}px;height:${cour.hauteur}px">${cour.svg}<div class="figures"></div></div></div></div>
    <div class="combat-pied">
      ${cadre(`<button type="button" class="agrandir-journal" data-j aria-pressed="false" data-bulle="Agrandir ou réduire le journal">${picto('livre', 16, 1.7)}</button><ol class="journal"></ol>`, { fond: 'parchemin', balise: 'div', classe: 'panneau-journal' })}
      <div class="rang-heros vivant"></div>
    </div>
    <div class="issue-place" id="combat-fin-place"></div>
  </div>`;
  mettreALEchelle();
  rejeu = { issue, suite, i: 0, vitesse: 1, minuteur: 0, fin };
  poserLePas(issue.pas[0]);
  planifier();
}

/** La durée d'un pas : le temps de ses coups, un mouvement, ou un battement bref. */
function dureeDuPas(p: Pas, avant: Pas | null): number {
  const bouge = !!avant && p.pions.some((q) => { const a = avant.pions.find((x) => x.id === q.id); return a && (a.x !== q.x || a.y !== q.y); });
  const base = p.coups.length ? 380 + p.coups.length * 720 : bouge ? 520 : p.etats.length ? 520 : p.actif !== avant?.actif ? 420 : 160;
  return base / (rejeu?.vitesse ?? 1);
}

function planifier() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  if (rejeu.i >= rejeu.issue.pas.length - 1) return terminerLeRejeu();
  const p = rejeu.issue.pas[rejeu.i];
  rejeu.minuteur = window.setTimeout(() => {
    if (!rejeu) return;
    rejeu.i++;
    poserLePas(rejeu.issue.pas[rejeu.i]);
    planifier();
  }, dureeDuPas(p, rejeu.issue.pas[rejeu.i - 1] ?? null));
}

/** Joue une animation de figurine : efface les autres, la pose, la retire à sa fin. */
function animer(el: HTMLElement, classe: 'fente' | 'tire' | 'frappe' | 'esquive') {
  el.classList.remove('fente', 'tire', 'frappe', 'esquive');
  void el.offsetWidth;
  el.classList.add(classe);
  el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
}

const figureDe = (id: string) => document.querySelector<HTMLElement>(`#combat .fig[data-id="${CSS.escape(id)}"]`);

function flotter(el: HTMLElement | null, texte: string, genre: string) {
  if (!el) return;
  const f = document.createElement('span');
  f.className = `flottant ${genre}`;
  f.textContent = texte;
  el.append(f);
  setTimeout(() => f.remove(), 1500);
}

/** Un coup : la fente ou le trait, puis l'impact et son issue, écrite. */
function jouerLeCoup(c: Coup, vitesse: number) {
  const de = figureDe(c.de);
  const vers = figureDe(c.vers);
  if (!de || !vers) return;
  const pos = (el: HTMLElement) => [Number(el.dataset.px), Number(el.dataset.py)];
  const [x0, y0] = pos(de);
  const [x1, y1] = pos(vers);
  const impact = 300 / vitesse;
  const allie = de.classList.contains('camp-ennemi') === vers.classList.contains('camp-ennemi');
  const annonce = annonceDuCoupSurUnAllie(c, allie);
  if (annonce) {
    if (annonce.flash) flotter(de, annonce.flash, 'sur-allie');
    $('#tour').innerHTML = `<span class="ruban gothique">${esc(annonce.ruban)}</span>`;
  }
  vers.classList.add('cible');
  setTimeout(() => vers.classList.remove('cible'), impact + 500 / vitesse);
  if (c.genre === 'distance' || c.genre === 'spell') {
    const t = document.createElement('i');
    t.className = `trait ${c.genre}`;
    t.style.cssText = `left:${x0}px;top:${y0 - 50}px;--dx:${x1 - x0}px;--dy:${y1 - y0}px;--duree:${impact}ms;--angle:${Math.atan2(y1 - y0, x1 - x0)}rad`;
    de.parentElement!.append(t);
    setTimeout(() => t.remove(), impact + 60);
    animer(de, 'tire');
  } else {
    const n = Math.hypot(x1 - x0, y1 - y0) || 1;
    de.style.setProperty('--fx', `${((x1 - x0) / n) * 26}px`);
    de.style.setProperty('--fy', `${((y1 - y0) / n) * 26}px`);
    de.style.setProperty('--duree', `${560 / vitesse}ms`);
    animer(de, 'fente');
  }
  setTimeout(() => {
    if (c.touche && allie && c.genre === 'spell') {
      flotter(vers, c.sort ?? 'Sort', 'etat');
    } else if (c.touche) {
      animer(vers, 'frappe');
      flotter(vers, c.blessures ? `−${c.blessures}` : 'Touché', c.critique ? 'degat critique' : 'degat');
      if (c.critique) setTimeout(() => flotter(vers, 'Critique !', 'critique-mot'), 120);
    } else if (c.genre === 'spell') {
      flotter(de, 'Échec', 'evite');
    } else {
      flotter(vers, c.defense === 'parade' ? 'Paré' : c.defense === 'esquive' ? 'Esquivé' : 'Raté', 'evite');
      animer(vers, 'esquive');
    }
  }, impact);
}

/** Pose un pas sur le plateau ; `anime` faux le pose sans jouer ses coups (« Passer »). */
function poserLePas(p: Pas, anime = true) {
  const zone = $('#combat .figures');
  const vitesse = rejeu?.vitesse ?? 1;
  for (const q of p.pions) {
    let el = figureDe(q.id);
    if (!el) {
      const g = gabaritDuPion(q);
      el = document.createElement('div');
      el.dataset.id = q.id;
      el.className = `fig camp-${q.camp}`;
      el.dataset.bulle = q.label;
      el.style.setProperty('--s', String(q.cases > 1 ? 1.5 : 1));
      el.style.setProperty('--haut', `${(g.bete ? 46 : 74) * g.taille + 14}px`);
      el.innerHTML = `${figurine(g, q.camp)}<span class="pv-fig"><i></i></span>`;
      zone.append(el);
    }
    const [px, py] = cour!.centre(q.x, q.y, q.cases);
    el.dataset.px = String(px);
    el.dataset.py = String(py);
    el.style.left = `${px - 50}px`;
    el.style.top = `${py - 130}px`;
    el.style.zIndex = String(Math.round(py));
    el.classList.toggle('hors', q.hors);
    el.classList.toggle('actif', q.id === p.actif);
    (el.querySelector('.pv-fig i') as HTMLElement).style.width = `${(100 * q.pv) / Math.max(1, q.max)}%`;
  }
  if (anime) {
    p.coups.forEach((c, k) => setTimeout(() => jouerLeCoup(c, vitesse), (k * 720) / vitesse));
    const apres = (p.coups.length * 720 + 200) / vitesse;
    p.etats.forEach((e, k) => setTimeout(() => flotter(figureDe(e.porteur), libelleDEtat(e.etat, 1), 'etat'), apres + k * 160));
  }
  const actif = p.pions.find((q) => q.id === p.actif);
  const champ = document.querySelector<HTMLElement>('#combat .champ');
  if (actif && champ && champ.scrollWidth > champ.clientWidth) {
    const k = Number(document.querySelector<HTMLElement>('#combat .cour-cadre')?.style.getPropertyValue('--k')) || 1;
    champ.scrollTo({ left: (Number(figureDe(actif.id)!.dataset.px) - cour!.cadrage.x) * k - champ.clientWidth / 2, behavior: anime ? 'smooth' : 'auto' });
  }
  $('#round').textContent = `Round ${p.round}`;
  $('#tour').innerHTML = actif ? `<span class="ruban gothique">${actif.camp === 'heros' ? 'Au tour de' : 'Tour adverse :'} ${esc(actif.label)}</span>` : '';
  $('#tour').className = `tour ${actif?.camp ?? ''}`;
  const parId = new Map(p.pions.map((q) => [q.id, q]));
  $('#combat .ordre').innerHTML = p.ordre.map((id) => parId.get(id)).filter((q): q is PionDuPlateau => !!q).map((q) => {
    return `<li class="${q.id === p.actif ? 'actif' : ''}${q.hors ? ' hors' : ''}" data-bulle="${esc(q.label)}">${portrait(buste(gabaritDuPion(q), q.camp), q.camp, 'petit')}</li>`;
  }).join('');
  $('#combat .rang-heros').innerHTML = p.pions.filter((q) => q.camp === 'heros').map((q) => {
    const h = roster.find((x) => x.c.id === q.id);
    return `<div class="carte-heros${q.hors ? ' hors' : ''}${q.id === p.actif ? ' choisi' : ''}">${portrait(h ? busteDuHeros(h) : buste(gabaritDuPion(q), q.camp), 'heros', 'moyen')}<span class="qui"><span class="nom-propre petit gothique">${esc(q.label)}</span><span class="vie"><span>Blessures</span><span class="chiffres">${q.pv} / ${q.max}</span></span>${jauge(q.pv / Math.max(1, q.max), { taille: 'forte' })}</span></div>`;
  }).join('');
  const j = $('#combat .journal');
  for (const l of p.lignes) {
    const li = document.createElement('li');
    li.textContent = l;
    if (/Victoire|Défaite/.test(l)) li.className = 'fort';
    else if (/CRITIQUE|hors de combat|s'effondre/.test(l)) li.className = 'rouge';
    j.append(li);
    gloserDans(li);
  }
  j.scrollTop = j.scrollHeight;
}

function terminerLeRejeu() {
  const place = $('#combat-fin-place');
  if (!place || place.innerHTML || !rejeu) return;
  const victoire = rejeu.issue.issue === 'victoire';
  place.innerHTML = `<div class="banniere-issue ${victoire ? 'victoire' : 'defaite'}"><span class="gothique">${victoire ? 'Victoire' : rejeu.issue.issue === 'defaite' ? 'Déroute' : 'Le combat s’enlise'}</span></div>${rejeu.suite ? `<p class="suite-issue">${esc(rejeu.suite)}</p>` : ''}${plaque('Continuer', 'id="combat-fin"', { armee: true, taille: 'appel' })}`;
  $('#combat-fin').focus();
}

/** Pose le dernier pas sans jouer ses coups, et l'issue. */
function passer() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  for (let i = rejeu.i + 1; i < rejeu.issue.pas.length; i++) poserLePas(rejeu.issue.pas[i], false);
  rejeu.i = rejeu.issue.pas.length - 1;
  terminerLeRejeu();
}

/** Ferme le rejeu depuis son issue ; avant elle, y saute (« Échap » ne fait jamais manquer l'issue). */
export function fermerLeRejeu() {
  if (!rejeu) return;
  if (!$('#combat-fin-place').innerHTML) return passer();
  clearTimeout(rejeu.minuteur);
  const fin = rejeu.fin;
  rejeu = null;
  $('#combat').hidden = true;
  fin();
}

/** Les clics propres au rejeu (vitesse, « Passer », fin, journal agrandi) ; vrai s'il en a traité un. */
export function cliquerDansLeRejeu(cible: Element): boolean {
  const v = cible.closest<HTMLElement>('[data-v]');
  if (v && rejeu) {
    const n = Number(v.dataset.v);
    if (n === 0) passer();
    else {
      rejeu.vitesse = n;
      document.querySelectorAll('#combat [data-v]').forEach((b) => b.classList.toggle('armee', b === v));
      planifier();
    }
    return true;
  }
  if (cible.closest('#combat-fin')) { fermerLeRejeu(); return true; }
  const j = cible.closest<HTMLElement>('[data-j]');
  if (j) {
    const ouvert = j.closest('.panneau-journal')!.classList.toggle('ouvert');
    j.setAttribute('aria-pressed', String(ouvert));
    const liste = $('#combat .journal');
    liste.scrollTop = liste.scrollHeight;
    return true;
  }
  return false;
}

/** Un rejeu est-il ouvert ? */
export const rejeuOuvert = (): boolean => rejeu !== null;
