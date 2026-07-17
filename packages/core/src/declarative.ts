/**
 * Declarative WebMCP — converts `<form toolname tooldescription>` markup into
 * WebMCP tools with synthesized JSON Schemas.
 *
 * The W3C Declarative API requires only `toolname` + `tooldescription` on a
 * `<form>` (with optional `toolautosubmit`). The browser infers an input schema
 * from the form's controls. KitKat reproduces that inference so the Validator
 * can check declarative pages and the Debugger can overlay their elements even
 * when the native API is absent.
 *
 * Events: WebMCP dispatches `toolactivated` (tool starts) and `toolcancel`
 * (aborted) on the form; handlers use `respondWith(Promise)` to return JSON.
 * We synthesize equivalents for the Sandbox.
 */

import type { Json, JsonObject, JsonSchema, RegisteredTool, ToolDescriptor } from './types.js';

/** Attributes recognized by the Declarative API. */
export const ATTR = {
  name: 'toolname',
  description: 'tooldescription',
  autosubmit: 'toolautosubmit',
} as const;

/** Minimum reliability score for an element to count as a declarative tool. */
export interface ScannedTool extends RegisteredTool {
  selector: string;
  element?: HTMLElement;
}

/** Escape an attribute value for use in a CSS selector. */
function escapeAttr(v: string): string {
  return CSS.escape(v);
}

/** Build a unique CSS selector for a form element. */
function selectorFor(form: HTMLElement): string {
  if (form.id) return `#${CSS.escape(form.id)}`;
  const attr = form.getAttribute(ATTR.name);
  return `form[${ATTR.name}="${attr ? escapeAttr(attr) : ''}"]`;
}

/** Map an HTML input element to a JSON Schema fragment. */
function schemaForInput(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): JsonSchema {
  const required = el.hasAttribute('required');
  const schema: JsonSchema = {};

  // <select> → enum of option values
  if (el instanceof HTMLSelectElement) {
    schema.type = 'string';
    const opts = Array.from(el.options).map((o) => o.value).filter((v) => v !== '');
    if (opts.length) schema.enum = opts;
    if (required) schema.__required = true; // hoisted by caller
    return schema;
  }

  switch (el.type) {
    case 'number':
    case 'range':
      schema.type = 'number';
      if (el instanceof HTMLInputElement) {
        if (el.min) schema.minimum = Number(el.min);
        if (el.max) schema.maximum = Number(el.max);
      }
      break;
    case 'checkbox':
      schema.type = 'boolean';
      break;
    case 'date':
    case 'datetime-local':
    case 'time':
    case 'month':
      schema.type = 'string';
      schema.format = el.type;
      break;
    case 'email':
      schema.type = 'string';
      schema.format = 'email';
      break;
    case 'url':
      schema.type = 'string';
      schema.format = 'uri';
      break;
    case 'password':
    case 'hidden':
    case 'text':
    default:
      schema.type = 'string';
      if (el instanceof HTMLInputElement) {
        if (el.minLength > 0) schema.minLength = el.minLength;
        if (el.maxLength > 0) schema.maxLength = el.maxLength;
        if (el.pattern) schema.pattern = el.pattern;
      }
      break;
  }
  if (el instanceof HTMLInputElement && el.list) {
    // Datalist-backed inputs → enum suggestions (soft). `el.list` is the
    // referenced <datalist> element (HTMLInputElement.list: HTMLElement | null).
    const opts = Array.from(el.list.querySelectorAll('option'))
      .map((o) => o.value)
      .filter(Boolean);
    if (opts.length) (schema as any).examples = opts;
  }
  if (required) (schema as any).__required = true;
  return schema;
}

/**
 * Synthesize a JSON Schema for a declarative form from its named controls.
 * Strips the internal `__required` markers into the top-level `required` array,
 * matching how the browser would expose the tool.
 */
export function schemaForForm(form: HTMLFormElement): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  const controls = form.elements;
  for (const el of controls) {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLSelectElement) &&
      !(el instanceof HTMLTextAreaElement)
    ) {
      continue;
    }
    if (!el.name) continue;
    const frag = schemaForInput(el);
    const isRequired = (frag as any).__required === true;
    delete (frag as any).__required;
    properties[el.name] = frag;
    if (isRequired) required.push(el.name);
  }

  const schema: JsonSchema = { type: 'object', properties };
  if (required.length) schema.required = required;
  return schema;
}

/** Find all declarative tool forms in a document. */
export function findDeclarativeForms(doc: Document | HTMLElement = document): HTMLFormElement[] {
  return Array.from(doc.querySelectorAll<HTMLFormElement>(`form[${ATTR.name}]`));
}

/**
 * Scan a document for declarative tools and return them as RegisteredTools.
 * The `execute` handler serializes the matching form's values (used by Sandbox).
 */
export function scanDeclarative(doc: Document | HTMLElement = document): ScannedTool[] {
  const forms = findDeclarativeForms(doc);
  return forms.map((form) => {
    const name = form.getAttribute(ATTR.name) ?? '';
    const description = form.getAttribute(ATTR.description) ?? '';
    const inputSchema = schemaForForm(form);
    const selector = selectorFor(form);
    return {
      name,
      description,
      inputSchema,
      source: 'declarative',
      selector,
      element: form,
      registeredAt: Date.now(),
      execute: async (input) => {
        // Reflect provided input onto the form, then return the serialized data.
        const fd = new FormData(form);
        for (const [k, v] of Object.entries(input)) {
          if (v !== undefined && v !== null) fd.set(k, String(v));
        }
        const out: JsonObject = {};
        fd.forEach((v, k) => {
          // Files become their filename; everything else is a string.
          out[k] = (typeof v === 'string' ? v : v.name) as Json;
        });
        return out;
      },
    };
  });
}

/** Strip a scanned tool to an IPC-safe descriptor. */
export function toDescriptor(tool: ScannedTool): ToolDescriptor {
  const { execute: _execute, element: _element, ...rest } = tool;
  void _execute;
  void _element;
  return rest;
}
