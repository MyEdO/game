/**
 * L'interface du hameau de Grisefosse, habillée du kit des maquettes (`./kit`, `kit.css`) : DOM nu, un rendu complet
 * par geste, délégation des clics par `data-a`. Le combat se rejoue pas à pas depuis les relevés du noyau.
 */
import * as J from './jeu';
import { carac, coutDAugmentation, libelleDeCarac, libelleDEtat, nomDeCreature, type IssueDuCombat, type Pas, type PionDuPlateau, type Combatant } from './combat';
import { BUSTES, cadre, jauge, medaillon, plaque, portrait, poserLesTextures } from './kit';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let etat: J.Etat = J.charger() ?? J.nouvellePartie(Date.now() % 100000);
let modale: { type: 'depart'; dest: string; choix: Set<string> } | { type: 'entrainer'; id: string } | { type: 'recit'; recit: J.RecitDeSalle; illustration?: string } | { type: 'reset' } | null = null;
let congediement: string | null = null;

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

// ─── Portraits ──────────────────────────────────────────────────────────────────────────────────────────────

const BUSTES_HUMAINS = ['bjorn', 'mira', 'aldric', 'greta', 'astrid', 'kirsten', 'sigrid', 'berta'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const busteDuHeros = (h: Pick<J.Heros, 'espece' | 'c'>) => (h.espece === 'humains-reiklander' ? BUSTES_HUMAINS[hash(h.c.label) % BUSTES_HUMAINS.length] : 'harbull');
const BUSTES_ENNEMIS: [RegExp, string][] = [[/gobelin|snotling/, 'gobelin'], [/orc|gor|ungor|minotaure|troll|chaos|mutant|bestigor/, 'orc'], [/brigand|cultiste|necromancien|chevalier|squelette|zombie|goule|vampire/, 'aldric']];
const busteDeCreature = (id = '') => BUSTES_ENNEMIS.find(([re]) => re.test(id))?.[1];

function busteDuPion(q: PionDuPlateau): string | undefined {
  if (q.camp === 'heros') {
    const h = etat.roster.find((x) => x.c.id === q.id);
    return h ? busteDuHeros(h) : undefined;
  }
  return busteDeCreature(q.creature);
}

// ─── Pièces ─────────────────────────────────────────────────────────────────────────────────────────────────

const STATS = ['capacite-de-combat', 'force', 'endurance', 'initiative', 'agilite', 'force-mentale'] as const;

const vie = (cur: number, max: number) =>
  `<div class="vie"><span class="rubrique">Blessures</span><span class="chiffres">${Math.max(0, cur)} / ${max}</span></div>${jauge(Math.max(0, cur) / Math.max(1, max), { taille: 'forte' })}`;

function etats(c: Combatant) {
  return c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etiquette rectangle cire">${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '';
}

function carteHeros(h: J.Heros, mode: 'hameau' | 'expedition') {
  const c = h.c;
  const prix = J.prixDuSoin(etat);
  const hors = !J.valide(h);
  const actions = mode === 'hameau' ? `<div class="gestes">
      ${J.blesse(h) && prix != null ? plaque('Soigner', `data-a="soigner" data-id="${c.id}"`, { icone: 'soin', prix: prix ? String(prix) : '', taille: 'petite', titre: prix ? `${prix} couronnes` : 'Gratuit' }) : ''}
      ${plaque('Entraîner', `data-a="entrainer" data-id="${c.id}"`, { icone: 'epee', taille: 'petite', fermee: !etat.batiments.salle, titre: etat.batiments.salle ? '' : 'Bâtissez la Salle d’armes' })}
      ${congediement === c.id
        ? `${plaque('Renvoyer', `data-a="congedier-ok" data-id="${c.id}"`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}`
        : `<button type="button" class="lien" data-a="congedier" data-id="${c.id}">Renvoyer</button>`}
    </div>` : '';
  return `<article class="heros-carte${hors ? ' hors' : ''}">
    <div class="tete-h">${portrait(busteDuHeros(h), 'heros', 'grand')}
      <div class="qui"><div class="nom-propre moyen gothique">${esc(c.label)}</div><div class="sous-titre">${esc(J.nomDeCarriere(h.carriere))} · ${esc(J.nomDEspece(h.espece))}</div>
      ${vie(c.wounds.current, c.wounds.max)}</div></div>
    <dl class="stats">${STATS.map((k) => `<div><dt class="rubrique" title="${esc(libelleDeCarac(k).label)}">${esc(libelleDeCarac(k).abr)}</dt><dd class="chiffres">${carac(c, k)}</dd></div>`).join('')}</dl>
    ${etats(c)}
    <p class="meta"><span class="etiquette pastille or">${c.xp ?? 0} PX</span><span class="etiquette pastille fer">Destin ${c.fate ?? 0}</span><span class="glose">${esc(c.weapons.map((w) => w.label).join(', ') || 'mains nues')}</span></p>
    ${actions}
  </article>`;
}

const PICTO_DU_BATIMENT: Record<J.IdBatiment, string> = { relais: 'chope', temple: 'soin', salle: 'epee', cartographe: 'carte', peage: 'pieces', memorial: 'croix' };

function carteBatiment(b: J.Batiment) {
  const n = etat.batiments[b.id];
  const suivant = b.paliers[n + 1];
  const peut = !!suivant && etat.or >= suivant.cout && etat.trophees >= suivant.trophees;
  const ruine = n === 0 && b.id !== 'relais' && b.id !== 'cartographe';
  return `<article class="batiment">
    <div class="tete-b">${medaillon(PICTO_DU_BATIMENT[b.id], 'grand', ruine)}
      <div><div class="nom-propre petit gothique">${esc(b.nom)}</div><div class="sous-titre">${esc(b.role)} · ${ruine ? 'en ruine' : `palier ${n + 1} sur ${b.paliers.length}`}</div></div></div>
    <p class="glose courante">${esc(b.paliers[n].effet)}</p>
    ${suivant ? `<div class="suite-b"><span class="sous-titre">Ensuite</span><p>${esc(suivant.effet)}</p><p class="cout">${suivant.cout} couronnes${suivant.trophees ? ` et ${suivant.trophees} trophée${suivant.trophees > 1 ? 's' : ''}` : ''}</p>${plaque('Bâtir', `data-a="ameliorer" data-id="${b.id}"`, { armee: peut, taille: 'petite' })}</div>` : '<p class="sous-titre acheve">Achevé</p>'}
  </article>`;
}

function carteCandidat(c: J.Candidat, i: number) {
  const gratuit = J.rosterVide(etat) && etat.or < c.prix;
  return `<article class="candidat">${portrait(busteDuHeros(c), 'heros', 'moyen')}
    <div class="qui"><div class="nom-propre petit gothique">${esc(c.c.label)}</div><div class="sous-titre">${esc(J.nomDeCarriere(c.carriere))} · ${esc(J.nomDEspece(c.espece))} · ${c.c.wounds.max} PB · CC ${carac(c.c, 'capacite-de-combat')}</div><div class="glose">${gratuit ? 'Servira sans solde' : `Solde : ${c.prix} couronnes`}</div></div>
    ${plaque('Engager', `data-a="recruter" data-i="${i}"`, { prix: gratuit ? '' : String(c.prix), taille: 'petite', armee: gratuit || etat.or >= c.prix })}
  </article>`;
}

function carteDestination(d: J.Destination) {
  const vaincu = etat.bossVaincus.includes(d.id);
  return cadre(`<div class="destination">
      <div class="nom-propre grand gothique">${esc(d.nom)}</div>
      <p class="glose courante">${esc(d.recit)}</p>
      <p class="sous-titre">${d.salles} salles · maître : ${esc(d.boss.map(nomDeCreature).join(' et '))}${vaincu ? ' · déjà purgée' : ''}</p>
      ${plaque('Préparer l’expédition', `data-a="preparer" data-id="${d.id}"`, { icone: 'route', armee: true })}
    </div>`, { classe: `carte-dest${vaincu ? ' vaincue' : ''}` });
}

// ─── Vues ───────────────────────────────────────────────────────────────────────────────────────────────────

function vueHameau() {
  const fermees = J.DESTINATIONS.filter((d) => d.palier > etat.batiments.cartographe);
  return `
  ${J.victoireFinale(etat) ? `<div class="issue-finale"><span class="gothique">L’Autel du Chaos est tombé</span><p class="glose">Grisefosse respire. La compagnie peut continuer à battre la campagne.</p></div>` : ''}
  <div class="rangee destinations">${J.destinationsOuvertes(etat).map(carteDestination).join('')}
    ${fermees.length ? cadre(`<div class="destination fermee">${medaillon('carte', 'moyen', true)}<p class="glose courante">${fermees.length} destination${fermees.length > 1 ? 's' : ''} encore inconnue${fermees.length > 1 ? 's' : ''}. Le Cartographe ouvrira la route vers ${esc(fermees[0].nom)}.</p></div>`, { classe: 'carte-dest' }) : ''}
  </div>
  ${cadre(`<div class="barre-compagnie"><span class="sous-titre">${etat.roster.length} héros</span><button type="button" class="lien" data-a="reposer">Se reposer un jour</button></div>
    ${etat.roster.length ? `<div class="grille heros-liste">${etat.roster.map((h) => carteHeros(h, 'hameau')).join('')}</div>` : '<p class="glose courante vide">Personne. Engagez quelqu’un au relais : quand la bourse est vide, un voyageur sert sans solde.</p>'}`, { ruban: 'La compagnie' })}
  <div class="deux">
    ${cadre(`<div class="liste">${etat.candidats.map(carteCandidat).join('') || '<p class="glose courante vide">Personne au relais. Revenez après la prochaine expédition.</p>'}</div>`, { ruban: 'Au relais' })}
    ${cadre(`<ol class="chronique">${etat.journal.slice(0, 7).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`, { ruban: 'Chronique', fond: 'parchemin' })}
  </div>
  ${cadre(`<div class="grille batiments">${J.BATIMENTS.map(carteBatiment).join('')}</div>`, { ruban: 'Le hameau' })}
  ${etat.cimetiere.length ? cadre(`<ul class="tombes">${etat.cimetiere.map((t) => `<li><span class="gothique">${esc(t.nom)}</span> <span class="glose">${esc(J.nomDeCarriere(t.carriere))}, tombé·e à ${esc(t.ou)}, jour ${t.semaine}</span></li>`).join('')}</ul>`, { ruban: 'Jardin de Morr' }) : ''}
  <p class="pied"><button type="button" class="lien" data-a="reset">Recommencer une partie</button></p>`;
}

const NOM_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'Embuscade', elite: 'Élite', camp: 'Camp', tresor: 'Cache', boss: 'Maître' };
const PICTO_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'epee', elite: 'bouclier', camp: 'tente', tresor: 'bourse', boss: 'couronne' };

function vueExpedition() {
  const x = etat.expedition!;
  const salle = x.salles[x.index];
  const groupe = J.herosDuGroupe(etat);
  const valides = groupe.filter(J.valide).length;
  const annonce = salle.type === 'camp' ? 'Un abri se devine entre les arbres.'
    : salle.type === 'tresor' ? 'Des pierres semblent avoir été déplacées.'
    : `Devant : ${salle.ennemis.map(nomDeCreature).join(', ')}.`;
  const appel = salle.type === 'boss' ? 'Affronter le maître des lieux' : salle.type === 'camp' ? 'Camper' : salle.type === 'tresor' ? 'Fouiller' : 'Engager le combat';
  return `
  ${cadre(`<div class="expe">
    <div class="titre-expe"><span class="sous-titre">Butin de l’expédition</span><div class="butin"><span class="etiquette compte or">${x.or} CO</span><span class="etiquette compte or">${x.trophees} trophée${x.trophees > 1 ? 's' : ''}</span><span class="etiquette compte fer">${x.px} PX par héros</span></div></div>
    <ol class="piste">${x.salles.map((s, i) => `<li class="${s.faite ? 'faite' : ''}${i === x.index ? ' ici' : ''}">${medaillon(PICTO_DE_SALLE[s.type], i === x.index ? 'grand' : 'moyen', s.faite)}<span class="sous-titre">${NOM_DE_SALLE[s.type]}</span></li>`).join('')}</ol>
  </div>`, { ruban: `Salle ${x.index + 1} sur ${x.salles.length}` })}
  ${cadre(`<div class="salle"><div class="nom-propre grand gothique">${NOM_DE_SALLE[salle.type]}</div><p class="glose consigne">${esc(annonce)}</p>
    <div class="gestes">${plaque(appel, 'data-a="avancer"', { icone: PICTO_DE_SALLE[salle.type], armee: !!valides, fermee: !valides, taille: 'appel' })}${plaque('Rentrer au hameau avec le butin', 'data-a="rentrer"', { icone: 'route', taille: 'appel' })}</div>
    ${valides < groupe.length ? `<p class="glose avertissement">${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.</p>` : ''}</div>`, { fond: 'parchemin' })}
  ${cadre(`<div class="grille heros-liste">${groupe.map((h) => carteHeros(h, 'expedition')).join('')}</div>`, { ruban: 'Le groupe' })}`;
}

function vueModale(): string {
  if (!modale) return '';
  const boite = (titre: string, corps: string) => `<div class="modale" role="dialog" aria-modal="true" aria-label="${esc(titre)}">${cadre(corps, { ruban: esc(titre), fond: 'parchemin', classe: 'boite', balise: 'div' })}</div>`;
  if (modale.type === 'depart') {
    const m = modale;
    const d = J.DESTINATIONS.find((x) => x.id === m.dest)!;
    return boite(d.nom, `<p class="glose consigne">Choisissez jusqu’à quatre héros. Les blessures ne guérissent qu’au camp et au hameau.</p>
      <div class="choix">${etat.roster.map((h) => {
        const ok = J.valide(h);
        return `<label class="${ok ? '' : 'hors'}${m.choix.has(h.c.id) ? ' coche' : ''}"><input type="checkbox" id="pick-${h.c.id}" data-a="choisir" data-id="${h.c.id}"${m.choix.has(h.c.id) ? ' checked' : ''}${ok ? '' : ' disabled'}>
          ${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><b class="gothique">${esc(h.c.label)}</b><span class="sous">${esc(J.nomDeCarriere(h.carriere))} · ${Math.max(0, h.c.wounds.current)}/${h.c.wounds.max} PB</span></span></label>`;
      }).join('') || '<p class="glose">Personne à envoyer.</p>'}</div>
      <div class="gestes">${plaque(`Partir avec ${m.choix.size} héros`, 'data-a="partir"', { icone: 'route', armee: m.choix.size > 0, fermee: !m.choix.size })}${plaque('Annuler', 'data-a="fermer"')}</div>`);
  }
  if (modale.type === 'entrainer') {
    const h = etat.roster.find((x) => x.c.id === (modale as { id: string }).id);
    if (!h) return '';
    const plafond = J.plafondDAugmentations(etat);
    return boite(`Entraîner ${h.c.label}`, `<p class="glose consigne">${h.c.xp ?? 0} PX à dépenser. Chaque Augmentation ajoute 1 à la Caractéristique ; hors de la carrière, elle coûte le double. Plafond de la salle : ${plafond}.</p>
      <table class="entrainement"><thead><tr><th>Caractéristique</th><th>Valeur</th><th>Augm.</th><th>Coût en PX</th></tr></thead><tbody>
      ${J.CARACS_ENTRAINABLES.map((k) => {
        const n = h.c.charAdvances?.[k] ?? 0;
        const cout = coutDAugmentation(h.c, k);
        const ok = n < plafond && (h.c.xp ?? 0) >= cout;
        return `<tr><td>${esc(libelleDeCarac(k).label)}</td><td class="chiffres">${carac(h.c, k)}</td><td class="chiffres">${n}/${plafond}</td><td>${plaque('+1', `data-a="augmenter" data-id="${h.c.id}" data-k="${k}"`, { prix: String(cout), taille: 'petite', fermee: !ok })}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="gestes">${plaque('Terminer', 'data-a="fermer"')}</div>`);
  }
  if (modale.type === 'reset') {
    return boite('Recommencer ?', `<p class="glose consigne">Le hameau, la compagnie et le Jardin de Morr seront effacés.</p>
      <div class="gestes">${plaque('Tout effacer', 'data-a="reset-ok"', { armee: true })}${plaque('Garder ma partie', 'data-a="fermer"')}</div>`);
  }
  const r = modale.recit;
  return boite(r.titre, `${modale.illustration ? `<img class="illustration" src="${modale.illustration}" alt="">` : ''}<div class="recit ${r.fin ?? ''}">${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    <div class="gestes">${r.combat ? plaque('Revoir le combat', 'data-a="revoir"', { icone: 'oeil' }) : ''}${plaque('Continuer', 'data-a="fermer"', { armee: true })}</div>`);
}

function rendre() {
  const x = etat.expedition;
  const d = J.destinationCourante(etat);
  const bandeau = $('.bandeau');
  bandeau.classList.toggle('en-route', !!x);
  $('#titre').textContent = x && d ? d.nom : 'Grisefosse';
  $('#sous-titre').textContent = x && d ? d.recit : 'Compagnie franche du Reikland';
  $('#ressources').innerHTML = `<span class="etiquette compte fer">Jour ${etat.semaine}</span><span class="etiquette compte or">${etat.or} CO</span><span class="etiquette compte or">${etat.trophees} trophée${etat.trophees > 1 ? 's' : ''}</span>`;
  $('#vue').innerHTML = etat.expedition ? vueExpedition() : vueHameau();
  $('#modale').innerHTML = vueModale();
}

// ─── Rejeu du combat ────────────────────────────────────────────────────────────────────────────────────────

let rejeu: { issue: IssueDuCombat; i: number; vitesse: number; minuteur: number; fin: () => void } | null = null;
const DELAI = 520;

function ouvrirLeRejeu(issue: IssueDuCombat, fin: () => void) {
  const scene = $('#combat');
  scene.hidden = false;
  const cases = Array.from({ length: issue.largeur * issue.hauteur }, () => '<i></i>').join('');
  scene.innerHTML = `<div class="arene-cadre">
    <header><div class="titre gothique">Combat</div><span class="etiquette compte fer" id="round">Round 1</span>
      <div class="vitesse" role="group" aria-label="Vitesse">${[1, 2, 4].map((v) => `<button type="button" class="plaque petite laiton${v === 1 ? ' armee' : ''}" data-v="${v}"><div>×${v}</div></button>`).join('')}<button type="button" class="plaque petite laiton" data-v="0"><div>Passer</div></button></div></header>
    <div class="arene-corps">${cadre(`<div class="arene-zone"><div class="arene" style="--w:${issue.largeur};--h:${issue.hauteur}">${cases}<div class="pions"></div></div></div>`, { classe: 'plateau', balise: 'div' })}
      ${cadre(`<div class="effectifs"><div class="sous-titre">Compagnie</div><ul data-camp="heros"></ul><div class="sous-titre">Adversaires</div><ul data-camp="ennemi"></ul></div>`, { balise: 'div', classe: 'panneau-eff' })}</div>
    ${cadre('<ol class="journal" aria-live="polite"></ol>', { fond: 'parchemin', balise: 'div', classe: 'panneau-journal' })}
    <footer id="combat-fin-place"></footer>
  </div>`;
  rejeu = { issue, i: 0, vitesse: 1, minuteur: 0, fin };
  poserLePas(issue.pas[0], null);
  planifier();
}

function planifier() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  if (rejeu.i >= rejeu.issue.pas.length - 1) return terminerLeRejeu();
  rejeu.minuteur = window.setTimeout(() => {
    if (!rejeu) return;
    rejeu.i++;
    poserLePas(rejeu.issue.pas[rejeu.i], rejeu.issue.pas[rejeu.i - 1]);
    planifier();
  }, DELAI / rejeu.vitesse);
}

function contenuDuPion(q: PionDuPlateau): string {
  const buste = busteDuPion(q);
  return buste ? `<svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${BUSTES[buste]}</svg>` : `<b class="gothique">${esc(q.label[0])}</b>`;
}

function poserLePas(p: Pas, avant: Pas | null) {
  const zone = $('#combat .pions');
  const anciens = new Map((avant?.pions ?? []).map((q) => [q.id, q]));
  for (const q of p.pions) {
    let el = zone.querySelector<HTMLElement>(`[data-id="${CSS.escape(q.id)}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = q.id;
      el.className = `pion camp-${q.camp}`;
      el.innerHTML = `<div class="disque">${contenuDuPion(q)}</div><span class="pv"><i></i></span>`;
      el.title = q.label;
      zone.append(el);
    }
    el.style.setProperty('--x', String(q.x));
    el.style.setProperty('--y', String(q.y));
    el.style.setProperty('--n', String(q.cases));
    el.classList.toggle('hors', q.hors);
    (el.querySelector('.pv i') as HTMLElement).style.width = `${(100 * q.pv) / Math.max(1, q.max)}%`;
    const a = anciens.get(q.id);
    if (a && a.pv !== q.pv) {
      const delta = q.pv - a.pv;
      const f = document.createElement('span');
      f.className = `degat chiffres ${delta < 0 ? 'perte' : 'gain'}`;
      f.textContent = delta < 0 ? String(delta) : `+${delta}`;
      el.append(f);
      el.classList.remove('touche'); void el.offsetWidth; el.classList.add('touche');
      setTimeout(() => f.remove(), 1100);
    }
  }
  for (const camp of ['heros', 'ennemi'] as const) {
    $(`#combat .effectifs [data-camp="${camp}"]`).innerHTML = p.pions.filter((q) => q.camp === camp).map((q) => {
      const buste = busteDuPion(q);
      return `<li class="rang ${camp}${q.hors ? ' hors' : ''}">${buste ? portrait(buste, camp, 'petit') : `<div class="portrait fer ennemi petit"><div class="initiale gothique">${esc(q.label[0])}</div></div>`}
        <div class="qui"><div class="nom">${esc(q.label)}${q.hors ? ' <span class="glose">hors de combat</span>' : ''}</div>${jauge(q.pv / Math.max(1, q.max))}<span class="chiffres pv-t">${q.pv} / ${q.max}</span></div></li>`;
    }).join('');
  }
  $('#round').textContent = `Round ${p.round}`;
  const j = $('#combat .journal');
  for (const l of p.lignes) {
    const li = document.createElement('li');
    li.textContent = l;
    if (/Victoire|Défaite/.test(l)) li.className = 'fort';
    else if (/CRITIQUE|hors de combat|s'effondre/.test(l)) li.className = 'rouge';
    j.append(li);
  }
  j.scrollTop = j.scrollHeight;
}

function terminerLeRejeu() {
  const place = $('#combat-fin-place');
  if (place && !place.innerHTML) {
    place.innerHTML = plaque('Voir l’issue', 'id="combat-fin"', { armee: true, taille: 'appel' });
    $('#combat-fin').focus();
  }
}

function fermerLeRejeu() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  const fin = rejeu.fin;
  rejeu = null;
  $('#combat').hidden = true;
  fin();
}

// ─── Gestes ─────────────────────────────────────────────────────────────────────────────────────────────────

document.addEventListener('click', (ev) => {
  const cible = ev.target as HTMLElement;
  const v = cible.closest<HTMLElement>('[data-v]');
  if (v && rejeu) {
    const n = Number(v.dataset.v);
    if (n === 0) {
      clearTimeout(rejeu.minuteur);
      for (let i = rejeu.i + 1; i < rejeu.issue.pas.length; i++) poserLePas(rejeu.issue.pas[i], rejeu.issue.pas[i - 1]);
      rejeu.i = rejeu.issue.pas.length - 1;
      terminerLeRejeu();
    } else {
      rejeu.vitesse = n;
      document.querySelectorAll('#combat [data-v]').forEach((b) => b.classList.toggle('armee', b === v));
      planifier();
    }
    return;
  }
  if (cible.closest('#combat-fin')) return fermerLeRejeu();
  const el = cible.closest<HTMLElement>('[data-a]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const { a, id = '', i, k } = el.dataset;
  switch (a) {
    case 'ameliorer': return agir(() => J.ameliorer(etat, id as J.IdBatiment));
    case 'recruter': return agir(() => J.recruter(etat, Number(i)));
    case 'soigner': return agir(() => J.soignerAuTemple(etat, id));
    case 'entrainer': modale = { type: 'entrainer', id }; return rendre();
    case 'augmenter': return agir(() => J.entrainer(etat, id, k as J.CharKey));
    case 'congedier': congediement = id; return rendre();
    case 'congedier-non': congediement = null; return rendre();
    case 'congedier-ok': congediement = null; return agir(() => J.congedier(etat, id));
    case 'preparer': modale = { type: 'depart', dest: id, choix: new Set(etat.roster.filter(J.valide).slice(0, 4).map((h) => h.c.id)) }; return rendre();
    case 'choisir': {
      if (modale?.type !== 'depart') return;
      const input = el as HTMLInputElement;
      if (input.checked && modale.choix.size >= 4) { input.checked = false; return toast('Quatre héros au plus.'); }
      if (input.checked) modale.choix.add(id); else modale.choix.delete(id);
      return rendre();
    }
    case 'partir': {
      if (modale?.type !== 'depart') return;
      const m = modale;
      modale = null;
      return agir(() => J.partir(etat, m.dest, [...m.choix]));
    }
    case 'avancer': {
      const camp = etat.expedition?.salles[etat.expedition.index].type === 'camp';
      const recit = J.avancer(etat);
      J.sauver(etat);
      const montrer = () => { modale = { type: 'recit', recit, ...(camp ? { illustration: 'bivouac.jpg' } : {}) }; rendre(); };
      if (recit.combat) { rendre(); ouvrirLeRejeu(recit.combat, montrer); } else montrer();
      return;
    }
    case 'revoir': {
      if (modale?.type !== 'recit' || !modale.recit.combat) return;
      const m = modale;
      modale = null; rendre();
      return ouvrirLeRejeu(m.recit.combat!, () => { modale = m; rendre(); });
    }
    case 'rentrer': {
      const lignes = J.rentrer(etat, false);
      J.sauver(etat);
      modale = { type: 'recit', recit: { titre: 'Retour au hameau', lignes } };
      return rendre();
    }
    case 'reposer': return agir(() => { J.seReposer(etat); toast('Un jour passe. Les blessés récupèrent, de nouveaux voyageurs attendent au relais.'); });
    case 'fermer': modale = null; return rendre();
    case 'reset': modale = { type: 'reset' }; return rendre();
    case 'reset-ok': J.effacer(); etat = J.nouvellePartie(Date.now() % 100000); modale = null; congediement = null; return agir(() => null);
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (rejeu) return fermerLeRejeu();
  if (modale && modale.type !== 'recit') { modale = null; rendre(); }
});

poserLesTextures();
$('#chargement').remove();
rendre();
