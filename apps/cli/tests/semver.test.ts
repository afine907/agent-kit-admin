/**
 * semver 版本约束解析测试
 */
import { describe, it, expect } from 'vitest';
import { satisfiesSemverConstraint } from '../src/utils/semver';

describe('satisfiesSemverConstraint', () => {
  it('^1.0.0 应匹配 1.0.0', () => {
    expect(satisfiesSemverConstraint('1.0.0', '^1.0.0')).toBe(true);
  });

  it('^1.0.0 应匹配 1.5.0', () => {
    expect(satisfiesSemverConstraint('1.5.0', '^1.0.0')).toBe(true);
  });

  it('^1.0.0 应匹配 1.9.9', () => {
    expect(satisfiesSemverConstraint('1.9.9', '^1.0.0')).toBe(true);
  });

  it('^1.0.0 不应匹配 2.0.0', () => {
    expect(satisfiesSemverConstraint('2.0.0', '^1.0.0')).toBe(false);
  });

  it('^1.0.0 不应匹配 0.9.0', () => {
    expect(satisfiesSemverConstraint('0.9.0', '^1.0.0')).toBe(false);
  });

  it('~1.0.0 应匹配 1.0.5', () => {
    expect(satisfiesSemverConstraint('1.0.5', '~1.0.0')).toBe(true);
  });

  it('~1.0.0 不应匹配 1.1.0', () => {
    expect(satisfiesSemverConstraint('1.1.0', '~1.0.0')).toBe(false);
  });

  it('>=2.0.0 应匹配 2.0.0', () => {
    expect(satisfiesSemverConstraint('2.0.0', '>=2.0.0')).toBe(true);
  });

  it('>=2.0.0 应匹配 3.0.0', () => {
    expect(satisfiesSemverConstraint('3.0.0', '>=2.0.0')).toBe(true);
  });

  it('>=2.0.0 不应匹配 1.0.0', () => {
    expect(satisfiesSemverConstraint('1.0.0', '>=2.0.0')).toBe(false);
  });

  it('>=1.0.0 <2.0.0 应匹配 1.5.0', () => {
    expect(satisfiesSemverConstraint('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
  });

  it('>=1.0.0 <2.0.0 不应匹配 2.0.0', () => {
    expect(satisfiesSemverConstraint('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
  });

  it('* 应匹配任意版本', () => {
    expect(satisfiesSemverConstraint('99.99.99', '*')).toBe(true);
  });

  it('latest 约束应始终返回 true', () => {
    expect(satisfiesSemverConstraint('1.0.0', 'latest')).toBe(true);
  });

  it('空约束应返回 true', () => {
    expect(satisfiesSemverConstraint('1.0.0', '')).toBe(true);
  });

  it('x 在 ^1.x 中应匹配任何 minor/patch', () => {
    expect(satisfiesSemverConstraint('1.5.0', '^1.x')).toBe(true);
  });

  it('^1.x 不应匹配 2.0.0', () => {
    expect(satisfiesSemverConstraint('2.0.0', '^1.x')).toBe(false);
  });

  it('invalid version 应返回 false', () => {
    expect(satisfiesSemverConstraint('not-a-version', '^1.0.0')).toBe(false);
  });

  it('invalid constraint 应返回 false', () => {
    expect(satisfiesSemverConstraint('1.0.0', 'not-a-constraint')).toBe(false);
  });

  it('pre-release 版本不应被 ^ 匹配', () => {
    expect(satisfiesSemverConstraint('2.0.0-alpha', '^1.0.0')).toBe(false);
  });
});
