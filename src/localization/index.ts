import { hu, type TranslationKey } from './hu';

export type { TranslationKey };
export { hu };

export type TranslationVars = Readonly<Record<string, string | number>>;

export function t(key: TranslationKey, vars: TranslationVars = {}): string {
  const template = hu[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(value);
}

export function formatSeconds(value: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}
