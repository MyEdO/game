/**
 * Le rejeu d'un combat, pas à pas, depuis les relevés du noyau (`IssueDuCombat`), au gabarit « Combat » des
 * maquettes : la cour du terrain en fond, les figurines à leurs cases, les coups (fente ou trait, touche, parade,
 * esquive, Critique, sort) ; la borne du round, l'ordre du tour (l'actif en bas, le round suivant au-delà de sa
 * borne), la barre de l'actif au socle, le journal sur le champ, « Passer » à la place de la fin du tour, et l'issue.
 * Le combat est déjà joué : ce module ne fait que le montrer.
 */
import type * as J from '../jeu';
import { libelleDEtat, type Coup, type IssueDuCombat, type Pas, type PionDuPlateau } from '../noyau';
import { dessinerLaCour, type Cour } from '../cour';
import { buste, figurine, gabaritDeCreature, gabaritDuHeros } from '../figures';
import { jauge, plaque, portrait, rond, rondMuet } from '../kit';
import { CADRES, CADRES_DE_L_HOTE, ajusterLaScene, echelleDeLaScene } from './ecran';
import { busteDuHeros, cadreA, esc, place } from './pieces';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

/** Les héros du groupe, pour les figurines et les portraits du rejeu. */
let roster: J.Heros[] = [];
let rejeu: { issue: IssueDuCombat; suite: string; i: number; vitesse: number; minuteur: number; fin: () => void } | null = null;
const VITESSES = [1, 2, 4];

function gabaritDuPion(q: PionDuPlateau) {
  if (q.camp === 'heros') {
    const h = roster.find((x) => x.c.id === q.id);
    if (h) return gabaritDuHeros(h.carriere, h.espece, h.c.weapons.map((w) => w.label));
    return gabaritDeCreature(q.creature ?? '');
  }
  return gabaritDeCreature(q.creature ?? '');
}

let cour: Cour | null = null;

/** La cour tient dans le champ que laissent la borne du round, l'ordre du tour et le socle ; elle couvre l'écran
 *  au-delà de son cadrage. */
export function mettreALEchelle() {
  const champ = document.querySelector<HTMLElement>('#combat .champ-rejeu');
  if (!champ || !cour) return;
  ajusterLaScene();
  const { x, y, largeur, hauteur } = cour.cadrage;
  const ks = echelleDeLaScene();
  const etroit = window.innerWidth < 900;
  const [g, h, b] = etroit ? [8, 60, 250] : [170 * ks, 90 * ks, 170 * ks];
  const l = window.innerWidth - 2 * g;
  const H = window.innerHeight - h - b;
  const k = Math.min(l / largeur, H / hauteur);
  const ox = g + (l - largeur * k) / 2;
  const oy = h + (H - hauteur * k) / 2;
  champ.querySelector<HTMLElement>('.cour')!.style.transform = `translate(${ox}px, ${oy}px) scale(${k}) translate(${-x}px, ${-y}px)`;
}

/** Ouvre le rejeu de `issue` ; `suite` dit ce que l'issue laisse (butin, morts), sous sa bannière ; `fin` rend la main. */
export function ouvrirLeRejeu(issue: IssueDuCombat, suite: string, fin: () => void, terrain: string, heros: J.Heros[]) {
  roster = heros;
  const scene = $('#combat');
  scene.hidden = false;
  cour = dessinerLaCour(issue.largeur, issue.hauteur, terrain);
  scene.innerHTML = `<div class="ecran-plein rejeu" role="dialog" aria-label="Combat">
    <div class="champ-rejeu" aria-hidden="true"><div class="cour" style="width:${cour.largeur}px;height:${cour.hauteur}px">${cour.svg}<div class="figures"></div></div></div>
    <div class="scene-fixe">
      ${cadreA(CADRES.round, '<div class="n gothique" id="round-n"></div><div class="t rubrique" id="round-t"></div>', { fond: '', classe: 'borne-round' })}
      <div class="ordre-rejeu" ${place(CADRES.ordre)} aria-label="Ordre du tour"></div>
      <div class="journal-rejeu" ${place(CADRES.journal)}><div class="tete rubrique ombre">Journal ${rondMuet('livre', 'Le journal entier', 'data-j aria-pressed="false"', 'petit')}</div><ol class="journal"></ol></div>
      ${cadreA(CADRES['journal-entier'], '<ol class="journal"></ol>', { ruban: 'Journal', classe: 'journal-entier' })}
      ${cadreA(CADRES.socle, '<div class="barre-actif"></div>', { fond: '', classe: 'socle-compagnie barre-rejeu' })}
      <div class="fin-rejeu" ${place(CADRES['fin-du-tour'])}>${rond('sablier', 'Passer', 'data-v="0"')}</div>
      <div class="vitesse-rejeu" ${place(CADRES_DE_L_HOTE['vitesse-du-rejeu'])}>${rond('etoile', '×1', 'data-v="vitesse"', 'moyen')}</div>
      <div class="issue-rejeu" ${place(CADRES.issue)}></div>
    </div>
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
  // LDB 21 l.19-20 (Animosité)
  if (allie && c.genre !== 'spell') {
    flotter(de, 'Animosité !', 'querelle');
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
    if (c.touche && allie) {
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
  const parId = new Map(p.pions.map((q) => [q.id, q]));
  const ordre = p.ordre.map((id) => parId.get(id)).filter((q): q is PionDuPlateau => !!q);
  const debout = ordre.filter((q) => !q.hors);
  const rang = Math.max(0, ordre.findIndex((q) => q.id === p.actif));
  $('#round-n').textContent = `Round ${p.round}`;
  $('#round-t').innerHTML = actif ? `tour ${debout.indexOf(actif) + 1}<br>sur ${debout.length}` : 'le round<br>débute';
  const suivants = ordre.slice(rang + 1);
  $('#combat .ordre-rejeu').innerHTML = [
    ...(actif ? [rangDe(actif, 'actif')] : []),
    ...suivants.map((q) => rangDe(q, q.hors ? 'hors' : '')),
    `<div class="borne"><span class="disque fer petit"><span>${p.round + 1}</span></span><span class="rubrique ombre">Round ${p.round + 1}</span><i></i></div>`,
    ...debout.slice(0, debout.indexOf(actif!) + 1).map((q, k) => rangDe(q, k ? 'fantome loin' : 'fantome')),
  ].join('');
  $('#combat .barre-actif').innerHTML = actif ? barreDe(actif, p) : '';
  for (const j of document.querySelectorAll<HTMLElement>('#combat .journal')) {
    for (const l of p.lignes) {
      const li = document.createElement('li');
      li.textContent = l;
      if (/Victoire|Défaite/.test(l)) li.className = 'fort';
      else if (/CRITIQUE|hors de combat|s'effondre/.test(l)) li.className = 'rouge';
      j.append(li);
    }
    j.scrollTop = j.scrollHeight;
  }
}

const bustePion = (q: PionDuPlateau) => {
  const h = q.camp === 'heros' ? roster.find((x) => x.c.id === q.id) : undefined;
  return h ? busteDuHeros(h) : buste(gabaritDuPion(q), q.camp);
};

/** Un combattant de l'ordre du tour (`combattant` des maquettes) : l'actif en grand, les fantômes du round suivant. */
function rangDe(q: PionDuPlateau, classe: string): string {
  const fantome = classe.includes('fantome');
  return `<div class="rang ${q.camp === 'ennemi' ? 'ennemi' : ''} ${classe}">${portrait(bustePion(q), q.camp, classe === 'actif' ? 'moyen' : 'petit', classe === 'actif' ? 'choisi' : '')}
    <div class="qui"><div class="nom ${classe === 'actif' ? 'gothique' : 'rubrique'} ombre">${esc(q.label)}</div>${fantome ? '' : `<div class="ligne">${jauge(q.pv / Math.max(1, q.max))}<span class="pv ombre">${q.pv} / ${q.max}</span></div>`}</div></div>`;
}

/** La barre de l'actif : ses Blessures à gauche, son portrait au centre, ce qu'il fait à droite. */
function barreDe(q: PionDuPlateau, p: Pas): string {
  return `<div class="mesure-actif"><div class="tete rubrique"><span>Blessures</span><b>${q.pv} / ${q.max}</b></div>${jauge(q.pv / Math.max(1, q.max), { taille: 'forte' })}</div>
    <div class="portrait-actif">${portrait(bustePion(q), q.camp, 'grand', 'choisi')}<div class="nom-propre gothique">${esc(q.label)}</div>${q.arme ? `<div class="sous-titre">${esc(q.arme)}</div>` : ''}</div>
    <div class="action-actif"><div class="rubrique">${q.camp === 'heros' ? 'Au tour du héros' : 'Tour adverse'}</div>${p.lignes.slice(0, 2).map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
}

function terminerLeRejeu() {
  const place = $('#combat .issue-rejeu');
  if (!place || place.innerHTML || !rejeu) return;
  const victoire = rejeu.issue.issue === 'victoire';
  place.innerHTML = `<div class="banniere-issue ${victoire ? 'victoire' : 'defaite'}"><span class="gothique">${victoire ? 'Victoire' : rejeu.issue.issue === 'defaite' ? 'Déroute' : 'Le combat s’enlise'}</span></div>
    <p class="suite-issue ombre">${esc(rejeu.suite)}</p>${plaque('Continuer', 'id="combat-fin"', { armee: true, taille: 'appel' })}`;
  document.querySelector('#combat .fin-rejeu')?.classList.add('ferme');
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
  if (!$('#combat .issue-rejeu').innerHTML) return passer();
  clearTimeout(rejeu.minuteur);
  const fin = rejeu.fin;
  rejeu = null;
  $('#combat').hidden = true;
  fin();
}

/** Les clics propres au rejeu (vitesse, « Passer », fin, journal entier) ; vrai s'il en a traité un. */
export function cliquerDansLeRejeu(cible: Element): boolean {
  const v = cible.closest<HTMLElement>('[data-v]');
  if (v && rejeu) {
    if (v.dataset.v === 'vitesse') {
      rejeu.vitesse = VITESSES[(VITESSES.indexOf(rejeu.vitesse) + 1) % VITESSES.length];
      v.querySelector('.libelle')!.textContent = `×${rejeu.vitesse}`;
      planifier();
      return true;
    }
    if (v.dataset.v === '0') passer();
    return true;
  }
  if (cible.closest('#combat-fin')) { fermerLeRejeu(); return true; }
  const j = cible.closest<HTMLElement>('[data-j]');
  if (j) {
    const ouvert = $('#combat .rejeu').classList.toggle('journal-ouvert');
    j.setAttribute('aria-pressed', String(ouvert));
    const liste = $('#combat .journal-entier .journal');
    liste.scrollTop = liste.scrollHeight;
    return true;
  }
  return false;
}

/** Un rejeu est-il ouvert ? */
export const rejeuOuvert = (): boolean => rejeu !== null;
