import { createLogger } from '../../../common/services/logger.service';

export interface Cod10Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  stock?: number;
  prices: Array<{
    variationId?: string;
    label: string;
    currency: string;
    amount: number;
    amountVes?: number;
  }>;
}

export interface Cod10PaymentMethod {
  id: string;
  enabled: boolean;
  label: string;
  bankCode?: string;
  bankName?: string;
  phone?: string;
  ci?: string;
  payId?: string;
}

export interface Cod10Catalog {
  products: Cod10Product[];
  paymentMethods: Cod10PaymentMethod[];
  currency: string;
  currencySymbol: string;
  deliveryCharges: number;
  bcvRate: number | null;
  bcvRateDate?: string;
  storeUrl: string;
  fetchedAt: string;
}

export interface Cod10ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class Cod10ApiClient {
  private readonly logger = createLogger('Cod10ApiClient');
  private readonly base: string;
  private readonly timeoutMs: number;

  constructor(private readonly opts: Cod10ApiClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs ?? 15000;
  }

  private buildHeaders(accept: string): Record<string, string> {
    const headers: Record<string, string> = { Accept: accept };
    if (this.opts.apiKey) {
      headers['X-API-Key'] = this.opts.apiKey;
    }
    return headers;
  }

  /** Catálogo JSON desde MongoDB vía GraphQL Enatega (cod10.vercel.app/api/bot/catalog) */
  async fetchCatalog(): Promise<Cod10Catalog> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.base}/api/bot/catalog`, {
        headers: this.buildHeaders('application/json'),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Cod10 catalog API error ${response.status}`);
      }

      return (await response.json()) as Cod10Catalog;
    } catch (error) {
      this.logger.error('Failed to fetch Cod10 catalog', error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Contexto de texto listo para Gemini (desde la API de Codigo 10) */
  async fetchCatalogContext(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.base}/api/bot/context`, {
        headers: this.buildHeaders('text/plain'),
        signal: controller.signal,
      });

      if (!response.ok) {
        const catalog = await this.fetchCatalog();
        return this.buildCatalogContext(catalog);
      }

      return await response.text();
    } catch (error) {
      this.logger.error('Failed to fetch Cod10 catalog context', error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  buildCatalogContext(catalog: Cod10Catalog): string {
    const lines: string[] = [
      '=== CODIGO 10 — MENÚ Y PRECIOS ===',
      `Tienda: ${catalog.storeUrl}`,
      `Moneda: ${catalog.currency} (${catalog.currencySymbol})`,
      `Delivery: ${catalog.currencySymbol}${catalog.deliveryCharges}`,
    ];

    if (catalog.bcvRate) {
      lines.push(`Tasa BCV: ${catalog.bcvRate} Bs/USD`);
    }

    lines.push('\n=== PRODUCTOS ===');
    if (catalog.products.length === 0) {
      lines.push('(Sin productos)');
    } else {
      for (const p of catalog.products) {
        lines.push(`\n• ${p.name}${p.category ? ` [${p.category}]` : ''}`);
        if (p.description) lines.push(`  ${p.description}`);
        for (const price of p.prices) {
          const ves = price.amountVes !== undefined ? ` / Bs ${price.amountVes}` : '';
          lines.push(`  ${price.label}: ${catalog.currencySymbol}${price.amount}${ves}`);
        }
      }
    }

    lines.push('\n=== MÉTODOS DE PAGO ===');
    for (const m of catalog.paymentMethods) {
      lines.push(`• ${m.label}`);
      if (m.id === 'pagomovil') {
        if (m.bankCode) lines.push(`  Banco: ${m.bankCode}${m.bankName ? ` — ${m.bankName}` : ''}`);
        if (m.phone) lines.push(`  Teléfono: ${m.phone}`);
        if (m.ci) lines.push(`  CI/RIF: ${m.ci}`);
      }
      if (m.id === 'binance' && m.payId) lines.push(`  Binance Pay ID: ${m.payId}`);
    }

    return lines.join('\n');
  }
}
