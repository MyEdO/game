// Équilibrage : joue des expéditions entières sous node, sans interface, avec une stratégie simple (recruter,
// soigner, loger, bâtir, équiper, suivre le plan conseillé de carrière, partir vers la destination la plus lointaine
// avec des potions, prier et boire entre les salles, rentrer sous 2 héros valides).
// L'état passe par JSON entre deux expéditions, comme une sauvegarde relue. Finit par la part de chaque carrière parmi
// les candidats proposés et parmi les recrues engagées, par palier du relais.
// Usage : npx tsx projets/roguelite/equilibrage.ts <graine> <expéditions> [parties] — plusieurs parties : graines consécutives, sans journal.
import * as J from './src/jeu';
import { poserLesReglesDuRoguelite } from './src/noyau';
/** Joue `parties` parties de `expeditions` expéditions, de la graine `graine0`, et dit la part de chaque carrière. */
function equilibrer(graine0: number, expeditions: number, parties: number): void {
  const log = parties > 1 ? () => {} : console.log;
  const proposes = new Map<string, number>(), engages = new Map<string, number>(), vus = new Set<string>();
  const compter = (m: Map<string, number>, cle: string) => m.set(cle, (m.get(cle) ?? 0) + 1);
  /** En état de partir : valide, à 60 % de ses Blessures au moins ; les autres prennent une chambre. */
  const partant = (h: J.Heros) => J.valide(h) && h.c.wounds.current >= h.c.wounds.max * 0.6;
  const voir = (e: J.Etat) => { for (const c of e.candidats) if (!vus.has(c.c.id)) { vus.add(c.c.id); compter(proposes, `${e.batiments.relais}|${c.carriere}`); } };
  for (let partie = 0; partie < parties; partie++) {
  let e = J.nouvellePartie(graine0 + partie);
  for (let exp = 0; exp < expeditions; exp++) {
    e = JSON.parse(JSON.stringify(e)) as J.Etat; // la sauvegarde relue entre deux expéditions
    voir(e);
    while (e.candidats.length && e.roster.length < 4) { const c = e.candidats[0]; if (J.recruter(e, 0)) break; compter(engages, `${e.batiments.relais}|${c.carriere}`); }
    for (const h of e.roster) if (J.blesse(h)) J.soignerAuTemple(e, h.c.id);
    for (const h of e.roster) if (!partant(h)) J.prendreUneChambre(e, h.c.id);
    for (const b of ['temple', 'salle', 'forge', 'relais', 'cartographe', 'peage'] as const) J.ameliorer(e, b);
    voir(e);
    for (const h of e.roster) {
      const armure = (['armure-moyenne', 'armure-legere'] as const).find((id) => J.allure(h).armure?.poids === id || J.armuresEnVente(e, h).some((a) => a.id === id));
      if (armure) J.acheterUneArmure(e, h.c.id, armure);
      if (!J.provisionsPortees(h).length && J.provisionsEnVente(e).some((a) => a.id === 'potion-de-guerison')) J.acheterUneProvision(e, h.c.id, 'potion-de-guerison');
      let niveauPasse = true;
      while (niveauPasse) niveauPasse = J.suivreLePlan(e, h.c.id).achats.some((a) => a.genre === 'niveau');
    }
    const dest = J.destinationsOuvertes(e).pop()!;
    const err = J.partir(e, dest.id, e.roster.filter((h) => J.disponible(h) && partant(h)).slice(0, 4).map((h) => h.c.id));
    if (err) { log('départ refusé', err, e.roster.length, e.or, J.attendreUneSemaine(e) ?? 'la compagnie attend une semaine'); continue; }
    while (e.expedition) {
      const r = J.avancer(e) ?? (() => {
        const g = J.herosDuGroupe(e);
        const x = e.expedition!;
        if (x.salles[x.index].type === 'camp') {
          // Au camp : le premier soigneur soigne chaque blessé que le noyau lui confie, puis le groupe se repose.
          const soigneur = g.find((h) => !J.refusDuSoigneur(e, h));
          if (soigneur) for (const h of g) if (!J.refusDuPatient(e, soigneur, h)) J.agirDansLaSalle(e, 'soigner', soigneur.c.id, h.c.id);
          return J.agirDansLaSalle(e, 'reposer') as J.RecitDeSalle;
        }
        const [action, repli] = x.salles[x.index].type === 'rencontre' ? ['parlementer', 'parlementer'] as const : ['desarmer', 'fouiller'] as const;
        const tenteur = g.find((h) => !J.refusDAction(h, action));
        const r = tenteur ? J.agirDansLaSalle(e, action, tenteur.c.id) : J.agirDansLaSalle(e, repli, g.find(J.valide)?.c.id);
        return typeof r === 'string' ? J.agirDansLaSalle(e, 'passer') as J.RecitDeSalle : r;
      })();
      const g = J.herosDuGroupe(e);
      const blesse = g.filter((h) => !h.c.dead).sort((a, b) => a.c.wounds.current - b.c.wounds.current)[0];
      for (const h of g) if (blesse && blesse.c.wounds.current < blesse.c.wounds.max && J.peutPrier(e, h)) J.prier(e, h.c.id, blesse.c.id);
      for (const h of g) for (const p of J.provisionsPortees(h)) if (!p.refus && h.c.wounds.current < h.c.wounds.max / 2) J.utiliserUneProvision(e, h.c.id, p.uid);
      const valides = g.filter(J.valide).length;
      log(`  ${r.titre}${r.combat ? ` (${r.combat.issue}, ${r.combat.pas.length} pas)` : ''} | valides ${valides}/${g.length}`);
      if (e.expedition && valides < 2 && !r.fin) { J.rentrer(e, false); log('  → retraite'); }
    }
    log(`J${e.jour} ${dest.nom}: or ${e.or}, trophées ${e.trophees}, roster ${e.roster.length}, niveaux ${e.roster.map((h) => h.c.careerLevel ?? 1).join("")}, sorts ${e.roster.map((h) => (h.c.spells ?? []).length).join("")}, bât ${JSON.stringify(e.batiments)}`);
  }
  }
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
  const [graine0, expeditions, parties] = [42, 8, 1].map((d, i) => Number(process.argv[2 + i] ?? d));
  equilibrer(graine0, expeditions, parties);
}
