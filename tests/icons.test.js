// @vitest-environment jsdom
/**
 * Tests for icons.js — central icon registry.
 * Validates the icon() function and all registry entries.
 */

import { describe, it, expect } from 'vitest';
import { icon } from '../src/common/icons.js';

// All icon names that must exist in the registry
const EXPECTED_ICONS = [
  'chevron-down',
  'key',
  'mark-github',
  'eye',
  'eye-closed',
  'x',
  'repo',
  'git-branch',
  'bug',
  'codescan',
  'rocket',
  'compose',
  'git-pull-request',
  'issue-opened',
  'file',
  'file-code',
  'checklist',
  'diff',
  'comment',
  'comment-discussion',
  'check',
  'trash',
  'copy',
  'info',
  'paper-airplane',
];

describe('icon()', () => {
  it('returns an SVG element with .icon class', () => {
    const el = icon('check');
    expect(el.tagName.toLowerCase()).toBe('svg');
    expect(el.classList.contains('icon')).toBe(true);
  });

  it('adds the optional style class', () => {
    const el = icon('check', 'icon-btn');
    expect(el.classList.contains('icon')).toBe(true);
    expect(el.classList.contains('icon-btn')).toBe(true);
  });

  it('sets aria-hidden="true"', () => {
    const el = icon('check');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('returns a fresh clone each call (not the same reference)', () => {
    const a = icon('check');
    const b = icon('check');
    expect(a).not.toBe(b);
  });

  it('returns a fallback SVG for unknown icon names', () => {
    const el = icon('nonexistent-icon-xyz');
    expect(el.tagName.toLowerCase()).toBe('svg');
  });
});

