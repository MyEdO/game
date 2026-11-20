/**
 * LES ZONES QUI PORTENT UN EMPLACEMENT (#4351) : un objet rangé s'appuie sur ce qui est porté sous son emplacement
 * (`MontageDeComposition._appuyer`, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D »), jamais sur le pan d'une autre partie
 * du corps qui passe devant lui (la pointe d'une manche large devant la hanche). Ce qui porte l'emplacement d'un os est
 * ce qui habille la zone de cet os (`zoneDeLOs`, `corps.ts`) ou une zone voisine (`zonesVoisines`,
 * `gardes/membreDansUnVetement.ts`), les mêmes que mesure la garde du membre. Le listage des modèles les lit du GLB de
 * chaque base (`hotes/godot/listage.mjs`) et `modeles` les sert à Godot.
 */
import type { Mesh } from 'three';
import { lireGlb } from '../glb.ts';
import { chargerScene } from './chargement.ts';
import { meshesDuCorps, zoneDe, zoneDeLOs } from './corps.ts';
import { poseDeRepos } from './echantillonnage.ts';
import { zonesVoisines } from './gardes/membreDansUnVetement.ts';

/** Par os de la base de GLB `octets` qui tient une zone du corps, cette zone puis ses voisines au repos ; un os lié à
 *  aucun mesh de zone, et toute base sans zone, n'y sont pas. */
export async function zonesPortantesDeLaBase(octets: Uint8Array): Promise<Record<string, string[]>> {
  if (!lireGlb(octets).zones.size) return {};
  const base = await chargerScene(octets);
  const corps = meshesDuCorps(base);
  const zone = (m: Mesh): string | undefined => { const z = zoneDe(m); return typeof z === 'string' ? z : undefined; };
  const zones = [...new Set(corps.flatMap((m) => zone(m) ?? []))];
  const voisines = zonesVoisines(corps, zone, poseDeRepos(base.scene, corps));
  return Object.fromEntries((base.squelette?.bones ?? []).flatMap((os) => {
    const tenue = zoneDeLOs(corps, zone, os.name);
    return tenue === undefined ? [] : [[os.name, [tenue, ...zones.filter((z) => voisines.has(`${tenue}|${z}`))]]];
  }));
}
