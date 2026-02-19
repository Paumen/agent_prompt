.1 Product scope (normative)
SPEC-ENG-00: The product MUST only generate copyable prompt text 
2.1 Canonical data model (single source of truth)
prompt_input (snake_case, JSON-serializable):
•	configuration: { owner:str, repo:str, branch:str, pat:str }
•	scope: { selected_files:[path], selected_folders:[path], include_globs:[glob], exclude_globs:[glob], exclude_generated:bool }
•	task: { flow_id:str }
•	steps: { enabled_step_ids:[id] }
•	lenses: { selected:[id], strictness:('low'|'med'|'high') }
•	output: { destination:('clipboard'|'file'), format:('prompt'|'json'|'both') }
•	create: { spec_file_path:path, scaffold_template:str, base_path:path }
•	model: { profile:str, verbosity:('short'|'normal'|'verbose') }
3.1 Engine requirements (SPEC-ENG-##)
•	SPEC-ENG-01: flows.yaml MUST be the only flow definition source and MUST be schema-validated at startup.
•	SPEC-ENG-02: All cards MUST read/write the same prompt_input.
•	SPEC-ENG-03: Any prompt_input change MUST trigger a full prompt rebuild.
•	SPEC-ENG-04: Steps UI MUST be derived from the selected flow pipeline; prompt “STEPS” MUST include only steps.enabled_step_ids.
•	SPEC-ENG-05: Model adapters MAY change wrapper text/formatting but MUST NOT change included prompt_input fields.
•	SPEC-ENG-06: Apply defaults via deterministic merge: base defaults → flow defaults → user overrides.
3.2 State requirements (SPEC-STS-##)
•	SPEC-STS-01: Persist per-card UI state (expanded/collapsed, height) locally per session.
•	SPEC-STS-02: First load: Configuration expanded; all other cards collapsed.
•	SPEC-STS-03: Repo select: set configuration.repo, fetch branches, select default branch, load root tree.
•	SPEC-STS-04: Branch select: set configuration.branch, reload tree.
•	SPEC-STS-05: Editing/clearing PAT: update configuration.pat. 
•	SPEC-STS-06: File/folder selection updates scope.selected_* immediately and reversibly.
•	SPEC-STS-07: Flow select: set task.flow_id and apply flow defaults to lenses/output/steps/create.
3.3 UX/UI requirements (SPEC-UIX-##)
•	SPEC-UIX-01: Five cards: Configuration, Scope, Tasks, Steps, Prompts.
•	SPEC-UIX-02: Cards are collapsible + resizable.
•	SPEC-UIX-03: Compact spacing; prefer single-row controls.
•	SPEC-UIX-04: Repo/branch selection MUST be one-tap buttons for the configured GitHub owner (default: paumen).
•	SPEC-UIX-05: Steps checklist supports toggling and per-step options from flows.yaml.
•	SPEC-UIX-06: Prompts card has Prompt with one-tap copy.
3.4 Non-functional requirements (SPEC-NFR-##)
•	SPEC-NFR-01: Mobile-first: minimize taps with button-first controls + sane defaults.
•	SPEC-NFR-02: Network loads are non-blocking and show loading + error states.
•	SPEC-NFR-03: Define p95 targets (warm cache vs cold cache) with explicit assumptions.
•	SPEC-NFR-04: Define cache strategy (keys, TTL, invalidation on repo/branch change).
•	SPEC-NFR-05: CSS minimizes unique classes; reuse tokens/variables + shared styles.
4.1 Invariants (INVARIANT-##)
•	INVARIANT-01: Outputs are derived only from current prompt_input.
•	INVARIANT-02: Outputs always reflect the latest prompt_input.
5.1 UI transition rules
Event	UI change	State change
Repo selected	Expand Scope	set repo, fetch branches, set default branch, load root tree
Branch selected	none	set branch, reload root tree
First file/folder selected	Expand Tasks; collapse Configuration	update scope selections
Flow selected	Expand Steps + Prompts	set flow_id + apply flow defaults
Any input changed	none	rebuild prompt from prompt_input
6.1 Test criteria (TST-##)
•	TST-01: Mocked GitHub repo/branch loading updates configuration.repo / configuration.branch.
•	TST-02: Tree lazy-expands; selection updates scope.selected_*.
•	TST-03: Flows render from flows.yaml; selecting applies defaults.
•	TST-04: Step toggles update steps.enabled_step_ids and prompt “STEPS”.
•	TST-05: Prompt copy outputs match snapshots for fixed inputs.
•	TST-06: End-to-end selection → copied outputs match UI state.
•	TST-07: Five consistent cards, collapsible/resizable, mobile-optimized.
•	TST-08: Operate + create-from-spec flows produce prompts with selected scope + create.spec_file_path.

