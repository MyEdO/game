import { describe, it, expect } from 'vitest';
import { posePartagee } from './posePartagee';

describe('posePartagee — posée à la première prise, retirée à la dernière remise', () => {
  const journal = () => {
    const faits: string[] = [];
    return { faits, pose: posePartagee(() => faits.push('pose'), () => faits.push('retrait')) };
  };

  it('trois preneurs : une pose, un retrait, à la dernière remise seulement', () => {
    const { faits, pose } = journal();
    const r = [pose.prendre(), pose.prendre(), pose.prendre()];
    expect(faits).toEqual(['pose']);
    r[1](); r[0]();
    expect(faits).toEqual(['pose']);
    r[2]();
    expect(faits).toEqual(['pose', 'retrait']);
    pose.prendre();
    expect(faits).toEqual(['pose', 'retrait', 'pose']);
  });

  it('une remise n’agit qu’une fois', () => {
    const { faits, pose } = journal();
    const a = pose.prendre();
    pose.prendre();
    a(); a();
    expect(faits).toEqual(['pose']);
  });

  it('`vider` retire la pose et rend inertes les remises antérieures', () => {
    const { faits, pose } = journal();
    const ancienne = pose.prendre();
    pose.vider();
    expect(faits).toEqual(['pose', 'retrait']);
    const neuve = pose.prendre();
    ancienne();
    expect(faits).toEqual(['pose', 'retrait', 'pose']);
    neuve();
    expect(faits).toEqual(['pose', 'retrait', 'pose', 'retrait']);
    pose.vider();
    expect(faits).toEqual(['pose', 'retrait', 'pose', 'retrait']);
  });
});
