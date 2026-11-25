/** `catalogueDu` (#5069, fossile 6) : le catalogue du contexte, sinon celui du processus. */
import { describe, expect, it } from 'vitest';
import { catalogueDu } from './catalogueDu';
import { catalogueDuProcessus } from '../data/catalogueDuProcessus';
import { catalogueDeTest } from '../data/schemas/catalogue/catalogueDeTest.testkit';

describe('catalogueDu', () => {
  it('rend le catalogue posé au contexte', () => {
    const pose = catalogueDeTest({});
    expect(catalogueDu({ catalogue: pose })).toBe(pose);
  });

  it('rend le catalogue du processus sans catalogue au contexte', () => {
    expect(catalogueDu({})).toBe(catalogueDuProcessus());
  });
});
