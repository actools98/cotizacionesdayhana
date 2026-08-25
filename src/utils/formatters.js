// formatters.js - Formateo de números y monedas

/**
 * Formatea un número como moneda según la divisa.
 * @param {number} value - Monto a formatear.
 * @param {string} currency - 'COP', 'USD' o 'EUR'.
 * @returns {string} Cadena formateada (ej: "$ 1.234.567").
 */
export function formatCurrency(value, currency = 'COP') {
  const symbols = {
    COP: '$',
    USD: '$',
    EUR: '€'
  };
  const symbol = symbols[currency] || '$';

  // Para COP usamos separador de miles con puntos (formato colombiano)
  // Para USD/EUR usamos formato internacional con comas
  let formatted;
  if (currency === 'COP') {
    formatted = Math.round(value).toLocaleString('es-CO');
  } else {
    formatted = value.toFixed(2).toLocaleString('en-US');
  }
  return `${symbol} ${formatted}`;
}
