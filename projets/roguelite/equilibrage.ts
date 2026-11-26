// Équilibrage : joue des expéditions entières sous node, sans interface, avec une stratégie simple : recruter jusqu'à
// quatre héros en état de partir (l'engagement est gratuit), soigner, loger, bâtir
// dans `ORDRE_DES_BATIMENTS` sans entamer `RESERVE`, équiper (`equiper`), suivre le plan conseillé de carrière à chaque
// retour, apprendre sa voie (`apprendreLaVoie`), partir avec les plus avancés vers la destination la plus lointaine dont
// chacun a le niveau attendu (`attendu`), la première tant que le groupe n'est pas complet, avec des potions ; entre les
// salles, soigner chaque blessé par la Guérison du premier soigneur (`soignerLeGroupe`), prier et boire ; rentrer sous
// 2 héros valides ou après `rentrerApres` salles. L'état passe par JSON entre deux expéditions, comme une sauvegarde
// relue. Finit par l'économie des sorties (or gagné, or dépensé par poste), le jour où chaque bâtiment atteint chaque
// palier, le jour du premier départ vers chaque destination avec le niveau de carrière du groupe et le palier de la
// forge, face au groupe attendu (`attendu`), puis par destination les départs, les morts par sortie, le maître atteint
// et vaincu, la part des Blessures du groupe à l'entrée du maître et au retour et les soins de Guérison par sortie, enfin
// la part de chaque carrière parmi les candidats proposés et parmi les recrues engagées, par palier du relais.
// Usage : npx tsx projets/roguelite/equilibrage.ts <graine> <expéditions> [parties] [rentrerApres]
//         plusieurs parties : graines consécutives, sans journal, moyennes par sortie.
import { tableTotale } from '../../src/lib/tableTotale';
import * as J from './src/jeu';
import { poserLesReglesDuRoguelite } from './src/noyau';
import { apprendreLaVoie, attendu, equiper } from './balayage';

/** L'ordre où la stratégie bâtit, et l'or qu'elle garde pour soigner et loger après avoir bâti. */
const ORDRE_DES_BATIMENTS = ['salle', 'temple', 'peage', 'forge', 'relais', 'cartographe'] as const;
const RESERVE = 60;
/** Les postes de dépense d'une sortie, dans l'ordre où la stratégie les paie. */
const POSTES = ['soins', 'chambres', 'batiments', 'equipement'] as const;
type Poste = (typeof POSTES)[number];
/** Une sortie mesurée : son rang, son jour de retour, sa destination, l'or gagné au retour, l'or dépensé avant le
 *  départ par poste, la bourse au retour, les jours qu'elle a pris, les Blessures que l'hospice a rendues avant le
 *  départ et son palier. */
interface Sortie {
  rang: number; jour: number; destination: string; gagne: number; depense: Record<Poste, number>; or: number; jours: number; blessures: number; hospice: number;
  /** Les héros morts pendant la sortie ; la part des Blessures du groupe à l'entrée du maître (`null` s'il n'est pas
   *  atteint) et au retour ; le maître vaincu ; les soins de Guérison joués entre les salles. */
  morts: number; auMaitre: number | null; auRetour: number; vaincu: boolean; soins: number;
}
/** Entre deux salles, le premier soigneur du groupe soigne chaque blessé que le noyau lui confie (`soignerEnRoute`) :
 *  rend le nombre de soins joués. */
function soignerLeGroupe(e: J.Etat): number {
  const g = J.herosDuGroupe(e);
  const soigneur = g.find((h) => !J.refusDuSoigneur(e, h));
  return soigneur ? g.filter((h) => typeof J.soignerEnRoute(e, soigneur.c.id, h.c.id) !== 'string').length : 0;
}
/** La part des Blessures que portent encore les héros du `groupe`. */
const etatDu = (groupe: readonly J.Heros[]): number =>
  groupe.reduce((n, h) => n + h.c.wounds.current, 0) / Math.max(1, groupe.reduce((n, h) => n + h.c.wounds.max, 0));

/** Joue `parties` parties de `expeditions` expéditions, de la graine `graine0`, en rentrant après `rentrerApres`
 *  salles franchies au plus ; dit l'économie, les paliers du hameau et la part de chaque carrière. */
function equilibrer(graine0: number, expeditions: number, parties: number, rentrerApres: number): void {
  const log = parties > 1 ? () => {} : console.log;
  const proposes = new Map<string, number>(), engages = new Map<string, number>(), vus = new Set<string>();
  const compter = (m: Map<string, number>, cle: string) => m.set(cle, (m.get(cle) ?? 0) + 1);
  const sorties: Sortie[] = [];
  /** Le jour de chaque palier atteint, par bâtiment et par partie ; le premier départ vers chaque destination, par
   *  partie : son jour, le niveau moyen du groupe et le palier de la forge. */
  const paliers = new Map<string, number[]>(), departs = new Map<string, { jour: number; niveau: number; forge: number }[]>();
  /** En état de partir : valide, à 60 % de ses Blessures au moins ; les autres prennent une chambre. */
  const partant = (h: J.Heros) => J.valide(h) && h.c.wounds.current >= h.c.wounds.max * 0.6;
  const voir = (e: J.Etat) => { for (const c of e.candidats) if (!vus.has(c.c.id)) { vus.add(c.c.id); compter(proposes, `${e.batiments.relais}|${c.carriere}`); } };
  for (let partie = 0; partie < parties; partie++) {
    let e = J.nouvellePartie(graine0 + partie);
    const atteints = new Set<string>(), partiesVers = new Set<string>();
    for (let exp = 0; exp < expeditions; exp++) {
      e = JSON.parse(JSON.stringify(e)) as J.Etat; // la sauvegarde relue entre deux expéditions
      const depense = tableTotale(POSTES, () => 0);
      /** Paie `geste` au poste `poste` : ce qu'il ôte à la bourse. */
      const payer = (poste: Poste, geste: () => void) => { const avant = e.or; geste(); depense[poste] += avant - e.or; };
      voir(e);
      while (e.candidats.length && e.roster.filter(partant).length < J.TAILLE_DU_GROUPE) { const c = e.candidats[0]; if (J.recruter(e, 0)) break; compter(engages, `${e.batiments.relais}|${c.carriere}`); }
      let blessures = 0;
      payer('soins', () => { for (const h of e.roster) { const avant = h.c.wounds.current; if (J.blesse(h) && !J.soignerAuTemple(e, h.c.id)) blessures += h.c.wounds.current - avant; } });
      payer('chambres', () => { for (const h of e.roster) if (!partant(h)) J.prendreUneChambre(e, h.c.id); });
      payer('batiments', () => { for (const b of ORDRE_DES_BATIMENTS) if ((J.palierSuivant(e, b)?.cout ?? Infinity) + RESERVE <= e.or) J.ameliorer(e, b); });
      for (const [b, palier] of Object.entries(e.batiments)) {
        const cle = `${b}|${palier}`;
        if (palier && !atteints.has(cle)) { atteints.add(cle); paliers.set(cle, [...(paliers.get(cle) ?? []), e.jour]); }
      }
      voir(e);
      payer('equipement', () => {
        for (const h of e.roster) {
          equiper(e, h);
          if (!J.provisionsPortees(h).length && J.provisionsEnVente(e).some((a) => a.id === 'potion-de-guerison')) J.acheterUneProvision(e, h.c.id, 'potion-de-guerison');
        }
      });
      for (const h of e.roster) {
        while (J.suivreLePlan(e, h.c.id).achats.some((a) => a.genre === 'niveau'));
        apprendreLaVoie(e, h);
      }
      const prets = e.roster.filter((h) => J.disponible(h) && partant(h));
      const groupe = (prets.length ? prets : e.roster.filter((h) => J.disponible(h) && h.c.wounds.current * 2 >= h.c.wounds.max)).sort((a, b) => (b.c.careerLevel ?? 1) - (a.c.careerLevel ?? 1)).slice(0, J.TAILLE_DU_GROUPE);
      const niveau = groupe.length < J.TAILLE_DU_GROUPE ? 1 : Math.min(...groupe.map((h) => h.c.careerLevel ?? 1));
      const ouvertes = J.destinationsOuvertes(e);
      const dest = ouvertes.filter((d) => attendu(d.palier).niveau <= niveau).pop() ?? ouvertes[0];
      const err = J.partir(e, dest.id, groupe.map((h) => h.c.id));
      if (err) { log('départ refusé', err, e.roster.length, e.or, J.attendreUneSemaine(e) ?? 'la compagnie attend une semaine'); continue; }
      if (!partiesVers.has(dest.id)) {
        partiesVers.add(dest.id);
        departs.set(dest.id, [...(departs.get(dest.id) ?? []), { jour: e.jour, niveau: groupe.reduce((n, h) => n + (h.c.careerLevel ?? 1), 0) / groupe.length, forge: e.batiments.forge }]);
      }
      const orAuDepart = e.or, jourAuDepart = e.jour;
      let auMaitre: number | null = null, vaincu = false, soins = 0;
      while (e.expedition) {
        if (e.expedition.salles[e.expedition.index].type === 'boss' && auMaitre === null) auMaitre = etatDu(J.herosDuGroupe(e));
        const r = J.avancer(e) ?? (() => {
          const g = J.herosDuGroupe(e);
          const x = e.expedition!;
          if (x.salles[x.index].type === 'camp') return J.agirDansLaSalle(e, 'reposer') as J.RecitDeSalle;
          // Ailleurs : l'action et le héros aux meilleures chances (`viseeDAction`), sinon passer son chemin.
          const actions = Object.keys(J.EPREUVES[x.salles[x.index].type as J.SalleAJet].actions) as J.IdActionAJet[];
          const [meilleure] = actions.flatMap((a) => g.flatMap((h) => { const v = J.viseeDAction(h, a); return v ? [{ a, h, chances: v.chances }] : []; }))
            .sort((u, v) => v.chances - u.chances);
          const r = meilleure ? J.agirDansLaSalle(e, meilleure.a, meilleure.h.c.id) : 'Personne ne sait tenter.';
          return typeof r === 'string' ? J.agirDansLaSalle(e, 'passer') as J.RecitDeSalle : r;
        })();
        if (e.expedition && !r.fin) soins += soignerLeGroupe(e);
        const g = J.herosDuGroupe(e);
        const blesse = g.filter((h) => !h.c.dead).sort((a, b) => a.c.wounds.current - b.c.wounds.current)[0];
        for (const h of g) if (blesse && blesse.c.wounds.current < blesse.c.wounds.max && J.peutPrier(e, h)) J.prier(e, h.c.id, blesse.c.id);
        for (const h of g) for (const p of J.provisionsPortees(h)) if (!p.refus && h.c.wounds.current < h.c.wounds.max / 2) J.utiliserUneProvision(e, h.c.id, p.uid);
        if (r.fin === 'succes') vaincu = true;
        const valides = g.filter(J.valide).length;
        log(`  ${r.titre}${r.combat ? ` (${r.combat.issue}, ${r.combat.pas.length} pas)` : ''} | valides ${valides}/${g.length}`);
        if (e.expedition && (valides < 2 || e.expedition.index >= rentrerApres) && !r.fin) { J.rentrer(e, false); log('  → retour'); }
      }
      sorties.push({ rang: exp, jour: e.jour, destination: dest.id, gagne: e.or - orAuDepart, depense, or: e.or, jours: e.jour - jourAuDepart, blessures, hospice: e.batiments.temple,
        morts: groupe.filter((h) => !e.roster.includes(h)).length, auMaitre, auRetour: etatDu(groupe.filter((h) => e.roster.includes(h))), vaincu, soins });
      log(`J${e.jour} ${dest.nom}: +${e.or - orAuDepart} CO, dépensé ${JSON.stringify(depense)}, or ${e.or}, trophées ${e.trophees}, roster ${e.roster.length}, niveaux ${e.roster.map((h) => `${h.c.careerLevel ?? 1}:${h.c.xp ?? 0}`).join(" ")}, bât ${JSON.stringify(e.batiments)}`);
    }
  }
  const moyenne = (l: readonly number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : NaN);
  console.log(`\n${parties} partie(s) de ${expeditions} sorties, retour après ${rentrerApres === Infinity ? 'le maître' : `${rentrerApres} salle(s)`}`);
  console.log(`| Sorties | Jour moyen | Or gagné | Or par jour | ${POSTES.join(' | ')} | Blessures soignées | Bourse |\n|---|---|---|---|${POSTES.map(() => '---|').join('')}---|---|`);
  const tranche = Math.max(1, Math.floor(expeditions / 6));
  for (let debut = 0; debut < expeditions; debut += tranche) {
    const s = sorties.filter((x) => x.rang >= debut && x.rang < debut + tranche);
    if (!s.length) continue;
    const m = (f: (x: Sortie) => number) => moyenne(s.map(f)).toFixed(0);
    console.log(`| ${debut + 1}-${debut + tranche} | ${m((x) => x.jour)} | ${m((x) => x.gagne)} | ${(moyenne(s.map((x) => x.gagne)) / Math.max(1, moyenne(s.map((x) => x.jours)))).toFixed(1)} | ${POSTES.map((p) => m((x) => x.depense[p])).join(' | ')} | ${m((x) => x.blessures)} | ${m((x) => x.or)} |`);
  }
  const hautes = sorties.filter((x) => x.hospice >= 2);
  console.log(`Hospice au palier 2 ou plus : ${hautes.length} sorties, ${moyenne(hautes.map((x) => x.blessures)).toFixed(0)} Blessures soignées et ${moyenne(hautes.map((x) => x.gagne)).toFixed(0)} CO gagnés par sortie ; le soin gratuit du palier 3 en offre ${J.PRIX_DU_SOIN_PAR_BLESSURE[2]} CO la Blessure.`);
  console.log('\n| Bâtiment | ' + [1, 2, 3].map((p) => `Palier ${p} (jour moyen, parties)`).join(' | ') + ' |\n|---|---|---|---|');
  for (const b of ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage']) {
    console.log(`| ${b} | ${[1, 2, 3].map((p) => { const j = paliers.get(`${b}|${p}`) ?? []; return j.length ? `${moyenne(j).toFixed(0)} (${j.length})` : '—'; }).join(' | ')} |`);
  }
  console.log('\n| Destination | Premier départ (jour moyen) | Niveau moyen du groupe (attendu) | Forge (attendue) | Parties |\n|---|---|---|---|---|');
  for (const d of J.DESTINATIONS) {
    const n = departs.get(d.id) ?? [], a = attendu(d.palier);
    const m = (f: (x: (typeof n)[number]) => number) => (n.length ? moyenne(n.map(f)).toFixed(1) : '—');
    console.log(`| ${d.id} | ${m((x) => x.jour)} | ${m((x) => x.niveau)} (${a.niveau}) | ${m((x) => x.forge)} (${a.forge}) | ${n.length} |`);
  }
  const pourcent = (x: number) => (Number.isNaN(x) ? '—' : `${(100 * x).toFixed(0)} %`);
  console.log('\n| Destination | Départs | Morts par sortie | Maître atteint | Maître vaincu | Blessures à l’entrée du maître | Blessures au retour | Soins par sortie |\n|---|---|---|---|---|---|---|---|');
  for (const d of J.DESTINATIONS) {
    const s = sorties.filter((x) => x.destination === d.id);
    const atteint = s.filter((x) => x.auMaitre !== null);
    console.log(`| ${d.id} | ${s.length} | ${s.length ? moyenne(s.map((x) => x.morts)).toFixed(2) : '—'} | ${atteint.length} | ${s.filter((x) => x.vaincu).length} | ${pourcent(moyenne(atteint.map((x) => x.auMaitre!)))} | ${pourcent(moyenne(s.map((x) => x.auRetour)))} | ${s.length ? moyenne(s.map((x) => x.soins)).toFixed(1) : '—'} |`);
  }
  console.log(`Toutes destinations : ${sorties.length} sorties, ${moyenne(sorties.map((x) => x.morts)).toFixed(2)} mort(s) par sortie.`);
  for (const palier of [0, 1, 2]) {
    const total = (m: Map<string, number>) => [...m].filter(([k]) => k.startsWith(`${palier}|`)).reduce((n, [, v]) => n + v, 0);
    const tp = total(proposes), te = total(engages);
    console.log(`relais ${palier} : ${tp} candidats proposés, ${te} recrues`);
    for (const p of J.PROFILS.filter((x) => x.relais <= palier)) {
      const np = proposes.get(`${palier}|${p.id}`) ?? 0, ne = engages.get(`${palier}|${p.id}`) ?? 0;
      console.log(`  ${p.id.padEnd(20)} ${p.role.padEnd(10)} proposés ${String(np).padStart(4)} (${tp ? ((100 * np) / tp).toFixed(1) : '0.0'} %)  recrues ${String(ne).padStart(4)} (${te ? ((100 * ne) / te).toFixed(1) : '0.0'} %)`);
    }
  }
}

if (import.meta.main) {
  poserLesReglesDuRoguelite();
  const [graine0, expeditions, parties, rentrerApres] = [42, 8, 1, Infinity].map((d, i) => Number(process.argv[2 + i] ?? d));
  equilibrer(graine0, expeditions, parties, rentrerApres);
}
