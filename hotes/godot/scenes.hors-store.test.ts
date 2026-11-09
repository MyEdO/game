/**
 * LES SCÈNES DE L'HÔTE GODOT SURVIVENT À L'EXPORT (#3848) : un noeud qu'une scène pose sous un noeud INTERNE d'une scène
 * qu'elle instancie (son `parent` passe par le noeud de l'instance) n'est gardé que si la scène déclare l'instance
 * éditable (`[editable path="…"]`). Sans elle, le projet le charge depuis le texte, mais l'export, qui réenregistre
 * chaque scène, le perd : à l'export Web, `Monde` perdait la forme de son sol, et aucun clic ne touchait plus une case.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';

const PROJET = new URL('./projet/', import.meta.url);

/** Les noeuds posés sous un noeud interne d'une instance non éditable de la scène `texte`, chacun `parent/nom`. */
function noeudsPerdusALExport(texte: string): string[] {
  const noeuds = [...texte.matchAll(/^\[node ([^\]]*)\]/gm)].map(([, attributs]) => ({
    nom: /\bname="([^"]*)"/.exec(attributs)?.[1] ?? '',
    parent: /\bparent="([^"]*)"/.exec(attributs)?.[1],
    instance: /\binstance=/.test(attributs),
  }));
  const chemin = (n: { nom: string; parent?: string }) => (n.parent === undefined ? '' : n.parent === '.' ? n.nom : `${n.parent}/${n.nom}`);
  const instances = noeuds.filter((n) => n.instance && n.parent !== undefined).map(chemin);
  const editables = new Set([...texte.matchAll(/^\[editable path="([^"]*)"\]/gm)].map(([, p]) => p));
  return noeuds
    .filter((n) => n.parent !== undefined && instances.some((i) => n.parent!.startsWith(`${i}/`) && !editables.has(i)))
    .map(chemin);
}

describe('les scènes de l’hôte Godot survivent à l’export', () => {
  it('aucun noeud posé sous un noeud interne d’une instance non éditable', () => {
    const scenes: string[] = listerArbre(fileURLToPath(PROJET), { filtre: (f: string) => f.endsWith('.tscn'), descendre: (d: string) => !d.startsWith('.') });
    expect(scenes, 'les scènes du projet').toContain('scenes/Monde.tscn');
    const fautes = scenes.flatMap((f) => noeudsPerdusALExport(readFileSync(new URL(f, PROJET), 'utf8')).map((n) => `${f} : ${n}`));
    expect(fautes).toEqual([]);
  });

  it('le détecteur voit le noeud posé dans une instance, et l’accepte une fois l’instance éditable', () => {
    const scene = '[node name="Racine" type="Node3D"]\n\n[node name="Volume" parent="." instance=ExtResource("1")]\n\n[node name="Corps" type="StaticBody3D" parent="Volume/Interne"]\n\n[node name="Frere" type="Node3D" parent="Volume"]\n';
    expect(noeudsPerdusALExport(scene)).toEqual(['Volume/Interne/Corps']);
    expect(noeudsPerdusALExport(`${scene}\n[editable path="Volume"]\n`)).toEqual([]);
  });
});
