import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { CURRENCY_CODES, DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@titan/shared';

export interface FxRatesPayload {
  base: CurrencyCode;
  rates: Record<string, number>;
  currencies: readonly CurrencyCode[];
  source: 'live' | 'fallback';
  updatedAt: string;
  stale: boolean;
}

type RateCache = { expiresAt: number; payload: FxRatesPayload };

const USD_RATES: Record<string, number> = {
  SAR: 3.75,
  AED: 3.6725,
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.9,
  CNY: 7.2,
  JPY: 157,
  INR: 83.5,
  KRW: 1380,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.376,
  OMR: 0.3845,
  JOD: 0.709,
  EGP: 48.5,
  TRY: 32.5,
  ZAR: 18.2,
  MXN: 17.1,
  SGD: 1.35,
  HKD: 7.8,
  NGN: 1550,
  PKR: 278,
  BDT: 110,
  LKR: 295,
  MYR: 4.7,
  IDR: 15800,
  PHP: 56,
  THB: 36,
  VND: 25400,
  PLN: 3.95,
  SEK: 10.5,
  NOK: 10.7,
  DKK: 6.85,
  CZK: 23.1,
  HUF: 360,
  RON: 4.55,
  BGN: 1.84,
  UAH: 39,
  ILS: 3.65,
};

@Injectable()
export class FxRatesService {
  private cache: RateCache | null = null;

  constructor(private readonly config: ConfigService) {}

  async getRates(baseInput: string = DEFAULT_CURRENCY): Promise<FxRatesPayload> {
    const base = String(baseInput).trim().toUpperCase();
    if (!isCurrencyCode(base)) throw new BadRequestException('Unsupported currency');
    if (this.cache && this.cache.expiresAt > Date.now() && this.cache.payload.base === base) return this.cache.payload;

    const fallback = this.fallbackRates(base);
    try {
      const endpoint = this.config.get('FX_RATES_URL') || 'https://open.er-api.com/v6/latest/USD';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: 'application/json' } });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`FX provider returned ${response.status}`);
      const body = await response.json() as { rates?: Record<string, unknown>; time_last_update_utc?: string };
      if (!body.rates || typeof body.rates !== 'object') throw new Error('FX provider returned no rates');
      const usdRates: Record<string, number> = {};
      for (const [currency, value] of Object.entries(body.rates)) {
        if (isCurrencyCode(currency) && typeof value === 'number' && Number.isFinite(value) && value > 0) usdRates[currency] = value;
      }
      const baseUsdRate = usdRates[base] ?? USD_RATES[base];
      if (!baseUsdRate) throw new Error('FX provider omitted the requested base');
      const rates: Record<string, number> = { [base]: 1 };
      for (const currency of CURRENCY_CODES) {
        const usdRate = usdRates[currency] ?? USD_RATES[currency];
        if (usdRate) rates[currency] = usdRate / baseUsdRate;
      }
      const payload: FxRatesPayload = {
        base,
        rates,
        currencies: CURRENCY_CODES,
        source: 'live',
        updatedAt: body.time_last_update_utc ?? new Date().toISOString(),
        stale: false,
      };
      this.cache = { expiresAt: Date.now() + 15 * 60 * 1000, payload };
      return payload;
    } catch {
      const payload = { ...fallback, stale: true };
      this.cache = { expiresAt: Date.now() + 5 * 60 * 1000, payload };
      return payload;
    }
  }

  private fallbackRates(base: CurrencyCode): FxRatesPayload {
    const baseUsdRate = USD_RATES[base] ?? 1;
    const rates: Record<string, number> = { [base]: 1 };
    for (const currency of CURRENCY_CODES) {
      const usdRate = USD_RATES[currency];
      if (usdRate) rates[currency] = usdRate / baseUsdRate;
    }
    return {
      base,
      rates,
      currencies: CURRENCY_CODES,
      source: 'fallback',
      updatedAt: new Date().toISOString(),
      stale: true,
    };
  }
}
