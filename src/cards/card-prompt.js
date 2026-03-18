/**
 * Card 3: Prompt Output
 *
 * Live prompt preview, copy to clipboard, deep-link to Claude with prompt
 * pre-filled, dual description textareas (panel_a / panel_b).
 *
 * Req IDs: OUT-01..08
 */

import { getState, setState, subscribe } from "../core/state.js";
import { getFlowById } from "../logic/flow-loader.js";
import { escapeXml } from "../core/prompt-builder.js";
import { icon } from "../common/icons.js";
import { createButton, createInputField, createLabel } from "../common/ui.js";

// --- Module-level references ---

let elBody = null;
let elPreview = null;
let copyBtn = null;

// Description field references
let elDescA = null;
let elDescB = null;
let elLabelA = null;
let elLabelB = null;
let lastFlowId = null;

// --- XML Syntax Highlighting ---

export function highlightXml(text) {
  const escaped = escapeXml(text);

  return escaped.replace(
    /&lt;\/?[\w][\w.-]*(?:\s[^&]*?)?&gt;/g,
    '<span class="xml-tag">$&</span>',
  );
}

// --- Rendering ---

function renderPromptCard() {
  if (!elBody) return;

  const state = getState();
  const prompt = state._prompt || "";

  if (elPreview) {
    if (prompt) {
      elPreview.innerHTML = highlightXml(prompt);
    } else {
      elPreview.textContent = "Select a flow to generate a prompt.";
    }
  }

  // Update description values only when not actively editing
  if (elDescA && elDescA !== document.activeElement) {
    elDescA.value = state.panel_a?.description || "";
  }
  if (elDescB && elDescB !== document.activeElement) {
    elDescB.value = state.panel_b?.description || "";
  }

  // Update labels/placeholders when flow changes
  const flowId = state.task?.flow_id || null;
  if (flowId !== lastFlowId) {
    lastFlowId = flowId;
    updateDescriptionLabels(flowId);
  }
}

function updateDescriptionLabels(flowId) {
  const flowDef = flowId ? getFlowById(flowId) : null;

  if (elLabelA) {
    elLabelA.textContent = flowDef?.panel_a?.label || "Situation";
  }
  if (elDescA) {
    elDescA.placeholder =
      flowDef?.panel_a?.fields?.description?.placeholder || "";
  }

  if (elLabelB) {
    elLabelB.textContent = flowDef?.panel_b?.label || "Target";
  }
  if (elDescB) {
    elDescB.placeholder =
      flowDef?.panel_b?.fields?.description?.placeholder || "";
  }
}

// --- Event handlers ---

function onCopy() {
  const state = getState();
  const prompt = state._prompt || "";
  if (!prompt) return;

  navigator.clipboard.writeText(prompt).then(
    () => {
      if (copyBtn) {
        copyBtn.classList.add("btn--copied");
        setTimeout(() => copyBtn?.classList.remove("btn--copied"), 2000);
      }
    },
    () => {},
  );
}

// OUT-07: deep-link to Claude with prompt pre-filled
function onPromptClaude() {
  const state = getState();
  const prompt = state._prompt || "";
  const url = prompt
    ? `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
    : "https://claude.ai/new";
  window.open(url, "_blank", "noopener,noreferrer");
}

// --- Initialization ---

export function initPromptCard() {
  elBody = document.getElementById("bd-prompt");
  if (!elBody) return;

  // === Prompt preview ===
  const preEl = document.createElement("pre");
  preEl.className = "prompt-output";
  preEl.setAttribute("role", "region");
  preEl.setAttribute("aria-label", "Generated prompt");

  // Code element holds the text content (survives action bar)
  elPreview = document.createElement("code");
  preEl.appendChild(elPreview);

  // Copy button: dual icons (clipboard → check on copy)
  copyBtn = createButton("action", { onClick: onCopy });
  copyBtn.classList.add("btn-copy");
  copyBtn.textContent = ""; // clear default
  const clipboardIcon = icon("copy", "icon-btn");
  clipboardIcon.classList.add("icon-clipboard");
  const checkIcon = icon("check", "icon-btn");
  checkIcon.classList.add("icon-check");
  copyBtn.appendChild(clipboardIcon);
  copyBtn.appendChild(checkIcon);
  copyBtn.appendChild(document.createTextNode(" Copy"));

  // Prompt Claude button
  const promptClaudeBtn = createButton("primary", {
    label: " Prompt Claude",
    iconName: "paper-airplane",
    onClick: onPromptClaude,
    title:
      "Open Claude in a new tab with this prompt pre-filled in the chat input",
  });

  // Add buttons to card-header; hide unused card-meta
  const cardHeader = document.querySelector("#card-prompt .card-header");
  const cardMeta = cardHeader?.querySelector(".card-meta");
  if (cardHeader) {
    if (cardMeta) cardMeta.remove();
    cardHeader.insertBefore(
      copyBtn,
      cardHeader.querySelector(".icon--chevron"),
    );
    cardHeader.insertBefore(
      promptClaudeBtn,
      cardHeader.querySelector(".icon--chevron"),
    );
  }

  // === Description fields (panel_a + panel_b) ===
  const descRowA = document.createElement("div");
  descRowA.className = "input";
  elLabelA = createLabel("Situation");
  descRowA.appendChild(elLabelA);
  elDescA = createInputField({
    type: "textarea",
    rows: 3,
    onInput: () => setState("panel_a.description", elDescA.value),
  });
  descRowA.appendChild(elDescA);

  const descRowB = document.createElement("div");
  descRowB.className = "input";
  elLabelB = createLabel("Target");
  descRowB.appendChild(elLabelB);
  elDescB = createInputField({
    type: "textarea",
    rows: 3,
    onInput: () => setState("panel_b.description", elDescB.value),
  });
  descRowB.appendChild(elDescB);

  elBody.appendChild(preEl);
  elBody.appendChild(descRowA);
  elBody.appendChild(descRowB);

  // Initial render
  renderPromptCard();

  // OUT-03: subscribe for live prompt updates
  subscribe(renderPromptCard);
}
