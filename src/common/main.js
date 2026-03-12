import { getState } from '../core/state.js';
import { initConfigurationCard } from '../cards/card-configuration.js';
import { initStepsCard } from '../cards/card-steps.js';
import { initPromptCard } from '../cards/card-prompt.js';
import { icon } from './icons.js';

// --- Chevron icon init (D107) ---

function initChevrons() {
  const summaries = document.querySelectorAll('summary.card-header');
  for (const summary of summaries) {
    const chevron = icon('chevron-down', 'icon-btn');
    chevron.classList.add('icon--chevron');
    summary.appendChild(chevron);
  }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  initChevrons();

  // State is already initialized (hydrated from localStorage on import).
  const initial = getState();
  if (initial.configuration.owner) {
    console.log('Hydrated user:', initial.configuration.owner);
  }

  // Initialize Card 1: Configuration
  initConfigurationCard();

  // Initialize Card 2: Steps
  initStepsCard();

  // Initialize Card 4: Prompt
  initPromptCard();


});

export { initChevrons };
