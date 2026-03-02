/**
 * Vite plugin: parse YAML → validate against schema → emit JSON.
 * DM-DEF-02: flows.yaml converted to JSON at build time with schema validation.
 * TST-03: build fails with clear error message on malformed YAML or schema violation.
 */
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { validateFlows } from './flow-schema.js';

export default function yamlPlugin() {
  return {
    name: 'vite-plugin-yaml',

    transform(_code, id) {
      if (!id.endsWith('.yaml') && !id.endsWith('.yml')) {
        return null;
      }

      // Read and parse YAML
      let raw;
      try {
        raw = readFileSync(id, 'utf-8');
      } catch (err) {
        this.error(`[vite-plugin-yaml] Failed to read ${id}: ${err.message}`);
        return null;
      }

      let parsed;
      try {
        parsed = yaml.load(raw);
      } catch (err) {
        this.error(
          `[vite-plugin-yaml] YAML parse error in ${id}:\n${err.message}`
        );
        return null;
      }

      // Validate against schema (only for flows.yaml)
      if (id.includes('flows.yaml') || id.includes('flows.yml')) {
        const { valid, errors } = validateFlows(parsed);
        if (!valid) {
          const errorList = errors.map((e) => `  - ${e}`).join('\n');
          this.error(
            `[vite-plugin-yaml] Schema validation failed for ${id}:\n${errorList}`
          );
          return null;
        }
      }

      // Strip YAML anchors metadata (not needed at runtime)
      if (parsed && parsed._x_anchors) {
        delete parsed._x_anchors;
      }

      // Emit as ES module exporting validated JSON
      const json = JSON.stringify(parsed, null, 2);
      return {
        code: `export default ${json};`,
        map: null,
      };
    },
  };
}
