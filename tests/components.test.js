// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let components;

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="target"></div>';
  components = await import('../src/common/components.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('renderShimmer()', () => {
  it('renders shimmer bars with label, replaces container content', () => {
    const container = document.getElementById('target');
    container.innerHTML = '<p>Old</p>';
    components.renderShimmer(container, 'Loading…', 3);

    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelectorAll('.shimmer-bar').length).toBe(3);
    expect(container.querySelector('.shimmer-label').textContent).toBe(
      'Loading…'
    );
  });
});

describe('renderError()', () => {
  it('renders error with alert role, dismiss and optional retry', () => {
    const container = document.getElementById('target');
    container.innerHTML = '<p>Keep</p>';
    const onRetry = vi.fn();

    components.renderError(container, 'Failed', onRetry);

    const error = container.querySelector('.error-inline');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('Failed');
    expect(container.querySelector('p')).not.toBeNull(); // appends, doesn't replace

    container.querySelector('.btn-dismiss').click();
    expect(container.querySelector('.error-inline')).toBeNull();

    // With retry
    components.renderError(container, 'Retry test', onRetry);
    container.querySelector('.btn-retry').click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('no retry button when onRetry not provided', () => {
    const container = document.getElementById('target');
    components.renderError(container, 'No retry');
    expect(container.querySelector('.btn-retry')).toBeNull();
  });
});

describe('showNotification()', () => {
  it('shows notification with type class, aria-live, auto-removes, replaces existing', () => {
    vi.useFakeTimers();
    const container = document.getElementById('target');

    components.showNotification(container, 'First', 'success');
    let notif = container.querySelector('.notification');
    expect(notif.classList.contains('notification--success')).toBe(true);
    expect(notif.getAttribute('aria-live')).toBe('polite');

    // Replaces existing
    components.showNotification(container, 'Second', 'error');
    notif = container.querySelector('.notification');
    expect(container.querySelectorAll('.notification').length).toBe(1);
    expect(notif.classList.contains('notification--error')).toBe(true);

    // Auto-removes
    vi.advanceTimersByTime(2500);
    expect(container.querySelector('.notification')).toBeNull();
    vi.useRealTimers();
  });

  it('supports info type', () => {
    const container = document.getElementById('target');
    components.showNotification(container, 'Info', 'info');
    expect(
      container
        .querySelector('.notification')
        .classList.contains('notification--info')
    ).toBe(true);
  });
});

describe('setInteracting() / isInteracting()', () => {
  it('returns false initially, true after setInteracting, clears after 2s', () => {
    vi.useFakeTimers();
    expect(components.isInteracting()).toBe(false);

    components.setInteracting();
    expect(components.isInteracting()).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(components.isInteracting()).toBe(false);
    vi.useRealTimers();
  });

  it('resets timer on repeated calls', () => {
    vi.useFakeTimers();
    components.setInteracting();
    vi.advanceTimersByTime(1500);
    components.setInteracting();
    vi.advanceTimersByTime(1500);
    expect(components.isInteracting()).toBe(true);
    vi.advanceTimersByTime(500);
    expect(components.isInteracting()).toBe(false);
    vi.useRealTimers();
  });

  it('returns true when input or textarea has focus', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(components.isInteracting()).toBe(true);
    input.blur();

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    expect(components.isInteracting()).toBe(true);
    ta.blur();

    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(components.isInteracting()).toBe(false);
  });
});
