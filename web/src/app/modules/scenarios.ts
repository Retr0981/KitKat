import type { JsonObject, PersonaId, TestingTool } from '@kitkat/core';

/** A Sandbox scenario — the web copy of the extension's presets. */
export interface Scenario {
  id: string;
  name: string;
  tools: TestingTool[];
  params?: Record<string, JsonObject>;
  goal: string;
  persona: PersonaId;
}

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce — shop & cart',
    persona: 'shopper',
    goal: 'find a red dress and add it to cart',
    params: { 'shop.addToCart': { productId: 'p1' } },
    tools: [
      {
        name: 'shop.search',
        description: 'Search the product catalog by color and size.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue', 'green'] },
            size: { type: 'string' },
          },
          required: ['color'],
        },
      },
      {
        name: 'shop.addToCart',
        description: 'Add a product to the shopping cart.',
        inputSchema: {
          type: 'object',
          properties: { productId: { type: 'string' } },
          required: ['productId'],
        },
      },
    ],
  },
  {
    id: 'travel',
    name: 'Travel — flight search',
    persona: 'travel',
    goal: 'find a flight from SFO to JFK',
    tools: [
      {
        name: 'travel.searchFlights',
        description: 'Search flights between two airports on a date.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            date: { type: 'string', format: 'date' },
          },
          required: ['from', 'to'],
        },
      },
    ],
  },
  {
    id: 'support',
    name: 'Support — order lookup',
    persona: 'support',
    goal: 'look up order 12345',
    tools: [
      {
        name: 'support.getOrder',
        description: 'Look up an order by id.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
          required: ['orderId'],
        },
      },
    ],
  },
];
