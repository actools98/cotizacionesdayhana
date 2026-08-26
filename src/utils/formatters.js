// formatters.js - Formateo de números y monedas

export function formatCurrency(value, currency = 'CHF') {
  const symbols = {
    CHF: 'CHF',
    USD: '$',
    EUR: '€'
  };
  const symbol = symbols[currency] || 'CHF';

  let formatted;
  if (currency === 'CHF' || currency === 'USD') {
    // Para CHF y USD usamos formato internacional con coma decimal y separador de miles
    formatted = value.toFixed(2).toLocaleString('en-US');
  } else {
    // EUR igual
    formatted = value.toFixed(2).toLocaleString('en-US');
  }
  return `${symbol} ${formatted}`;
}
