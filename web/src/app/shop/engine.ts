/**
 * The KitKat demo shop — a stateful, in-memory storefront backing real WebMCP
 * tools. This is the "aha" of the Playground: the tools don't return mocks,
 * they manipulate an actual store. Search returns real products; addToCart
 * actually mutates the cart; getCart reflects your running total; checkout
 * creates an order and clears the cart. Every call compounds.
 *
 * The shop state is a singleton observable so the live preview panel can render
 * it and re-render on every change.
 */

export interface Product {
  id: string;
  name: string;
  color: 'red' | 'blue' | 'green' | 'black' | 'white';
  category: 'dresses' | 'shirts' | 'shoes' | 'accessories';
  price: number;
  stock: number;
  emoji: string;
}

export interface CartLine {
  product: Product;
  qty: number;
}

export interface Order {
  id: string;
  items: CartLine[];
  total: number;
  at: number;
}

export interface ShopState {
  products: Product[];
  cart: CartLine[];
  orders: Order[];
}

/** A small observer so the preview panel re-renders on state changes. */
type Listener = (state: ShopState) => void;

const CATALOG: Product[] = [
  { id: 'p1', name: 'Summer Dress', color: 'red', category: 'dresses', price: 49, stock: 12, emoji: '👗' },
  { id: 'p2', name: 'Linen Shirt', color: 'blue', category: 'shirts', price: 39, stock: 20, emoji: '👔' },
  { id: 'p3', name: 'Wool Coat', color: 'black', category: 'dresses', price: 129, stock: 5, emoji: '🧥' },
  { id: 'p4', name: 'Garden Hat', color: 'green', category: 'accessories', price: 22, stock: 30, emoji: '🧢' },
  { id: 'p5', name: 'Silk Scarf', color: 'red', category: 'accessories', price: 18, stock: 40, emoji: '🧣' },
  { id: 'p6', name: 'Denim Jeans', color: 'blue', category: 'shirts', price: 59, stock: 15, emoji: '👖' },
  { id: 'p7', name: 'Running Shoes', color: 'white', category: 'shoes', price: 89, stock: 8, emoji: '👟' },
  { id: 'p8', name: 'Leather Boots', color: 'black', category: 'shoes', price: 149, stock: 6, emoji: '🥾' },
  { id: 'p9', name: 'Cotton Tee', color: 'green', category: 'shirts', price: 25, stock: 50, emoji: '👕' },
  { id: 'p10', name: 'Evening Gown', color: 'black', category: 'dresses', price: 199, stock: 3, emoji: '👗' },
];

class Shop {
  private state: ShopState = { products: CATALOG.map((p) => ({ ...p })), cart: [], orders: [] };
  private listeners = new Set<Listener>();

  getState(): ShopState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    // Shallow-clone so React sees a new reference.
    this.state = { ...this.state, cart: [...this.state.cart], orders: [...this.state.orders] };
    for (const l of this.listeners) l(this.state);
  }

  // --- operations the tools call ---

  search(opts: { query?: string; color?: string; category?: string }): Product[] {
    const q = (opts.query ?? '').toLowerCase().trim();
    return this.state.products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.category.includes(q) && !p.color.includes(q)) return false;
      if (opts.color && p.color !== opts.color) return false;
      if (opts.category && p.category !== opts.category) return false;
      return true;
    });
  }

  getProduct(id: string): Product | undefined {
    return this.state.products.find((p) => p.id === id);
  }

  addToCart(productId: string, qty = 1): CartLine[] {
    const product = this.getProduct(productId);
    if (!product) throw new Error(`Unknown product id "${productId}". Try shop.search first.`);
    if (product.stock < qty) throw new Error(`Only ${product.stock} of "${product.name}" in stock.`);
    const existing = this.state.cart.find((l) => l.product.id === productId);
    if (existing) existing.qty += qty;
    else this.state.cart.push({ product, qty });
    this.emit();
    return this.state.cart;
  }

  removeFromCart(productId: string): CartLine[] {
    this.state.cart = this.state.cart.filter((l) => l.product.id !== productId);
    this.emit();
    return this.state.cart;
  }

  getCart(): { lines: CartLine[]; total: number; count: number } {
    const total = this.state.cart.reduce((s, l) => s + l.product.price * l.qty, 0);
    const count = this.state.cart.reduce((s, l) => s + l.qty, 0);
    return { lines: this.state.cart, total, count };
  }

  checkout(): Order {
    const cart = this.getCart();
    if (cart.lines.length === 0) throw new Error('Cart is empty — add products with shop.addToCart first.');
    const order: Order = {
      id: 'KIT-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      items: cart.lines,
      total: cart.total,
      at: Date.now(),
    };
    // Decrement stock.
    for (const line of order.items) {
      const p = this.getProduct(line.product.id);
      if (p) p.stock -= line.qty;
    }
    this.state.orders.push(order);
    this.state.cart = [];
    this.emit();
    return order;
  }

  getOrders(): Order[] {
    return this.state.orders;
  }

  reset() {
    this.state = { products: CATALOG.map((p) => ({ ...p })), cart: [], orders: [] };
    this.emit();
  }
}

/** The singleton shop instance — shared by the tools and the preview panel. */
export const shop = new Shop();
