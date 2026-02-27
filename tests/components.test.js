// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let components;

beforeEach(async () => {
  vi.resetModules();
  vi.useRealTimers();
  document.body.innerHTML = '<div id="target"></div>';
  components = await import('../src/js/components.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

// ─── renderShimmer ───

describe('renderShimmer()', () => {
  it('renders shimmer bars into container', () => {
    const container = document.getElementById('target');
    components.renderShimmer(container, 'Loading repos…');
    expect(container.querySelector('.shimmer')).not.toBeNull();
  });

  it('shows contextual label', () => {
    const container = document.getElementById('target');
    components.renderShimmer(container, 'Loading repos…');
    expect(container.querySelector('.shimmer-label')).not.toBeNull();
    expect(container.querySelector('.shimmer-label').textContent).toBe(
      'Loading repos…'
    );
  });

  it('replaces existing container content', () => {
    const container = document.getElementById('target');
    container.innerHTML = '<p>Old content</p>';
    components.renderShimmer(container, 'Loading…');
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('.shimmer')).not.toBeNull();
  });

  it('renders multiple shimmer bars', () => {
    const container = document.getElementById('target');
    components.renderShimmer(container, 'Loading…', 3);
    const bars = container.querySelectorAll('.shimmer-bar');
    expect(bars.length).toBe(3);
  });
});

// ─── renderError ───

describe('renderError()', () => {
  it('renders error message with role="alert"', () => {
    const container = document.getElementById('target');
    components.renderError(container, 'Something went wrong');

    const error = container.querySelector('.error-inline');
    expect(error).not.toBeNull();
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('Something went wrong');
  });

  it('includes dismiss button', () => {
    const container = document.getElementById('target');
    components.renderError(container, 'Error!');

    const dismissBtn = container.querySelector('.btn-dismiss');
    expect(dismissBtn).not.toBeNull();
  });

  it('dismiss button removes the error element', () => {
    const container = document.getElementById('target');
    components.renderError(container, 'Error!');

    const dismissBtn = container.querySelector('.btn-dismiss');
    dismissBtn.click();

    expect(container.querySelector('.error-inline')).toBeNull();
  });

  it('calls onRetry callback when retry button clicked', () => {
    const container = document.getElementById('target');
    const onRetry = vi.fn();
    components.renderError(container, 'Failed to load', onRetry);

    const retryBtn = container.querySelector('.btn-retry');
    expect(retryBtn).not.toBeNull();
    retryBtn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when no onRetry provided', () => {
    const container = document.getElementById('target');
    components.renderError(container, 'Error!');

    const retryBtn = container.querySelector('.btn-retry');
    expect(retryBtn).toBeNull();
  });

  it('appends error without replacing container content', () => {
    const container = document.getElementById('target');
    container.innerHTML = '<p>Existing</p>';
    components.renderError(container, 'Error!');

    expect(container.querySelector('p')).not.toBeNull();
    expect(container.querySelector('.error-inline')).not.toBeNull();
  });
});

// ─── showNotification ───

describe('showNotification()', () => {
  it('shows notification with correct type class', () => {
    const container = document.getElementById('target');
    components.showNotification(container, 'Updated', 'success');

    const notif = container.querySelector('.notification');
    expect(notif).not.toBeNull();
    expect(notif.classList.contains('notification--success')).toBe(true);
    expect(notif.textContent).toContain('Updated');
  });

  it('sets aria-live="polite" for accessibility', () => {
    const container = document.getElementById('target');
    components.showNotification(container, 'Updated', 'success');

    const notif = container.querySelector('.notification');
    expect(notif.getAttribute('aria-live')).toBe('polite');
  });

  it('auto-removes after timeout', () => {
    vi.useFakeTimers();
    const container = document.getElementById('target');
    components.showNotification(container, 'Updated', 'success');

    expect(container.querySelector('.notification')).not.toBeNull();
    vi.advanceTimersByTime(2500);
    expect(container.querySelector('.notification')).toBeNull();
  });

  it('supports error type', () => {
    const container = document.getElementById('target');
    components.showNotification(container, 'Failed', 'error');

    const notif = container.querySelector('.notification');
    expect(notif.classList.contains('notification--error')).toBe(true);
  });

  it('supports info type', () => {
    const container = document.getElementById('target');
    components.showNotification(container, 'Info', 'info');

    const notif = container.querySelector('.notification');
    expect(notif.classList.contains('notification--info')).toBe(true);
  });

  it('replaces existing notification in same container', () => {
    const container = document.getElementById('target');
    components.showNotification(container, 'First', 'success');
    components.showNotification(container, 'Second', 'info');

    const notifs = container.querySelectorAll('.notification');
    expect(notifs.length).toBe(1);
    expect(notifs[0].textContent).toContain('Second');
  });
});

// ─── createSearchableDropdown ───

describe('createSearchableDropdown()', () => {
  const options = [
    { value: 'src/main.js', label: 'src/main.js' },
    { value: 'src/utils.js', label: 'src/utils.js' },
    { value: 'README.md', label: 'README.md' },
  ];

  it('renders input field and hidden list', () => {
    const container = document.getElementById('target');
    components.createSearchableDropdown(container, {
      options,
      onSelect: vi.fn(),
      placeholder: 'Search files…',
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input.getAttribute('placeholder')).toBe('Search files…');
  });

  it('shows list on input focus', () => {
    const container = document.getElementById('target');
    components.createSearchableDropdown(container, {
      options,
      onSelect: vi.fn(),
    });

    const input = container.querySelector('input');
    input.dispatchEvent(new Event('focus'));

    const list = container.querySelector('.dropdown-list');
    expect(list.children.length).toBe(3);
  });

  it('filters options as user types', () => {
    const container = document.getElementById('target');
    components.createSearchableDropdown(container, {
      options,
      onSelect: vi.fn(),
    });

    const input = container.querySelector('input');
    input.dispatchEvent(new Event('focus'));
    input.value = 'utils';
    input.dispatchEvent(new Event('input'));

    const items = container.querySelectorAll('.dropdown-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('utils');
  });

  it('calls onSelect when option is clicked', () => {
    const container = document.getElementById('target');
    const onSelect = vi.fn();
    components.createSearchableDropdown(container, {
      options,
      onSelect,
    });

    const input = container.querySelector('input');
    input.dispatchEvent(new Event('focus'));

    const items = container.querySelectorAll('.dropdown-item');
    items[1].click();

    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it('has touch-friendly item class (min-height 44px defined in CSS)', () => {
    const container = document.getElementById('target');
    components.createSearchableDropdown(container, {
      options,
      onSelect: vi.fn(),
    });

    const input = container.querySelector('input');
    input.dispatchEvent(new Event('focus'));

    const item = container.querySelector('.dropdown-item');
    expect(item.classList.contains('dropdown-item')).toBe(true);
  });

  it('shows empty state when no options match', () => {
    const container = document.getElementById('target');
    components.createSearchableDropdown(container, {
      options,
      onSelect: vi.fn(),
    });

    const input = container.querySelector('input');
    input.dispatchEvent(new Event('focus'));
    input.value = 'zzzzzzz';
    input.dispatchEvent(new Event('input'));

    const emptyMsg = container.querySelector('.dropdown-empty');
    expect(emptyMsg).not.toBeNull();
  });
});

// ─── setInteracting / isInteracting (GL-05) ───

describe('setInteracting() / isInteracting()', () => {
  it('isInteracting() returns false when nothing is happening', () => {
    // Fresh module import from beforeEach
    expect(components.isInteracting()).toBe(false);
  });

  it('isInteracting() returns true immediately after setInteracting()', () => {
    vi.useFakeTimers();
    components.setInteracting();
    expect(components.isInteracting()).toBe(true);
    vi.useRealTimers();
  });

  it('isInteracting() clears to false after 2 seconds', () => {
    vi.useFakeTimers();
    components.setInteracting();
    expect(components.isInteracting()).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(components.isInteracting()).toBe(false);
    vi.useRealTimers();
  });

  it('setInteracting() resets the 2s timer on repeated calls', () => {
    vi.useFakeTimers();
    components.setInteracting();
    vi.advanceTimersByTime(1500);
    components.setInteracting(); // reset — should be still interacting after another 1.5s
    vi.advanceTimersByTime(1500);
    expect(components.isInteracting()).toBe(true);
    vi.advanceTimersByTime(500); // now total 2s since last call
    expect(components.isInteracting()).toBe(false);
    vi.useRealTimers();
  });

  it('isInteracting() returns true when an input has focus', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(components.isInteracting()).toBe(true);
    input.blur();
    document.body.removeChild(input);
  });

  it('isInteracting() returns true when a textarea has focus', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    expect(components.isInteracting()).toBe(true);
    ta.blur();
    document.body.removeChild(ta);
  });

  it('isInteracting() returns false when focus is on a non-input element', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(components.isInteracting()).toBe(false);
    document.body.removeChild(btn);
  });
});
