/**
 * BANC — ce que le balayage d'arêtes COÛTE au survol (#1687 lot 1b-2, #1788).
 *
 * CE QU'IL MESURE : deux chemins de la MÊME chaîne de prise, sur la population de la Diligence
 * (89 portails, mesurée au lot 1b-0) et sur son PIRE cas — un pixel qui ne touche aucune arête, donc
 * les 89 balayées. Le premier chemin est le balayage seul, le second la chaîne SANS l'étage d'arête,
 * c'est-à-dire ce que le survol payait déjà à chaque `pointermove`. Ce qu'on lit est leur RAPPORT :
 * une prise en O(n²) le crèverait.
 *
 * POURQUOI CE N'EST PAS UN TEST : ce que ces deux chemins rendent est un VERDICT, et il se prouve
 * sans horloge (`arete-dans-la-chaine.test.ts`). Ce qu'ils prennent est du TEMPS, et un temps mesure
 * l'ordonnanceur de la machine qui joue : le même balayage vaut 2,8 µs au calme et 7,1 µs sous la
 * suite complète. Une suite qui rougit sous charge et verdit sur une machine rapide ne prouve rien —
 * ce fichier est donc hors de `npm test` et de la CI (`scripts/guards/lib/racinesDeLaSuite.mjs` n'inclut que
 * `*.test.{ts,tsx}`), et se joue à la demande par `npm run bench`.
 *
 * Le montage est celui du contrat : `arete-dans-la-chaine.fixture.ts`.
 */
import { test } from 'vitest';
import { areteSousLePixel, resoudrePixel } from './pickResolve';
import { etat, montage } from './arete-dans-la-chaine.fixture';

const { scene, aretes, sansAretes } = montage();

/** La population de la Diligence : 89 portails offerts à la prise. */
const beaucoup = Array.from({ length: 89 }, (_, i) => aretes[i % aretes.length]);
/** Un pixel hors cadre : aucune arête ne le prend, les 89 sont donc toutes balayées. */
const loin = { x: 1e5, y: 1e5 };

test('survol : le balayage d’arêtes contre la chaîne qui le porte', async ({ bench }) => {
  await bench.compare(
    bench('balayage de 89 arêtes, aucune sous le pixel', () => {
      areteSousLePixel(loin, beaucoup);
    }),
    bench('chaîne de prise SANS étage d’arête (la référence : ce que le survol payait déjà)', () => {
      resoudrePixel(etat(scene), null, () => loin, sansAretes);
    }),
  );
});
