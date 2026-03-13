/**
 * Centralized DOM fixtures for tests.
 * Improves maintenance stability by providing a single source of truth
 * for HTML structure. If the DOM structure evolves, only this file needs updating.
 */

/**
 * Create the full app HTML structure for E2E tests.
 * Includes all cards in the expected order.
 *
 * @returns {void} Sets document.body.innerHTML
 */
export function setupFullHTML() {
  document.body.innerHTML = `
    <main id="app">
      <details class="card" id="card-configuration" open>
        <summary class="card-header">
          <h3>Configuration</h3>
          <span class="card-meta"></span>
        </summary>
        <div class="card-body" id="bd-configuration"></div>
      </details>
      <details class="card" id="card-steps">
        <summary class="card-header">
          <h3>Steps</h3>
          <span class="card-meta"></span>
        </summary>
        <div class="card-body" id="bd-steps"></div>
      </details>
      <details class="card" id="card-prompt">
        <summary class="card-header">
          <h3>Prompt</h3>
          <span class="card-meta"></span>
        </summary>
        <div class="card-body" id="bd-prompt"></div>
      </details>
    </main>
  `;
}

/**
 * Create the configuration card HTML.
 */
export function setupConfigurationCard() {
  document.body.innerHTML = `
    <main id="app">
      <details class="card" id="card-configuration" open>
        <summary class="card-header"><h3>Configuration</h3><span class="card-meta"></span></summary>
        <div class="card-body" id="bd-configuration"></div>
      </details>
    </main>
  `;
}

/**
 * Create the steps card HTML.
 */
export function setupStepsCard() {
  document.body.innerHTML = `
    <details class="card" id="card-steps">
      <summary class="card-header"><h3>Steps</h3><span class="card-meta"></span></summary>
      <div class="card-body" id="bd-steps"></div>
    </details>
  `;
}

/**
 * Create the prompt card HTML.
 */
export function setupPromptCard() {
  document.body.innerHTML = `
    <details class="card" id="card-prompt">
      <summary class="card-header">
        <h3>Prompt</h3>
        <span class="card-meta"></span>
      </summary>
      <div class="card-body" id="bd-prompt"></div>
    </details>
  `;
}

/**
 * Create a generic container for component tests.
 *
 * @param {string} id - Container ID (default: 'target')
 * @returns {HTMLElement} The container element
 */
export function setupContainer(id = "target") {
  document.body.innerHTML = `<div id="${id}"></div>`;
  return document.getElementById(id);
}

/**
 * Clear the document body after each test.
 */
export function cleanupDOM() {
  document.body.innerHTML = "";
}
