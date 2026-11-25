// Balayage : chaque rencontre de chaque destination (meutes, élites, maître) contre un groupe de quatre recrues du
// roster complet (`PROFILS`), sur plusieurs graines. Signale les impasses, les combats de moins de 5 pas et le taux de victoire.
// Mode `sorts` : pour chaque voie du roster (Collège, dieu) et chaque niveau de carrière, un lanceur qui connaît les
// sorts que la Salle d'armes lui propose (`sortsProposes`), et les sorts `essais` en plus, combat aux côtés d'un
// Soldat, d'un Chasseur et d'un Ratier de son niveau contre les rencontres des destinations, avec et sans
// `magie-vdm-incantation` : ses tentatives de lancer, ses lancers réussis, et ceux qui portent un effet vu au combat
// (Blessures infligées, État gagné par la cible, soutien d'un membre du groupe), par voie et niveau puis par sort.
// Usage : npx tsx projets/roguelite/balayage.ts <graines> [destination]
//         npx tsx projets/roguelite/balayage.ts sorts <graines> [essai,essai…]
import {
  DESTINATIONS,
  PROFILS,
  acheter,
  ameliorer,
  dieuDe,
  nouvellePartie,
  recrue,
  sortsProposes,
  voieDe,
  type Etat,
  type Heros,
  type Profil,
} from './src/jeu';
import { jouerLeCombat, nomDeCreature, porterAuNiveau, poserLesReglesDuRoguelite, type Combatant } from './src/noyau';
/** Balaie chaque rencontre sur `N` graines, la destination `destination` seule si elle est nommée. */
function balayer(N: number, destination?: string): void {
  for (const d of DESTINATIONS.filter((x) => !destination || x.id === destination)) {
    for (const [genre, liste] of [['meute', d.meutes], ['élite', d.elites], ['maître', [d.boss]]] as const) {
      for (const ennemis of liste) {
        let v = 0, imp = 0, courts = 0, morts = 0; const t0 = Date.now();
        for (let i = 0; i < N; i++) {
          const e = nouvellePartie(7000 + i * 10);
          const g = [0, 1, 2, 3].map((k) => recrue(e, PROFILS[(i * 4 + k) % PROFILS.length]).c);
          const r = jouerLeCombat(g, ennemis, 9000 + i, d.lumiere);
          if (r.issue === 'victoire') v++; if (r.issue === 'impasse') imp++; if (r.pas.length < 5) courts++; morts += r.morts.length;
          if (r.groupe.length + r.morts.length < g.length) console.log('   groupe rendu incomplet', r.issue, r.groupe.length, r.morts.length);
        }
        console.log(`${d.id} ${genre} ${ennemis.map(nomDeCreature).join('+')} : ${v}/${N} victoires, ${imp} impasses, ${courts} courts, ${morts} morts, ${((Date.now() - t0) / N).toFixed(0)} ms`);
      }
    }
  }
}

/** Les lancers d'un sort : tentés, réussis, et avec un effet vu au combat. */
interface Lancers { tentes: number; reussis: number; effet: number }
const AUCUN: Lancers = { tentes: 0, reussis: 0, effet: 0 };
const ajouter = (a: Lancers, b: Lancers): Lancers => ({ tentes: a.tentes + b.tentes, reussis: a.reussis + b.reussis, effet: a.effet + b.effet });
const COMPAGNONS = ['soldat', 'chasseur', 'ratier'];
const profil = (id: string): Profil => PROFILS.find((p) => p.id === id)!;

/** Le héros de la carrière `p` au niveau `niveau`, tiré jusqu'à servir le dieu `dieu` s'il est nommé, qui a appris à
 *  la Salle d'armes le Talent de sa voie et les sorts qu'elle lui propose, puis les `essais`. */
function lanceur(e: Etat, p: Profil, niveau: number, dieu: string | undefined, essais: readonly string[]): Heros {
  let h = recrue(e, p);
  while (dieu && dieuDe(h.c) !== dieu) h = recrue(e, p);
  h.c = porterAuNiveau(h.c, niveau, e.graine++);
  h.c.xp = 1e6; e.roster.push(h);
  const v = voieDe(h.carriere, h.c)!;
  acheter(e, h.c.id, { genre: 'talent', ref: { id: v.talent, spec: v.spec } });
  for (const id of sortsProposes(h)) acheter(e, h.c.id, { genre: 'sort', id });
  if (h.c.talents.some((t) => t.talentId === 'magie-des-arcanes')) h.c.spells = [...new Set([...(h.c.spells ?? []), ...essais])];
  return h;
}

/** Les lancers du lanceur `id` sur un combat, par sort : un sort réussi porte un effet s'il inflige des Blessures, si
 *  sa cible gagne un État au même pas, ou s'il vise un membre du groupe (un soutien, que le noyau applique). */
function compter(id: string, groupe: readonly Combatant[], ennemis: readonly string[], graine: number, lumiere: string, par: Map<string, Lancers>): void {
  for (const pas of jouerLeCombat(groupe, ennemis, graine, lumiere).pas) {
    for (const c of pas.coups) {
      if (c.genre !== 'spell' || c.de !== id) continue;
      const l = { ...(par.get(c.sort!) ?? AUCUN) };
      l.tentes++;
      if (c.touche) { l.reussis++; if (c.blessures > 0 || pas.etats.some((x) => x.porteur === c.vers) || groupe.some((g) => g.id === c.vers)) l.effet++; }
      par.set(c.sort!, l);
    }
  }
}

const cellule = (l: Lancers, combats: number): string => `${l.tentes} (${(l.tentes / combats).toFixed(1)}/combat) · ${l.reussis} · ${l.effet}`;

/** Mesure les lancers de chaque voie du roster, niveau par niveau, sur `N` combats, avec et sans
 *  `magie-vdm-incantation`, puis par sort, tous niveaux confondus ; imprime deux tableaux Markdown. */
function mesurerLesSorts(N: number, essais: readonly string[]): void {
  const rencontres = DESTINATIONS.flatMap((d) => [...d.meutes, ...d.elites, d.boss].map((ennemis) => ({ ennemis, lumiere: d.lumiere })));
  const voies = [...PROFILS.filter((p) => p.voie).map((p) => ({ p, dieu: undefined as string | undefined, spec: p.voie!.spec })),
    ...profil('pretre-guerrier').dieux!.map((dieu) => ({ p: profil('pretre-guerrier'), dieu, spec: dieu }))];
  const parSort = new Map<string, Map<string, Lancers>>();
  console.log(`${N} combats par case, rencontres tournantes parmi ${rencontres.length} ; case : tentatives (par combat) · réussis · avec effet\n`);
  console.log('| Voie | Niveau | Avec magie-vdm-incantation | Sans |\n|---|---|---|---|');
  for (const { p, dieu, spec } of voies) {
    for (let niveau = p.niveau; niveau <= 4; niveau++) {
      const cases = [true, false].map((vdm) => {
        poserLesReglesDuRoguelite({ 'magie-vdm-incantation': vdm });
        const par = new Map<string, Lancers>();
        for (let i = 0; i < N; i++) {
          const e = nouvellePartie(7000 + i * 10);
          e.or = 1e6; e.trophees = 99; while (!ameliorer(e, 'salle'));
          const h = lanceur(e, p, niveau, dieu, essais);
          const groupe = [h.c, ...COMPAGNONS.map((c) => porterAuNiveau(recrue(e, profil(c)).c, niveau, e.graine++))];
          const { ennemis, lumiere } = rencontres[i % rencontres.length];
          compter(h.c.id, groupe, ennemis, 9000 + i, lumiere, par);
        }
        const cle = `${spec} ${vdm ? 'avec' : 'sans'}`;
        const cumul = parSort.get(cle) ?? new Map<string, Lancers>();
        for (const [s, l] of par) cumul.set(s, ajouter(cumul.get(s) ?? AUCUN, l));
        parSort.set(cle, cumul);
        return cellule([...par.values()].reduce(ajouter, AUCUN), N);
      });
      console.log(`| ${spec} | ${niveau} | ${cases[0]} | ${cases[1]} |`);
    }
  }
  console.log('\n| Voie | Règle | Sort | Tentatives | Réussis | Avec effet |\n|---|---|---|---|---|---|');
  for (const [cle, par] of parSort) {
    const [spec, regle] = cle.split(' ');
    for (const [s, l] of [...par].sort((a, b) => b[1].tentes - a[1].tentes)) console.log(`| ${spec} | ${regle} | ${s} | ${l.tentes} | ${l.reussis} | ${l.effet} |`);
  }
  poserLesReglesDuRoguelite();
}

if (import.meta.main) {
  poserLesReglesDuRoguelite();
  if (process.argv[2] === 'sorts') mesurerLesSorts(Number(process.argv[3] ?? 10), process.argv[4]?.split(',') ?? []);
  else balayer(Number(process.argv[2] ?? 10), process.argv[3]);
}
