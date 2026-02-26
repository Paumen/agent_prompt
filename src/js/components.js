/**
 * Shared UI primitives.
 *
 * - renderShimmer: loading skeleton (GL-02)
 * - renderError: inline dismissible error (GL-04)
 * - showNotification: brief auto-dismiss toast (GL-05)
 * - createSearchableDropdown: mobile-first filter + list (SCT-06)
 */

/**
 * Render shimmer skeleton bars with contextual label.
 * Replaces container content.
 *
 * @param {HTMLElement} container
 * @param {string} label - e.g. "Loading repos…"
 * @param {number} [barCount=2] - number of shimmer bars to show
 */
export function renderShimmer(container, label, barCount = 2) {
  container.innerHTML = '';

  const labelEl = document.createElement('div');
  labelEl.className = 'shimmer-label';
  labelEl.textContent = label;
  container.appendChild(labelEl);

  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'shimmer shimmer-bar';
    container.appendChild(bar);
  }
}

/**
 * Render inline dismissible error message.
 * Appends to container (does not replace content).
 *
 * @param {HTMLElement} container
 * @param {string} message
 * @param {Function} [onRetry] - optional retry callback; shows Retry button when provided
 */
export function renderError(container, message, onRetry) {
  const el = document.createElement('div');
  el.className = 'error-inline';
  el.setAttribute('role', 'alert');

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  el.appendChild(msgSpan);

  const actions = document.createElement('span');
  actions.style.display = 'inline-flex';
  actions.style.gap = '4px';
  actions.style.flexShrink = '0';

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.style.cssText =
      'background:none;border:none;cursor:pointer;color:inherit;text-decoration:underline;font-size:inherit;padding:0';
    retryBtn.addEventListener('click', onRetry);
    actions.appendChild(retryBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn-dismiss';
  dismissBtn.textContent = '×';
  dismissBtn.setAttribute('aria-label', 'Dismiss error');
  dismissBtn.addEventListener('click', () => el.remove());
  actions.appendChild(dismissBtn);

  el.appendChild(actions);
  container.appendChild(el);
}

/**
 * Show brief notification that auto-removes after 2 seconds.
 * Replaces any existing notification in the container.
 *
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showNotification(container, message, type) {
  // Remove existing notification in this container
  const existing = container.querySelector('.notification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `notification notification--${type}`;
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => el.remove(), 2000);
}

/**
 * Create a mobile-first searchable dropdown.
 * Text input filters a scrollable list below it.
 *
 * @param {HTMLElement} container
 * @param {object} config
 * @param {{ value: string, label: string }[]} config.options
 * @param {Function} config.onSelect - called with selected option
 * @param {string} [config.placeholder]
 */
export function createSearchableDropdown(container, config) {
  const { options, onSelect, placeholder = '' } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown-wrapper';
  wrapper.style.position = 'relative';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-field dropdown-input';
  input.placeholder = placeholder;
  input.setAttribute('autocomplete', 'off');

  const list = document.createElement('div');
  list.className = 'dropdown-list';
  list.style.cssText =
    'display:none;position:absolute;left:0;right:0;top:100%;max-height:220px;overflow-y:auto;' +
    'background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius);' +
    'z-index:10;margin-top:2px';

  function renderList(filter = '') {
    list.innerHTML = '';
    const lowerFilter = filter.toLowerCase();
    const filtered = options.filter((o) =>
      o.label.toLowerCase().includes(lowerFilter)
    );

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = 'No matches';
      empty.style.cssText =
        'padding:8px 12px;color:var(--text-secondary);font-size:var(--text-sm)';
      list.appendChild(empty);
      return;
    }

    for (const opt of filtered) {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = opt.label;
      item.style.cssText =
        'padding:8px 12px;cursor:pointer;min-height:44px;display:flex;align-items:center;' +
        'font-size:var(--text-base)';
      item.addEventListener('click', () => {
        onSelect(opt);
        input.value = '';
        list.style.display = 'none';
      });
      list.appendChild(item);
    }
  }

  input.addEventListener('focus', () => {
    renderList(input.value);
    list.style.display = 'block';
  });

  input.addEventListener('input', () => {
    renderList(input.value);
    list.style.display = 'block';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      list.style.display = 'none';
    }
  });

  wrapper.appendChild(input);
  wrapper.appendChild(list);
  container.appendChild(wrapper);
}
