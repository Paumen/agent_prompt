import { getState } from './state.js';

// --- Card expand/collapse toggle ---

function initCardToggles() {
  const headers = document.querySelectorAll('.card-header');
  for (const header of headers) {
    header.addEventListener('click', () => {
      const card = header.closest('.card');
      const isOpen = card.classList.toggle('card--open');
      header.setAttribute('aria-expanded', String(isOpen));
    });
  }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  initCardToggles();

  // State is already initialized (hydrated from localStorage on import).
  // Log initial state for development visibility.
  const initial = getState();
  if (initial.configuration.owner) {
    console.log('Hydrated user:', initial.configuration.owner);
  }
});

export { initCardToggles };
