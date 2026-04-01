export type MADFormatOptions = {
  decimals?: number;
};

export function formatMAD(amount: number | null | undefined, options: MADFormatOptions = {}): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '-';

  const decimals = options.decimals ?? 0;

  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    currencyDisplay: 'code',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatMADCompact(amount: number | null | undefined): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '-';

  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    currencyDisplay: 'code',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
