import type { Scenario } from './scenarios.js';

/** Built-in scenarios contributors can extend. Export-friendly JSON shapes. */
export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'preset:ecommerce',
    name: 'E-commerce — shop & cart',
    builtin: true,
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
            color: { type: 'string', enum: ['red', 'blue', 'green'], description: 'color filter' },
            size: { type: 'string', description: 'size filter (S/M/L)' },
          },
          required: ['color'],
        },
      },
      {
        name: 'shop.addToCart',
        description: 'Add a product to the shopping cart.',
        inputSchema: {
          type: 'object',
          properties: { productId: { type: 'string', description: 'product to add' } },
          required: ['productId'],
        },
      },
    ],
  },
  {
    id: 'preset:travel',
    name: 'Travel — flight search',
    builtin: true,
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
            from: { type: 'string', description: 'origin airport code' },
            to: { type: 'string', description: 'destination airport code' },
            date: { type: 'string', format: 'date' },
          },
          required: ['from', 'to'],
        },
      },
    ],
  },
  {
    id: 'preset:support',
    name: 'Support — order lookup',
    builtin: true,
    persona: 'support',
    goal: 'look up order 12345',
    tools: [
      {
        name: 'support.getOrder',
        description: 'Look up an order by id.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: { orderId: { type: 'string', description: 'order identifier' } },
          required: ['orderId'],
        },
      },
    ],
  },
];
