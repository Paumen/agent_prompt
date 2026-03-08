# Test Helpers

This directory contains shared utilities to improve test maintenance stability.

## Files

### `state-factory.js`

Centralized mock state factory. Use this instead of creating inline mock state objects.

### `dom-fixtures.js`

Shared DOM fixtures for card HTML templates.

## Test Boundaries

To maintain orthogonality, each test file should focus on its specific responsibility:

| Test File | Responsibility | Should NOT Test |
|-----------|---------------|-----------------|
| `github-api.test.js` | API contracts, HTTP handling | UI behavior, state updates |
| `step-generator.test.js` | Step generation logic | UI rendering, state persistence |
| `cache.test.js` | Cache TTL, storage contract | Business logic |
| `prompt-builder.test.js` | Prompt generation algorithm | DOM, state persistence |
| `state.test.js` | State management contract | UI rendering |
| `flow-loader.test.js` | Flow loading/validation | UI, state |
| `card-*.test.js` | Card UI behavior | Pure logic (use unit tests) |
| `e2e.test.js` | User journeys | Individual unit behaviors |
