/**
 * MORSURE des PORTES de `2026-10-05-1988-grantweapon-libelle-derive.mjs` (#1988 B4a) — l'op `grantWeapon`
 * perd `label` dans les catalogues `src/data/*.json`.
 *
 * La migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario. FIXTURES FABRIQUÉES :
 * un catalogue jouet, jamais `spells.json` livré ; l'état d'arrivée est écrit à la main.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-10-05-1988-grantweapon-libelle-derive.mjs';
const SORTS = 'src/data/sorts-jouets.json';
const AUTRE = 'src/data/sans-op.json';

/** Un sort jouet porteur d'une op `grantWeapon`, `label` présent ou non. */
const sorts = (avecLibelle) => `${JSON.stringify([{ id: 'arme', label: 'Arme', ops: [{ op: 'grantWeapon', ...(avecLibelle ? { label: 'Arme' } : {}), damage: 4 }] }], null, 2)}\n`;

test('(a) MIGRATION RÉELLE : `label` de l’op retiré, le reste du texte intact', (t) => {
  const d = depot({ [SORTS]: sorts(true), [AUTRE]: '[]\n' });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, sortie);
  assert.equal(lireDans(d.racine, SORTS), sorts(false));
  assert.equal(lireDans(d.racine, AUTRE), '[]\n');
});

test('(b) IDEMPOTENTE : rejouée sur l’état d’arrivée, elle n’écrit rien et sort 0', (t) => {
  const d = depot({ [SORTS]: sorts(false) });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, sortie);
  assert.deepEqual(rienTouche(d.racine, d.avant), []);
});

test('(c) un `label` d’op que l’ancre textuelle ne voit pas : ARRÊT nommé, aucune écriture', () => {
  const desordre = `${JSON.stringify([{ id: 'arme', ops: [{ damage: 4, label: 'Arme', op: 'grantWeapon' }] }], null, 2)}\n`;
  refuse(MIGRATION, { [SORTS]: desordre }, 'src/data/sorts-jouets.json : 1 op(s) `grantWeapon` à `label`, 0 ancrée(s)');
});
