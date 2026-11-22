/**
 * L'interface du hameau de Grisefosse : DOM nu, un rendu complet par geste, délégation des clics par `data-a`.
 * Le combat se rejoue pas à pas depuis les relevés du noyau (`IssueDuCombat.pas`).
 */
import * as J from './jeu';
import { carac, coutDAugmentation, libelleDeCarac, libelleDEtat, nomDeCreature, type IssueDuCombat, type Pas, type Combatant } from './combat';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let etat: J.Etat = J.charger() ?? J.nouvellePartie(Date.now() % 100000);
let modale: { type: 'depart'; dest: string; choix: Set<string> } | { type: 'entrainer'; id: string } | { type: 'recit'; recit: J.RecitDeSalle } | { type: 'reset' } | null = null;
let congediement: string | null = null;

function toast(msg: string | null) {
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout((t as unknown as { _h: number })._h);
  (t as unknown as { _h: number })._h = window.setTimeout(() => (t.hidden = true), 2600);
}

function agir(f: () => string | null | void) {
  const err = f();
  J.sauver(etat);
  rendre();
  if (err) toast(err);
}

// ─── Morceaux ───────────────────────────────────────────────────────────────────────────────────────────────

const STATS = ['capacite-de-combat', 'force', 'endurance', 'initiative', 'agilite', 'force-mentale'] as const;

function barre(cur: number, max: number, cls = '') {
  const p = Math.max(0, Math.min(100, (100 * cur) / Math.max(1, max)));
  return `<div class="barre ${cls}" role="meter" aria-valuenow="${cur}" aria-valuemax="${max}"><i style="width:${p}%"></i><span>${cur}/${max} PB</span></div>`;
}

function etats(c: Combatant) {
  return c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etat">${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '';
}

function initiales(nom: string) {
  return nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
}

function carteHeros(h: J.Heros, mode: 'hameau' | 'expedition') {
  const c = h.c;
  const prix = J.prixDuSoin(etat);
  const hors = !J.valide(h);
  const actions = mode === 'hameau' ? `<div class="actions">
      ${J.blesse(h) && prix != null ? `<button data-a="soigner" data-id="${c.id}">Soigner${prix ? ` · ${prix} CO` : ''}</button>` : ''}
      <button data-a="entrainer" data-id="${c.id}"${etat.batiments.salle ? '' : ' disabled title="Bâtissez la Salle d’armes"'}>Entraîner</button>
      ${congediement === c.id
        ? `<button class="danger" data-a="congedier-ok" data-id="${c.id}">Confirmer le renvoi</button><button data-a="congedier-non">Garder</button>`
        : `<button class="discret" data-a="congedier" data-id="${c.id}">Renvoyer</button>`}
    </div>` : '';
  return `<article class="heros${hors ? ' hors' : ''}">
    <header><div class="blason" aria-hidden="true">${esc(initiales(c.label))}</div><div><h3>${esc(c.label)}</h3><p class="sous">${esc(J.nomDeCarriere(h.carriere))} · ${esc(J.nomDEspece(h.espece))}</p></div>
    <div class="destin" title="Points de Destin"><b>${c.fate ?? 0}</b><small>Destin</small></div></header>
    ${barre(Math.max(0, c.wounds.current), c.wounds.max, hors ? 'rouge' : '')}
    <dl class="stats">${STATS.map((k) => `<div><dt title="${esc(libelleDeCarac(k).label)}">${esc(libelleDeCarac(k).abr)}</dt><dd>${carac(c, k)}</dd></div>`).join('')}</dl>
    ${etats(c)}
    <p class="meta"><span>${c.xp ?? 0} PX</span><span>${h.expeditions} expédition${h.expeditions > 1 ? 's' : ''}</span><span>${esc(c.weapons.map((w) => w.label).join(', ') || 'mains nues')}</span></p>
    ${actions}
  </article>`;
}

function niveaux(n: number, max: number) {
  return `<span class="niveaux" aria-label="Niveau ${n} sur ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'plein' : ''}"></i>`).join('')}</span>`;
}

function carteBatiment(b: J.Batiment) {
  const n = etat.batiments[b.id];
  const suivant = b.paliers[n + 1];
  const peut = suivant && etat.or >= suivant.cout && etat.trophees >= suivant.trophees;
  return `<article class="batiment">
    <header><h3>${esc(b.nom)}</h3>${niveaux(n, b.paliers.length - 1)}</header>
    <p class="role">${esc(b.role)}</p>
    <p class="effet">${esc(b.paliers[n].effet)}</p>
    ${suivant ? `<button data-a="ameliorer" data-id="${b.id}"${peut ? '' : ' class="pauvre"'}>
        <span>${esc(suivant.effet)}</span><b>${suivant.cout} CO${suivant.trophees ? ` · ${suivant.trophees} trophée${suivant.trophees > 1 ? 's' : ''}` : ''}</b></button>`
      : '<p class="complet">Achevé</p>'}
  </article>`;
}

function carteCandidat(c: J.Candidat, i: number) {
  const gratuit = J.rosterVide(etat) && etat.or < c.prix;
  return `<article class="candidat">
    <div class="blason petit" aria-hidden="true">${esc(initiales(c.c.label))}</div>
    <div class="qui"><h3>${esc(c.c.label)}</h3><p class="sous">${esc(J.nomDeCarriere(c.carriere))} · ${esc(J.nomDEspece(c.espece))} · ${c.c.wounds.max} PB · CC ${carac(c.c, 'capacite-de-combat')}</p></div>
    <button data-a="recruter" data-i="${i}">${gratuit ? 'Sans solde' : `${c.prix} CO`}</button>
  </article>`;
}

function carteDestination(d: J.Destination) {
  const vaincu = etat.bossVaincus.includes(d.id);
  return `<article class="destination${vaincu ? ' vaincue' : ''}">
    <h3>${esc(d.nom)}</h3>
    <p>${esc(d.recit)}</p>
    <p class="sous">${d.salles} salles · maître : ${esc(d.boss.map(nomDeCreature).join(' et '))}${vaincu ? ' · déjà vaincu' : ''}</p>
    <button class="principal" data-a="preparer" data-id="${d.id}">Préparer l’expédition</button>
  </article>`;
}

// ─── Vues ───────────────────────────────────────────────────────────────────────────────────────────────────

function vueHameau() {
  const fermees = J.DESTINATIONS.filter((d) => d.palier > etat.batiments.cartographe);
  return `
  ${J.victoireFinale(etat) ? '<section class="bandeau">L’Autel du Chaos est tombé. Grisefosse respire. La compagnie peut continuer à battre la campagne.</section>' : ''}
  <section class="bloc">
    <h2>Partir</h2>
    <div class="grille destinations">${J.destinationsOuvertes(etat).map(carteDestination).join('')}
      ${fermees.length ? `<article class="destination fermee"><h3>${fermees.length} destination${fermees.length > 1 ? 's' : ''} encore inconnue${fermees.length > 1 ? 's' : ''}</h3><p>Le Cartographe ouvrira la route vers ${esc(fermees[0].nom)}.</p></article>` : ''}
    </div>
  </section>
  <section class="bloc">
    <h2>La compagnie <small>${etat.roster.length} héros</small><button class="discret repos" data-a="reposer">Se reposer un jour</button></h2>
    ${etat.roster.length ? `<div class="grille heros-liste">${etat.roster.map((h) => carteHeros(h, 'hameau')).join('')}</div>` : '<p class="vide">Personne. Recrutez au relais : quand la bourse est vide, un voyageur sert sans solde.</p>'}
  </section>
  <div class="deux">
    <section class="bloc">
      <h2>Au relais de diligence</h2>
      <div class="liste">${etat.candidats.map(carteCandidat).join('') || '<p class="vide">Personne au relais. Revenez après la prochaine expédition.</p>'}</div>
    </section>
    <section class="bloc">
      <h2>Chronique</h2>
      <ol class="chronique">${etat.journal.slice(0, 8).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    </section>
  </div>
  <section class="bloc">
    <h2>Le hameau</h2>
    <div class="grille batiments">${J.BATIMENTS.map(carteBatiment).join('')}</div>
  </section>
  ${etat.cimetiere.length ? `<section class="bloc"><h2>Jardin de Morr <small>${etat.cimetiere.length} tombe${etat.cimetiere.length > 1 ? 's' : ''}</small></h2>
    <ul class="tombes">${etat.cimetiere.map((t) => `<li><b>${esc(t.nom)}</b> ${esc(J.nomDeCarriere(t.carriere))}, tombé·e à ${esc(t.ou)}, jour ${t.semaine}</li>`).join('')}</ul></section>` : ''}
  <p class="pied"><button class="discret" data-a="reset">Recommencer une partie</button></p>`;
}

const NOM_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'Embuscade', elite: 'Élite', camp: 'Camp', tresor: 'Cache', boss: 'Maître' };

function vueExpedition() {
  const x = etat.expedition!;
  const d = J.destinationCourante(etat)!;
  const salle = x.salles[x.index];
  const groupe = J.herosDuGroupe(etat);
  const valides = groupe.filter(J.valide).length;
  const annonce = salle.type === 'camp' || salle.type === 'tresor'
    ? (salle.type === 'camp' ? 'Un abri se devine entre les arbres.' : 'Des pierres semblent avoir été déplacées.')
    : `Devant : ${salle.ennemis.map(nomDeCreature).join(', ')}.`;
  return `
  <section class="bloc expe">
    <h2>${esc(d.nom)}</h2>
    <ol class="piste">${x.salles.map((s, i) => `<li class="${s.type}${s.faite ? ' faite' : ''}${i === x.index ? ' ici' : ''}"><span>${NOM_DE_SALLE[s.type]}</span></li>`).join('')}</ol>
    <div class="butin"><span><b>${x.or}</b> CO</span><span><b>${x.trophees}</b> trophée${x.trophees > 1 ? 's' : ''}</span><span><b>${x.px}</b> PX par héros</span></div>
    <div class="salle">
      <h3>Salle ${x.index + 1} sur ${x.salles.length} · ${NOM_DE_SALLE[salle.type]}</h3>
      <p>${esc(annonce)}</p>
      <div class="actions">
        <button class="principal" data-a="avancer"${valides ? '' : ' disabled'}>${salle.type === 'boss' ? 'Affronter le maître des lieux' : salle.type === 'camp' ? 'Camper' : salle.type === 'tresor' ? 'Fouiller' : 'Engager le combat'}</button>
        <button data-a="rentrer">Rentrer au hameau avec le butin</button>
      </div>
      ${valides < groupe.length ? `<p class="sous">${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.</p>` : ''}
    </div>
  </section>
  <section class="bloc"><h2>Le groupe</h2><div class="grille heros-liste">${groupe.map((h) => carteHeros(h, 'expedition')).join('')}</div></section>`;
}

function vueModale(): string {
  if (!modale) return '';
  if (modale.type === 'depart') {
    const m = modale;
    const d = J.DESTINATIONS.find((x) => x.id === m.dest)!;
    return `<div class="modale" role="dialog" aria-modal="true" aria-labelledby="m-titre"><div class="boite">
      <h2 id="m-titre">${esc(d.nom)}</h2><p>Choisissez jusqu’à quatre héros. Les blessures ne guérissent qu’au camp et au hameau.</p>
      <div class="choix">${etat.roster.map((h) => {
        const ok = J.valide(h);
        return `<label class="${ok ? '' : 'hors'}"><input type="checkbox" id="pick-${h.c.id}" data-a="choisir" data-id="${h.c.id}"${m.choix.has(h.c.id) ? ' checked' : ''}${ok ? '' : ' disabled'}>
          <span><b>${esc(h.c.label)}</b> ${esc(J.nomDeCarriere(h.carriere))}</span>${barre(Math.max(0, h.c.wounds.current), h.c.wounds.max)}</label>`;
      }).join('') || '<p class="vide">Personne à envoyer.</p>'}</div>
      <div class="actions"><button class="principal" data-a="partir"${m.choix.size ? '' : ' disabled'}>Partir avec ${m.choix.size} héros</button><button data-a="fermer">Annuler</button></div>
    </div></div>`;
  }
  if (modale.type === 'entrainer') {
    const h = etat.roster.find((x) => x.c.id === (modale as { id: string }).id);
    if (!h) return '';
    const plafond = J.plafondDAugmentations(etat);
    return `<div class="modale" role="dialog" aria-modal="true" aria-labelledby="m-titre"><div class="boite">
      <h2 id="m-titre">Entraîner ${esc(h.c.label)}</h2><p>${h.c.xp ?? 0} PX à dépenser. Chaque Augmentation ajoute 1 à la Caractéristique ; hors de sa carrière, elle coûte le double. Plafond de la salle : ${plafond}.</p>
      <table class="entrainement"><thead><tr><th>Caractéristique</th><th>Valeur</th><th>Augm.</th><th></th></tr></thead><tbody>
      ${J.CARACS_ENTRAINABLES.map((k) => {
        const n = h.c.charAdvances?.[k] ?? 0;
        const cout = coutDAugmentation(h.c, k);
        const ok = n < plafond && (h.c.xp ?? 0) >= cout;
        return `<tr><td>${esc(libelleDeCarac(k).label)}</td><td>${carac(h.c, k)}</td><td>${n}/${plafond}</td><td><button data-a="augmenter" data-id="${h.c.id}" data-k="${k}"${ok ? '' : ' disabled'}>+1 · ${cout} PX</button></td></tr>`;
      }).join('')}</tbody></table>
      <div class="actions"><button data-a="fermer">Terminer</button></div>
    </div></div>`;
  }
  if (modale.type === 'reset') {
    return `<div class="modale" role="dialog" aria-modal="true"><div class="boite"><h2>Recommencer ?</h2><p>Le hameau, la compagnie et le Jardin de Morr seront effacés.</p>
      <div class="actions"><button class="danger" data-a="reset-ok">Tout effacer</button><button data-a="fermer">Garder ma partie</button></div></div></div>`;
  }
  const r = modale.recit;
  return `<div class="modale" role="dialog" aria-modal="true" aria-labelledby="m-titre"><div class="boite recit ${r.fin ?? ''}">
    <h2 id="m-titre">${esc(r.titre)}</h2>${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}
    <div class="actions">${r.combat ? '<button data-a="revoir">Revoir le combat</button>' : ''}<button class="principal" data-a="fermer">Continuer</button></div>
  </div></div>`;
}

function rendre() {
  const x = etat.expedition;
  $('#ressources').innerHTML = `<span>Jour <b>${etat.semaine}</b></span><span><b>${etat.or}</b> CO</span><span><b>${etat.trophees}</b> trophée${etat.trophees > 1 ? 's' : ''}</span>`;
  $('#vue').innerHTML = x ? vueExpedition() : vueHameau();
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
    <header><h2>Combat</h2><span id="round">Round 1</span>
      <div class="vitesse" role="group" aria-label="Vitesse">${[1, 2, 4].map((v) => `<button data-v="${v}" class="${v === 1 ? 'actif' : ''}">×${v}</button>`).join('')}<button data-v="0">Passer</button></div></header>
    <div class="arene-corps"><div class="arene-zone"><div class="arene" style="--w:${issue.largeur};--h:${issue.hauteur}">${cases}<div class="pions"></div></div></div>
      <div class="effectifs"><h3>Compagnie</h3><ul data-camp="heros"></ul><h3>Adversaires</h3><ul data-camp="ennemi"></ul></div></div>
    <ol class="journal" aria-live="polite"></ol>
    <footer><button class="principal" id="combat-fin" hidden>Voir l’issue</button></footer>
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

function poserLePas(p: Pas, avant: Pas | null) {
  const zone = $('#combat .pions');
  const anciens = new Map((avant?.pions ?? []).map((q) => [q.id, q]));
  for (const q of p.pions) {
    let el = zone.querySelector<HTMLElement>(`[data-id="${CSS.escape(q.id)}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = q.id;
      el.className = `pion camp-${q.camp}`;
      el.innerHTML = `<b>${esc(initiales(q.label))}</b><span class="pv"><i></i></span>`;
      el.title = q.label;
      zone.append(el);
    }
    el.style.setProperty('--x', String(q.x));
    el.style.setProperty('--n', String(q.cases));
    el.style.setProperty('--y', String(q.y));
    el.classList.toggle('hors', q.hors);
    (el.querySelector('.pv i') as HTMLElement).style.width = `${(100 * q.pv) / Math.max(1, q.max)}%`;
    const a = anciens.get(q.id);
    if (a && a.pv !== q.pv) {
      const delta = q.pv - a.pv;
      const f = document.createElement('span');
      f.className = `degat ${delta < 0 ? 'perte' : 'gain'}`;
      f.textContent = delta < 0 ? String(delta) : `+${delta}`;
      el.append(f);
      el.classList.remove('touche'); void el.offsetWidth; el.classList.add('touche');
      setTimeout(() => f.remove(), 1100);
    }
  }
  for (const camp of ['heros', 'ennemi'] as const) {
    $(`#combat .effectifs [data-camp="${camp}"]`).innerHTML = p.pions.filter((q) => q.camp === camp).map((q) =>
      `<li class="${q.hors ? 'hors' : ''}"><span>${esc(q.label)}</span>${barre(q.pv, q.max, camp === 'ennemi' ? 'ennemie' : '')}</li>`).join('');
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
  const b = $('#combat-fin');
  if (b) { b.hidden = false; b.focus(); }
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
      document.querySelectorAll('#combat [data-v]').forEach((b) => b.classList.toggle('actif', b === v));
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
      const recit = J.avancer(etat);
      J.sauver(etat);
      const montrer = () => { modale = { type: 'recit', recit }; rendre(); };
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

$('#chargement').remove();
rendre();
