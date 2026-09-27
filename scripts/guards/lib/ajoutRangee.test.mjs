// Contrat de la mécanique `scanAjoutRangee` sur des formes NUES (patron de `memeRef.test.mjs`) : le bouton
// d'ajout nu est attrapé sur une ou plusieurs lignes, par glyphe « + » ou par icône `ui/add` ; le
// composant, un signe de nombre et la prose passent.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scanAjoutRangee } from './ajoutRangee.mjs'

test('scanAjoutRangee : le bouton d’ajout nu est attrapé, le composant et la prose passent', () => {
  const cas = [
    ['const a = <button className="btn small" onClick={add}>+ Emplacement</button>;', 1, 'glyphe, une ligne'],
    ['const a = (\n  <button className="btn small" onClick={add}>\n    + Nœud\n  </button>\n);', 1, 'glyphe, plusieurs lignes'],
    ['const a = <button onClick={add}>+ {quoi}</button>;', 1, 'glyphe suivi d’une expression'],
    ['const a = <button onClick={add}>+</button>;', 1, 'glyphe seul'],
    ['const a = (\n  <button type="button" onClick={add}>\n    <Icon id="ui/add" size="sm" /> Ajouter un stade\n  </button>\n);', 1, 'icône ui/add'],
    ['const a = <button onClick={add}><Icon id="ui/edit" size="sm" /> Éditer</button>;', 0, 'autre icône'],
    ['const a = <button onClick={buy}>+1 · {cout} PX</button>;', 0, 'signe de nombre'],
    ['const a = <AjoutRangee libelle="Emplacement" onAjout={add} />;', 0, 'le composant'],
    ['// <button onClick={add}>+ Emplacement</button>\nconst s = "<button>+ X</button>";', 0, 'commentaire et chaîne'],
    ['const a = <span>+ Emplacement</span>;', 0, 'pas un bouton'],
  ]
  for (const [src, attendu, nom] of cas) assert.equal(scanAjoutRangee('x.tsx', src).length, attendu, nom)
  assert.equal(scanAjoutRangee('x.tsx', cas[1][0])[0].line, 2, 'ligne de l’ouvrant')
})
