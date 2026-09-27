/**
 * LA POLICE DE LA POSSESSION SE MESURE (#1262 L1) — `ownsLocally` ne peut PAS être muré par export
 * (six consommateurs internes à `netOwnership`, plus un ré-export par `netFlow`) : ce qui tient la
 * porte UI (`ui/ownership.ts`) est le mur d'import `murs/possession` de `eslint.config.js`. Une règle
 * qu'aucun test ne lance est décorative — un `group` mal écrit ou un `importNames` oublié passerait
 * en silence, comme le sélecteur trop étroit du verrou de forge (patron `built-brand-lint.test.ts`).
 *
 * Ici on la LANCE sur la config RÉELLE (API ESLint), aux deux chemins d'import et aux deux périmètres
 * (sous la règle / module exempté), et on vérifie qu'elle ne mord PAS les autres exports.
 */
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: process.cwd() });

/** Fichier SOUS la règle (une fenêtre quelconque), et le module PORTE, qui en est exempté. */
const SOUS_LA_REGLE = 'src/ui/__sonde-possession.ts';
const LA_PORTE = 'src/ui/ownership.ts';

async function messages(code: string, filePath = SOUS_LA_REGLE): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return res.messages.filter((m) => m.ruleId === 'murs/possession').map((m) => `${m.line}:${m.column}`);
}

describe('#1262 L1 — le lint refuse le prédicat d’état importé dans une fenêtre', () => {
  it('import depuis `state/netOwnership` : refusé', async () => {
    expect(await messages("import { ownsLocally } from '../state/netOwnership';\nexport const a = ownsLocally;\n")).toHaveLength(1);
  });

  it('import depuis le RÉ-EXPORT `state/netFlow` : refusé aussi (c’est la route réelle des 8 fenêtres)', async () => {
    expect(await messages("import { ownsLocally } from '../state/netFlow';\nexport const b = ownsLocally;\n")).toHaveLength(1);
  });

  it('depuis un sous-dossier (`ui/jetProps/…`, deux crans de remontée) : refusé — le motif ne dépend pas de la profondeur', async () => {
    const code = "import { ownsLocally } from '../../state/netOwnership';\nexport const c = ownsLocally;\n";
    expect(await messages(code, 'src/ui/jetProps/__sonde-possession.ts')).toHaveLength(1);
  });

  it('les AUTRES exports de ces modules passent (le nom seul est restreint)', async () => {
    const code = "import { controlsCombatant, seatOwns } from '../state/netOwnership';\nexport const d = [controlsCombatant, seatOwns];\n";
    expect(await messages(code)).toHaveLength(0);
  });

  it('la PORTE elle-même est exemptée : c’est le seul site qui a le droit de déléguer', async () => {
    expect(await messages("import { ownsLocally } from '../state/netOwnership';\nexport const e = ownsLocally;\n", LA_PORTE)).toHaveLength(0);
  });

  it('hors `src/ui`, la règle ne s’applique pas (l’état consomme son propre prédicat)', async () => {
    const code = "import { ownsLocally } from './netOwnership';\nexport const f = ownsLocally;\n";
    expect(await messages(code, 'src/state/__sonde-possession.ts')).toHaveLength(0);
  });
});

/**
 * LA POLICE D'IMPORT NE VOIT PAS LES RECOPIES (#1262 L1, solde) — deux écrans ne DEMANDAIENT rien à
 * `netOwnership` : ils REFAISAIENT le prédicat à la main (`(net.ownership[id] ?? 0) === net.mySeat`,
 * `InterludeScreen`/`PartyScreen`). Aucun import à restreindre, donc aucune garde ne mordait : c'est
 * le cas FONDATEUR qui doit rougir, pas seulement sa version polie. Ce volet scanne donc la FORME.
 *
 * CE QUE LE MOTIF VISE — la DÉCISION « est-ce à moi ? » : une comparaison entre le siège TIRÉ de
 * `ownership[…]` et `mySeat`, dans la même expression.
 * CE QU'IL NE VISE PAS (mesuré sur la population réelle : 14 occurrences de `ownership[`/`mySeat`
 * sous `src/ui`, dont 12 légitimes) — et c'est voulu, pas un trou :
 *  · lire le SIÈGE d'un héros pour en AFFICHER le nom ou le portrait (`net.ownership[id] ?? 0`
 *    seul : `ActiveModal`, `CoopPanels`, `RestModal`, `VictoryScreen`, `CharacterCreator`,
 *    `InterludeScreen.ownerName`) — aucune décision de possession n'y est prise ;
 *  · comparer un siège DÉJÀ RÉSOLU à `mySeat` (`seat === net.mySeat` : le slot de `PartyScreen`
 *    porte son siège, même quand AUCUN héros ne l'occupe — la porte, elle, est keyée par combattant
 *    et n'a rien à en dire).
 * Aucune exemption par FICHIER : la population visée est vide, la garde est fail-closed.
 */
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/** Le prédicat recopié : le siège d'attribution d'un combattant, comparé au siège local. */
const RECOPIE = /ownership\s*\[[^\]]*\][^;\n]*===\s*[\w.]*\bmySeat\b|\bmySeat\b\s*===[^;\n]*ownership\s*\[/;

/** Modules de PRODUCTION de `src/ui` — la PORTE elle-même est hors mesure (elle DOIT porter le
 *  prédicat), et les tests le CITENT pour éprouver le détecteur (celui-ci le fait). */
const fichiers = () => readCorpus(['src/ui']).filter(({ rel }) => rel !== 'src/ui/ownership.ts');

describe('#1262 L1 — la garde de FORME : aucune recopie du prédicat sous `src/ui`', () => {
  it('le prédicat de possession ne se réécrit pas à la main (site NOMMÉ en cas de rechute)', () => {
    const sites: string[] = [];
    for (const { rel, text } of fichiers()) {
      text.split('\n').forEach((l, i) => {
        if (/^\s*(\/\/|\*)/.test(l)) return; // commentaires : le motif s'y CITE (ce test compris)
        if (RECOPIE.test(l)) sites.push(`${rel.slice('src/ui/'.length)}:${i + 1} — ${l.trim()}`);
      });
    }
    expect(sites, `Possession RECOPIÉE (#1262) — passer par \`ui/ownership.ts\` (\`ownsLocal\`/\`useOwns\`/\`ownsLocalNet\`) :\n${sites.join('\n')}`).toEqual([]);
  });

  it('le détecteur MORD sur la forme fondatrice, et se tait sur les lectures de siège', () => {
    const mord = (s: string) => RECOPIE.test(s);
    expect(mord('const owns = (id) => !coop || (net.ownership[id] ?? 0) === net.mySeat;'), 'PartyScreen d’avant').toBe(true);
    expect(mord("const o = (id) => net.mode === 'local' || (net.ownership[id] ?? 0) === net.mySeat;"), 'InterludeScreen d’avant').toBe(true);
    expect(mord('const seat = net.ownership[active.id] ?? 0;'), 'lecture de siège pour affichage').toBe(false);
    expect(mord('const mine = !coop || seat === net.mySeat;'), 'siège DÉJÀ résolu (slot sans héros)').toBe(false);
  });
});
