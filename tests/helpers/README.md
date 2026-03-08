# Test Helpers

This directory contains shared utilities to improve test maintenance stability.

## Files

### `state-factory.js`

Centralized mock state factory. Use this instead of creating inline mock state objects.

**Benefits:**
- Single source of truth for state shape
- If the state model evolves, only this file needs updating
- Consistent test data across all test files

**Usage:**

```javascript
import { createMockState, createConfiguredState, createMockSteps } from './helpers/state-factory.js';

// Basic state with defaults
const state = createMockState();

// State with overrides
const state = createMockState({
  task: { flow_id: 'fix' },
  panel_a: { description: 'Bug description' },
});

// Pre-configured state for common scenarios
const state = createConfiguredState({ flowId: 'review' });

// Mock steps for step-related tests
const steps = createMockSteps(3);
```

### `dom-fixtures.js`

Shared DOM fixtures for card HTML templates.

**Benefits:**
- If DOM structure evolves, only this file needs updating
- Consistent HTML across component tests

**Usage:**

```javascript
import { setupFullHTML, setupStepsCard, cleanupDOM } from './helpers/dom-fixtures.js';

beforeEach(() => {
  setupFullHTML(); // Full app structure
});

afterEach(() => {
  cleanupDOM();
});
```

## Test Boundaries

To maintain orthogonality, each test file should focus on its specific responsibility:

| Test File | Responsibility | Should NOT Test |
|-----------|---------------|-----------------|
| `github-api.test.js` | API contracts, HTTP handling | UI behavior, state updates |
| `quality-meter.test.js` | Score calculation algorithm | DOM rendering |
| `step-generator.test.js` | Step generation logic | UI rendering, state persistence |
| `cache.test.js` | Cache TTL, storage contract | Business logic |
| `prompt-builder.test.js` | Prompt generation algorithm | DOM, state persistence |
| `state.test.js` | State management contract | UI rendering |
| `icons.test.js` | Icon registry contract | Icon appearance |
| `flow-loader.test.js` | Flow loading/validation | UI, state |
| `card-*.test.js` | Card UI behavior | Pure logic (use unit tests) |
| `e2e.test.js` | User journeys | Individual unit behaviors |
