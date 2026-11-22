/**
 * L'interface de Grisefosse : l'état de l'interface (l'écran ouvert, le héros servi, la modale), le routage des gestes
 * par délégation des clics (`data-a`), et un rendu complet par geste. Les écrans vivent sous `./ui` : les lieux
 * (hameau, expédition), les services du hameau, la fiche du héros, le rejeu du combat, tous au gabarit commun
 * (`./ui/ecran`) et montés sur les pièces du kit (`./ui/pieces`).
 */
import * as J from './jeu';
import { DEGRADES_DES_FIGURINES } from './figures';
import { cadre, plaque, poserLesTextures } from './kit';
import { ajusterLaScene } from './ui/ecran';
import { ecranDeService } from './ui/services';
import { ajusterLesTableaux, ecranDeLExpedition, ecranDuHameau, tableau } from './ui/lieux';
import { ecranDuHeros, type Onglet } from './ui/fiche';
import { installerLesSurvols } from './ui/bulles';
import { cliquerDansLeRejeu, fermerLeRejeu, mettreALEchelle, ouvrirLeRejeu, rejeuOuvert } from './ui/rejeu';
import { esc } from './ui/pieces';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
type Panneau = { type: 'batiment'; id: J.IdBatiment } | { type: 'heros'; id: string; onglet: Onglet | null } | { type: 'depart'; dest: string; choix: Set<string> } | { type: 'chronique' };
let etat: J.Etat = J.charger() ?? J.nouvellePartie(Date.now() % 100000);
let panneau: Panneau | null = null;
let modale: { type: 'recit'; recit: J.RecitDeSalle; vignette?: J.Heros[]; terrain?: string } | { type: 'reset' } | null = null;
/** Le héros que servent la forge et le relais. */
let client: string | null = null;
let congediement: string | null = null;
let panoramaCentre = false;

function toast(msg: string | null) {
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(Number(t.dataset.h));
  t.dataset.h = String(window.setTimeout(() => (t.hidden = true), 2800));
}

function agir(f: () => string | null | void) {
  const err = f();
  J.sauver(etat);
  rendre();
  if (err) toast(err);
}

// ─── Portraits et tableaux ──────────────────────────────────────────────────────────────────────────────────

// ─── Pièces communes ────────────────────────────────────────────────────────────────────────────────────────

function pageOuverte(): string {
  if (!panneau) return '';
  if (panneau.type === 'heros') return ecranDuHeros({ e: etat, congediement }, panneau.id, panneau.onglet);
  const ctx = { e: etat, client, dest: panneau.type === 'depart' ? panneau.dest : null, choix: panneau.type === 'depart' ? panneau.choix : new Set<string>() };
  return ecranDeService(ctx, panneau.type === 'batiment' ? panneau.id : panneau.type);
}

// ─── Écrans ─────────────────────────────────────────────────────────────────────────────────────────────────

function vueModale(): string {
  if (!modale) return '';
  const boite = (titre: string, corps: string) => `<div class="modale" role="dialog" aria-modal="true" aria-label="${esc(titre)}">${cadre(corps, { ruban: esc(titre), fond: 'parchemin', classe: 'boite', balise: 'div' })}</div>`;
  if (modale.type === 'reset') {
    return boite('Recommencer ?', `<p class="glose consigne">Le hameau, la compagnie et le Jardin de Morr seront effacés.</p>
      <div class="gestes">${plaque('Tout effacer', 'data-a="reset-ok"', { armee: true })}${plaque('Garder ma partie', 'data-a="fermer"')}</div>`);
  }
  const r = modale.recit;
  return boite(r.titre, `${modale.vignette ? tableau(modale.terrain ?? 'reikwald', modale.vignette, 'illustration') : ''}<div class="recit ${r.fin ?? ''}">${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    <div class="gestes">${r.combat ? plaque('Revoir le combat', 'data-a="revoir"', { icone: 'oeil' }) : ''}${plaque('Continuer', 'data-a="fermer"', { armee: true })}</div>`);
}

function rendre() {
  const avant = document.querySelector<HTMLElement>('.panorama')?.scrollLeft;
  $('#jeu').innerHTML = etat.expedition ? ecranDeLExpedition(etat, pageOuverte()) : ecranDuHameau(etat, pageOuverte());
  $('#modale').innerHTML = vueModale();
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) {
    if (avant != null && panoramaCentre) pano.scrollLeft = avant;
    else { pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42; panoramaCentre = true; }
  }
  ajusterLesTableaux();
  ajusterLaScene();
}

// ─── Gestes ─────────────────────────────────────────────────────────────────────────────────────────────────

const basculer = (p: Panneau) => {
  const meme = !!panneau && panneau.type === p.type && (!('id' in p) || ('id' in panneau && panneau.id === p.id));
  panneau = meme ? null : p;
  congediement = null;
  rendre();
};

document.addEventListener('click', (ev) => {
  const cible = ev.target as Element;
  if (cliquerDansLeRejeu(cible)) return;
  const el = cible.closest<HTMLElement>('[data-a]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const { a, id = '', i, k } = el.dataset;
  switch (a) {
    case 'batiment': if (el.dataset.client) client = el.dataset.client; panneau = { type: 'batiment', id: id as J.IdBatiment }; congediement = null; return rendre();
    case 'heros': return basculer({ type: 'heros', id, onglet: (k as Onglet | undefined) ?? null });
    case 'onglet': if (panneau?.type === 'heros') panneau = { ...panneau, onglet: k as Onglet }; return rendre();
    case 'chronique': panneau = { type: 'chronique' }; return rendre();
    case 'ouvrir-depart': panneau = { type: 'batiment', id: 'cartographe' }; return rendre();
    case 'fermer-panneau': panneau = null; congediement = null; return rendre();
    case 'ameliorer': return agir(() => J.ameliorer(etat, id as J.IdBatiment));
    case 'recruter': return agir(() => J.recruter(etat, Number(i)));
    case 'soigner': return agir(() => J.soignerAuTemple(etat, id));
    case 'sequelle': return agir(() => J.guerirUneSequelle(etat, id));
    case 'hospice': return agir(() => J.confierALHospice(etat, id, k as J.ActeDHospice));
    case 'client': client = id; return rendre();
    case 'arme': return agir(() => J.acheterUneArme(etat, id, k!));
    case 'armure': return agir(() => J.acheterUneArmure(etat, id, k as J.PoidsDArmure));
    case 'provision': return agir(() => J.acheterUneProvision(etat, id, k!));
    case 'carac': return agir(() => J.acheter(etat, id, { genre: 'carac', id: k! }));
    case 'sort': return agir(() => J.acheter(etat, id, { genre: 'sort', id: k! }));
    case 'niveau': return agir(() => J.acheter(etat, id, { genre: 'niveau' }));
    case 'competence': case 'talent': {
      const h = etat.roster.find((x) => x.c.id === id);
      const o = h && J.offresDeCarriere(h);
      const ref = o && (a === 'competence' ? o.competences : o.talents)[Number(i)]?.ref;
      return ref ? agir(() => J.acheter(etat, id, { genre: a, ref })) : undefined;
    }
    case 'utiliser': { const ligne = J.utiliserUneProvision(etat, id, k!); J.sauver(etat); rendre(); return toast(ligne); }
    case 'prier': { const ligne = J.prier(etat, id, k!); J.sauver(etat); rendre(); return toast(ligne); }
    case 'congedier': congediement = id; return rendre();
    case 'congedier-non': congediement = null; return rendre();
    case 'congedier-ok': congediement = null; panneau = null; return agir(() => J.congedier(etat, id));
    case 'preparer': panneau = { type: 'depart', dest: id, choix: new Set(etat.roster.filter(J.disponible).slice(0, 4).map((h) => h.c.id)) }; return rendre();
    case 'choisir': {
      if (panneau?.type !== 'depart') return;
      if (panneau.choix.has(id)) panneau.choix.delete(id);
      else if (panneau.choix.size >= 4) return toast('Quatre héros au plus.');
      else panneau.choix.add(id);
      return rendre();
    }
    case 'partir': {
      if (panneau?.type !== 'depart') return;
      const p = panneau;
      panneau = null;
      return agir(() => J.partir(etat, p.dest, [...p.choix]));
    }
    case 'avancer': {
      panneau = null;
      const terrain = etat.expedition?.destination ?? 'reikwald';
      const camp = etat.expedition?.salles[etat.expedition.index].type === 'camp';
      const groupe = J.herosDuGroupe(etat);
      const recit = J.avancer(etat);
      J.sauver(etat);
      const montrer = () => { modale = { type: 'recit', recit, terrain, ...(camp ? { vignette: groupe } : {}) }; rendre(); };
      if (recit.combat) { rendre(); ouvrirLeRejeu(recit.combat, montrer, terrain, etat.roster); } else montrer();
      return;
    }
    case 'revoir': {
      if (modale?.type !== 'recit' || !modale.recit.combat) return;
      const m = modale;
      modale = null; rendre();
      return ouvrirLeRejeu(m.recit.combat!, () => { modale = m; rendre(); }, m.terrain ?? 'reikwald', etat.roster);
    }
    case 'rentrer': {
      panneau = null;
      const lignes = J.rentrer(etat, false);
      J.sauver(etat);
      modale = { type: 'recit', recit: { titre: 'Retour au hameau', lignes } };
      return rendre();
    }
    case 'attendre': return agir(() => J.attendreUneSemaine(etat));
    case 'fermer': modale = null; return rendre();
    case 'reset': modale = { type: 'reset' }; return rendre();
    case 'reset-ok': J.effacer(); etat = J.nouvellePartie(Date.now() % 100000); modale = null; panneau = null; congediement = null; return agir(() => null);
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (rejeuOuvert()) return fermerLeRejeu();
  if (modale?.type === 'reset') { modale = null; return rendre(); }
  if (panneau) { panneau = null; rendre(); }
});

window.addEventListener('resize', () => {
  mettreALEchelle();
  ajusterLesTableaux();
  ajusterLaScene();
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42;
});

installerLesSurvols();
document.body.insertAdjacentHTML('beforeend', DEGRADES_DES_FIGURINES);
poserLesTextures();
J.sauver(etat);
rendre();
