// Balayage : chaque rencontre de chaque destination (meutes, élites, maître) contre un groupe de quatre recrues du
// roster complet (`PROFILS`), sur plusieurs graines. Signale les impasses, les combats de moins de 5 pas et le taux de victoire.
// Mode `sorts` : pour chaque voie du roster (Collège, dieu) et chaque niveau de carrière, un lanceur qui connaît les
// sorts que la Salle d'armes lui propose (`sortsProposes`), et les sorts `essais` en plus, combat aux côtés d'un
// Soldat, d'un Chasseur et d'un Ratier de son niveau contre les rencontres des destinations, avec et sans
// `magie-vdm-incantation` : ses tentatives de lancer, ses lancers réussis, et ceux qui portent un effet vu au combat
// (Blessures infligées, État gagné par la cible, soutien d'un membre du groupe), par voie et niveau puis par sort.
// Mode `paliers` : chaque rencontre de chaque destination contre le groupe complet attendu à son palier (`attendu`) :
// un front, un tireur, un soigneur et un lanceur des carrières que le relais du palier ouvre, portés par le plan
// conseillé au niveau attendu, équipés à la forge du palier (`equiper`), leur voie apprise (`apprendreLaVoie`).
// Usage : npx tsx projets/roguelite/balayage.ts <graines> [destination]
//         npx tsx projets/roguelite/balayage.ts paliers <graines> [destination]
//         npx tsx projets/roguelite/balayage.ts sorts <graines> [essai,essai…]
import {
  DESTINATIONS,
  acheterUneArmure,
  armuresEnVente,
  suivreLePlan,
  type Destination,
  type IdBatiment,
  type Role,
  PROFILS,
  acheter,
  ameliorer,
  panoplieDe,
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
/** Le héros `h` apprend à la Salle d'armes le Talent de sa voie et les sorts qu'elle lui propose, s'il en a une. */
export function apprendreLaVoie(e: Etat, h: Heros): void {
  const v = voieDe(h.carriere, h.c);
  if (!v) return;
  acheter(e, h.c.id, { genre: 'talent', ref: { id: v.talent, spec: v.spec } });
  for (const id of sortsProposes(h)) acheter(e, h.c.id, { genre: 'sort', id });
}

/** Le héros `h` revêt la panoplie la plus lourde que la forge vend et qu'il accepte (`acheterUneArmure` refuse celle
 *  qui ôte des DR à ses Tests d'Incantation). */
export function equiper(e: Etat, h: Heros): void {
  for (const a of [...armuresEnVente(e)].reverse()) if (!acheterUneArmure(e, h.c.id, a.id) || panoplieDe(h)?.id === a.id) return;
}

/** Ce qu'un groupe complet a atteint quand il part vers la destination de palier `palier` : le niveau de carrière que
 *  la Salle d'armes du même palier enseigne (`niveauMaximal`), et le même palier de la forge (MyEdO/game#4963). */
export const attendu = (palier: number): { niveau: number; forge: number } => ({ niveau: palier + 1, forge: palier });
/** Les rôles d'un groupe complet (#4947, « Roster »). */
const ROLES_DU_GROUPE: readonly Role[] = ['front', 'tireur', 'soigneur', 'lanceur'];

/** Le groupe complet attendu à la destination `d`, la `i`-ième carrière de chaque rôle que le relais du palier ouvre. */
function groupeAttendu(d: Destination, i: number): Combatant[] {
  const e = nouvellePartie(7000 + i * 10);
  const { niveau, forge } = attendu(d.palier);
  e.or = 1e6; e.trophees = 99;
  const cibles: Partial<Record<IdBatiment, number>> = { relais: Math.min(d.palier, 2), salle: niveau - 1, forge };
  for (const [b, palier] of Object.entries(cibles) as [IdBatiment, number][]) while (e.batiments[b] < palier) ameliorer(e, b);
  return ROLES_DU_GROUPE.map((role) => {
    const offertes = PROFILS.filter((p) => p.role === role && p.relais <= e.batiments.relais);
    const h = recrue(e, offertes[i % offertes.length]);
    e.roster.push(h);
    h.c.xp = 1e6;
    while (suivreLePlan(e, h.c.id).achats.some((a) => a.genre === 'niveau'));
    apprendreLaVoie(e, h);
    equiper(e, h);
    return h.c;
  });
}

/** Balaie chaque rencontre sur `N` graines, la destination `destination` seule si elle est nommée, contre quatre
 *  recrues du roster complet, ou contre le groupe complet attendu au palier de la destination (`auPalier`). */
function balayer(N: number, destination: string | undefined, auPalier: boolean): void {
  for (const d of DESTINATIONS.filter((x) => !destination || x.id === destination)) {
    const groupes = Array.from({ length: N }, (_, i) => (auPalier ? groupeAttendu(d, i) : ((e) => [0, 1, 2, 3].map((k) => recrue(e, PROFILS[(i * 4 + k) % PROFILS.length]).c))(nouvellePartie(7000 + i * 10))));
    if (auPalier) console.log(`${d.id} : ${groupes.map((g) => g.map((c) => `${c.career}${c.careerLevel}`).join('+')).join(' · ')}`);
    for (const [genre, liste] of [['meute', d.meutes], ['élite', d.elites], ['maître', [d.boss]]] as const) {
      for (const ennemis of liste) {
        let v = 0, imp = 0, courts = 0, morts = 0; const t0 = Date.now();
        for (let i = 0; i < N; i++) {
          const g = groupes[i];
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
  apprendreLaVoie(e, h);
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
  else if (process.argv[2] === 'paliers') balayer(Number(process.argv[3] ?? 10), process.argv[4], true);
  else balayer(Number(process.argv[2] ?? 10), process.argv[3], false);
}
