/**
 * preview.js — Standalone component preview for ui.js factory functions.
 *
 * Renders every ui.js component into the preview.html page so the PO
 * can visually review the design system in isolation.
 */

import {
  createButton,
  createInputField,
  createPicker,
  createTag,
  createButtonGrid,
  createMoreLess,
  createLabel,
} from './ui.js';

// ── Helpers ──────────────────────────────────────────────────

const logEl = document.getElementById('log');

function log(msg) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function heading(text) {
  const h2 = document.createElement('h2');
  h2.textContent = text;
  return h2;
}

function subheading(text) {
  const h3 = document.createElement('h3');
  h3.textContent = text;
  return h3;
}

function row(...els) {
  const div = document.createElement('div');
  div.className = 'preview-row';
  for (const el of els) div.appendChild(el);
  return div;
}

function label(text) {
  const span = document.createElement('span');
  span.className = 'preview-label';
  span.textContent = text;
  return span;
}

// ── 1. Buttons ───────────────────────────────────────────────

function renderButtons(section) {
  section.appendChild(heading('Buttons — createButton(type, options)'));

  // btn-primary
  section.appendChild(subheading('btn-primary'));
  section.appendChild(
    row(
      label('default'),
      createButton('primary', {
        label: 'Generate Prompt',
        iconName: 'paper-airplane',
        onClick: () => log('btn-primary clicked'),
      })
    )
  );

  // btn-select
  section.appendChild(subheading('btn-select'));
  section.appendChild(
    row(
      label('unselected'),
      createButton('select', {
        label: 'Bug Fix',
        iconName: 'bug',
        onClick: () => log('btn-select (unselected) clicked'),
      }),
      label('selected'),
      createButton('select', {
        label: 'Code Review',
        iconName: 'codescan',
        selected: true,
        onClick: () => log('btn-select (selected) clicked'),
      })
    )
  );

  // btn-action
  section.appendChild(subheading('btn-action'));
  section.appendChild(
    row(
      label('default'),
      createButton('action', {
        label: 'Copy',
        iconName: 'copy',
        onClick: () => log('btn-action clicked'),
      }),
      createButton('action', {
        label: 'Reset',
        iconName: 'trash',
        onClick: () => log('btn-action "Reset" clicked'),
      })
    )
  );

  // btn-pill
  section.appendChild(subheading('btn-pill'));
  section.appendChild(
    row(
      label('off'),
      createButton('pill', {
        label: 'TypeScript',
        onClick: () => log('btn-pill (off) clicked'),
      }),
      label('on'),
      createButton('pill', {
        label: 'JavaScript',
        selected: true,
        onClick: () => log('btn-pill (on) clicked'),
      })
    )
  );

  // btn-icon
  section.appendChild(subheading('btn-icon'));
  section.appendChild(
    row(
      label('icon-only'),
      createButton('icon', {
        iconName: 'info',
        ariaLabel: 'More info',
        onClick: () => log('btn-icon clicked'),
      }),
      createButton('icon', {
        iconName: 'trash',
        ariaLabel: 'Delete',
        onClick: () => log('btn-icon "trash" clicked'),
      }),
      createButton('icon', {
        iconName: 'copy',
        ariaLabel: 'Copy',
        onClick: () => log('btn-icon "copy" clicked'),
      }),
      label('with label'),
      createButton('icon', {
        iconName: 'eye',
        label: 'Preview',
        onClick: () => log('btn-icon labeled clicked'),
      })
    )
  );
}

// ── 2. Input Fields ──────────────────────────────────────────

function renderInputs(section) {
  section.appendChild(heading('Input Fields — createInputField(options)'));

  // Text input
  section.appendChild(subheading('Text input'));
  const textInput = createInputField({
    placeholder: 'Enter your GitHub PAT…',
    type: 'text',
    onInput: (e) => log(`text input: "${e.target.value}"`),
  });
  section.appendChild(textInput);

  // Password input
  section.appendChild(subheading('Password input'));
  const pwInput = createInputField({
    placeholder: 'ghp_xxxxxxxxxxxx',
    type: 'password',
    onInput: (e) => log(`password input: ${e.target.value.length} chars`),
  });
  section.appendChild(pwInput);

  // Textarea
  section.appendChild(subheading('Textarea'));
  const textarea = createInputField({
    placeholder: 'Add notes here…',
    type: 'textarea',
    rows: 3,
    onInput: (e) => log(`textarea: ${e.target.value.length} chars`),
  });
  section.appendChild(textarea);

  // Input with icon
  section.appendChild(subheading('Input with search icon'));
  const iconInput = createInputField({
    placeholder: 'Search files…',
    iconName: 'codescan',
    onInput: (e) => log(`search input: "${e.target.value}"`),
  });
  section.appendChild(iconInput);
}

// ── 3. Labels ────────────────────────────────────────────────

function renderLabels(section) {
  section.appendChild(heading('Labels — createLabel(text, options)'));

  section.appendChild(
    row(label('standard'), createLabel('Repository'), createLabel('Branch'))
  );

  section.appendChild(
    row(
      label('required'),
      createLabel('GitHub PAT', { required: true }),
      createLabel('Username', { required: true })
    )
  );
}

// ── 4. Tags ──────────────────────────────────────────────────

function renderTags(section) {
  section.appendChild(heading('Tags — createTag(options)'));

  section.appendChild(
    row(
      label('with remove'),
      createTag({
        label: 'src/main.js',
        iconName: 'file',
        title: 'src/main.js',
        onRemove: () => log('tag "src/main.js" removed'),
      }),
      createTag({
        label: 'package.json',
        iconName: 'file-code',
        title: 'package.json',
        onRemove: () => log('tag "package.json" removed'),
      }),
      createTag({
        label: 'a-very-long-filename-that-truncates.test.js',
        iconName: 'file',
        title: 'a-very-long-filename-that-truncates.test.js',
        onRemove: () => log('long tag removed'),
      })
    )
  );

  section.appendChild(
    row(
      label('no remove'),
      createTag({ label: 'read-only tag', title: 'This tag cannot be removed' })
    )
  );
}

// ── 5. Button Grid ───────────────────────────────────────────

function renderButtonGrid(section) {
  section.appendChild(
    heading('Button Grid — createButtonGrid(buttons, options)')
  );

  // Flow selector style (select buttons)
  section.appendChild(subheading('Select grid (flow selector)'));
  const flowButtons = [
    {
      label: 'Bug Fix',
      iconName: 'bug',
      selected: false,
      onClick: () => log('flow: Bug Fix'),
    },
    {
      label: 'Code Review',
      iconName: 'codescan',
      selected: true,
      onClick: () => log('flow: Code Review'),
    },
    {
      label: 'New Feature',
      iconName: 'rocket',
      selected: false,
      onClick: () => log('flow: New Feature'),
    },
    {
      label: 'PR Description',
      iconName: 'git-pull-request',
      selected: false,
      onClick: () => log('flow: PR Description'),
    },
  ];
  section.appendChild(
    createButtonGrid(flowButtons, {
      buttonType: 'select',
      ariaLabel: 'Select a flow',
    })
  );

  // Pill grid (multi-select lenses)
  section.appendChild(subheading('Pill grid (lens toggles)'));
  const lensButtons = [
    {
      label: 'Security',
      selected: true,
      onClick: () => log('lens: Security'),
    },
    {
      label: 'Performance',
      selected: false,
      onClick: () => log('lens: Performance'),
    },
    {
      label: 'Readability',
      selected: true,
      onClick: () => log('lens: Readability'),
    },
    { label: 'Testing', selected: false, onClick: () => log('lens: Testing') },
  ];
  section.appendChild(
    createButtonGrid(lensButtons, {
      buttonType: 'pill',
      role: 'group',
      ariaLabel: 'Toggle lenses',
    })
  );
}

// ── 6. More/Less Toggle ──────────────────────────────────────

function renderMoreLess(section) {
  section.appendChild(heading('More/Less — createMoreLess(options)'));

  section.appendChild(subheading('Basic'));
  section.appendChild(
    createMoreLess({
      hiddenCount: 5,
      onToggle: (expanded) => log(`more/less toggled: ${expanded}`),
    })
  );

  section.appendChild(subheading('With active label'));
  section.appendChild(
    createMoreLess({
      hiddenCount: 8,
      activeLabel: '3 active',
      onToggle: (expanded) =>
        log(`more/less (with active) toggled: ${expanded}`),
    })
  );
}

// ── 7. Picker ────────────────────────────────────────────────

function renderPicker(section) {
  section.appendChild(heading('Picker — createPicker(options)'));

  const sampleItems = [
    { value: 'src/main.js', label: 'src/main.js' },
    { value: 'src/ui.js', label: 'src/ui.js' },
    { value: 'src/state.js', label: 'src/state.js' },
    { value: 'package.json', label: 'package.json' },
    { value: 'README.md', label: 'README.md' },
    { value: 'tests/ui.test.js', label: 'tests/ui.test.js' },
  ];

  const selectedValues = ['src/main.js', 'package.json'];

  section.appendChild(subheading('Multi-select picker'));
  section.appendChild(
    createPicker({
      items: sampleItems,
      selected: selectedValues,
      multiSelect: true,
      placeholder: 'Search files…',
      searchIconName: 'codescan',
      onSelect: (item) => log(`picker selected: ${item.label}`),
      onRemove: (val) => log(`picker removed: ${val}`),
    })
  );

  section.appendChild(subheading('Single-select picker'));
  section.appendChild(
    createPicker({
      items: [
        { value: 'main', label: 'main' },
        { value: 'develop', label: 'develop' },
        { value: 'feature/auth', label: 'feature/auth' },
        { value: 'fix/typo', label: 'fix/typo' },
      ],
      placeholder: 'Search branches…',
      searchIconName: 'git-branch',
      onSelect: (item) => log(`branch selected: ${item.label}`),
    })
  );
}

// ── 8. Layout Grid Demo ─────────────────────────────────────

function renderLayout(section) {
  section.appendChild(heading('Layout Classes — Grid Demo'));
  section.appendChild(subheading('v2-input (label + field)'));

  const inputRow = document.createElement('div');
  inputRow.className = 'v2-input';

  const lbl = createLabel('PAT', { required: true });
  const field = createInputField({
    placeholder: 'ghp_xxxx',
    type: 'password',
  });

  inputRow.appendChild(lbl);
  inputRow.appendChild(field);
  section.appendChild(inputRow);

  // Second input row
  const inputRow2 = document.createElement('div');
  inputRow2.className = 'v2-input';

  const lbl2 = createLabel('Username');
  const field2 = createInputField({ placeholder: 'octocat' });

  inputRow2.appendChild(lbl2);
  inputRow2.appendChild(field2);
  section.appendChild(inputRow2);

  section.appendChild(subheading('v2-card-in-card'));

  const cardInCard = document.createElement('div');
  cardInCard.className = 'v2-card-in-card v2-card-in-card--open';

  const cicHeader = document.createElement('div');
  cicHeader.style.fontWeight = '700';
  cicHeader.style.fontSize = 'var(--text)';
  cicHeader.textContent = 'Panel A — Field Inputs';
  cardInCard.appendChild(cicHeader);

  const innerInput = document.createElement('div');
  innerInput.className = 'v2-input';
  innerInput.appendChild(createLabel('Notes'));
  innerInput.appendChild(
    createInputField({
      type: 'textarea',
      placeholder: 'Additional context…',
      rows: 2,
    })
  );
  cardInCard.appendChild(innerInput);

  section.appendChild(cardInCard);
}

// ── Render all sections ──────────────────────────────────────

renderButtons(document.getElementById('section-buttons'));
renderInputs(document.getElementById('section-inputs'));
renderLabels(document.getElementById('section-labels'));
renderTags(document.getElementById('section-tags'));
renderButtonGrid(document.getElementById('section-button-grid'));
renderMoreLess(document.getElementById('section-more-less'));
renderPicker(document.getElementById('section-picker'));
renderLayout(document.getElementById('section-layout'));

log('All components rendered.');
