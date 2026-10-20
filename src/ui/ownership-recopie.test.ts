/**
 * La possession ne se recopie pas (#1262 L1) : elle se demande à `noyau/netOwnership.ownsLocal`.
 *
 * Forme refusée — la décision « est-ce à moi ? » écrite à la main : un siège tiré de `ownership[…]`
 * comparé à `mySeat`, dans la même expression.
 * Formes tolérées :
 *  · lire le siège d'un héros (`net.ownership[id] ?? 0` seul), sans le comparer à `mySeat` ;
 *  · comparer à `mySeat` un siège déjà résolu (`seat === net.mySeat`), qu'aucun combattant ne porte.
 * Aucune exemption par fichier.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/** Le prédicat recopié : le siège d'attribution d'un combattant, comparé au siège local. */
const RECOPIE = /ownership\s*\[[^\]]*\][^;\n]*===\s*[\w.]*\bmySeat\b|\bmySeat\b\s*===[^;\n]*ownership\s*\[/;

/** Modules de PRODUCTION de `src/ui` — les tests CITENT le motif pour éprouver le détecteur (celui-ci le fait). */
const fichiers = () => readCorpus(['src/ui']);

describe('#1262 L1 — la garde de FORME : aucune recopie du prédicat sous `src/ui`', () => {
  it('le prédicat de possession ne se réécrit pas à la main (site NOMMÉ en cas de rechute)', () => {
    const sites: string[] = [];
    for (const { rel, text } of fichiers()) {
      text.split('\n').forEach((l, i) => {
        if (/^\s*(\/\/|\*)/.test(l)) return; // commentaires : le motif s'y CITE (ce test compris)
        if (RECOPIE.test(l)) sites.push(`${rel.slice('src/ui/'.length)}:${i + 1} — ${l.trim()}`);
      });
    }
    expect(sites, `Possession RECOPIÉE (#1262) — passer par \`noyau/netOwnership.ownsLocal\` (vues \`useOwns\`/\`ownsLocalNet\` de \`ui/ownership.ts\`) :\n${sites.join('\n')}`).toEqual([]);
  });

  it('le détecteur MORD sur la forme fondatrice, et se tait sur les lectures de siège', () => {
    const mord = (s: string) => RECOPIE.test(s);
    expect(mord('const owns = (id) => !coop || (net.ownership[id] ?? 0) === net.mySeat;'), 'PartyScreen d’avant').toBe(true);
    expect(mord("const o = (id) => net.mode === 'local' || (net.ownership[id] ?? 0) === net.mySeat;"), 'InterludeScreen d’avant').toBe(true);
    expect(mord('const seat = net.ownership[active.id] ?? 0;'), 'lecture de siège pour affichage').toBe(false);
    expect(mord('const mine = !coop || seat === net.mySeat;'), 'siège DÉJÀ résolu (slot sans héros)').toBe(false);
  });
});
