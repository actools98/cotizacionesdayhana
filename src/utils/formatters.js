// formatters.js - Formateo de números y monedas

export function formatCurrency(value, currency = 'CHF') {
  // Si el valor es 0, mostramos "Gratuito"
  if (value === 0) {
    return 'Gratuito';
  }

  const symbols = {
    CHF: 'CHF',
    USD: '$',
    EUR: '€'
  };
  const symbol = symbols[currency] || 'CHF';

  let formatted;
  if (currency === 'CHF' || currency === 'USD') {
    formatted = value.toFixed(2).toLocaleString('en-US');
  } else {
    formatted = value.toFixed(2).toLocaleString('en-US');
  }
  return `${symbol} ${formatted}`;
}
