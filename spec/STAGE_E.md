Phase 1: Layout & CSS Refactoring (Low Risk / Visuals)
Isolate pure CSS and minor DOM attribute changes. This prevents logic regressions while achieving the desired visual density.
 * Step 1.1: Update .output-field grid template in src/css/layout.css to force horizontal alignment of sub-items (e.g., grid-template-columns: auto max-content 1fr auto) instead of the current row-wrapping behavior.
 * Step 1.2: In src/cards/card-steps.js (renderOptionalTextRow), remove the <label> elements entirely.

Phase 2: Architectural Data Model Shift (High Risk / Unconventional)
You must update the state.steps.enabled_steps schema to support storing nested user-selected files and issues directly on the step objects, and update reconcileSteps in src/logic/step-generator.js to preserve these local step states across flow regenerations.
 * Step 2.1: Update src/core/state.js DEFAULT_STATE.steps.enabled_steps schema to support nested arrays for step-specific files and issues.
 * Step 2.2: Rewrite reconcileSteps in src/logic/step-generator.js to map and persist user-selected files, lenses, and issues on a per-step basis across regenerations.
 * Step 2.3: Inject the createFilePicker and createPicker (for issues) directly into the renderStepRow function in src/cards/card-steps.js, conditionally showing them based on the step's id (e.g., validate-tests, analyze-files).

Phase 3: Local Storage & Config State (Low Risk / Foundation)
Execute state persistence and simple boolean flags first to establish the data foundation without impacting complex DOM logic.
 * Step 3.1: Update PERSISTENT_KEYS in src/core/state.js to include configuration.repo.
 * Step 3.2: Modify initConfigurationCard in src/cards/card-configuration.js to auto-fetch branches and trigger step generation if a cached repo exists alongside the PAT and owner.
 * Step 3.3: Add include_repo and include_pat (default true) to the DEFAULT_STATE.configuration object.
 * Step 3.4: Update buildPrompt in src/core/prompt-builder.js to wrap the <repository> and <PAT> string pushes in conditionals checking those new flags.
 * Step 3.5: Prepend a hardcoded "Step 0" rendering function in src/cards/card-steps.js that acts as a UI toggle for the include_repo and include_pat state flags created in Phase 1.
