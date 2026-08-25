// currencyConverter.js - Conexión a API + tasas manuales

const API_URL = 'https://api.exchangerate-api.com/v4/latest/COP';
const STORAGE_KEY_RATES = 'actols_manual_rates';

let exchangeRates = null;
let lastFetchTime = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

// Cargar tasas manuales guardadas
function loadManualRates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RATES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.USD && parsed.EUR) {
        return parsed;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Guardar tasas manuales
export function saveManualRates(usdRate, eurRate) {
  const rates = { USD: usdRate, EUR: eurRate };
  localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rates));
  // Actualizar en memoria
  if (exchangeRates) {
    exchangeRates.USD = usdRate;
    exchangeRates.EUR = eurRate;
  } else {
    exchangeRates = { USD: usdRate, EUR: eurRate };
  }
}

// Obtener tasas (prioriza manuales si existen)
export async function fetchExchangeRates(force = false) {
  // Verificar si hay tasas manuales guardadas
  const manual = loadManualRates();
  if (manual) {
    // Usar tasas manuales
    if (!exchangeRates || force) {
      exchangeRates = { ...manual };
      lastFetchTime = Date.now();
      console.log('💱 Usando tasas manuales:', exchangeRates);
    }
    return exchangeRates;
  }

  // Si no hay manuales, usar API
  const now = Date.now();
  if (!force && exchangeRates && (now - lastFetchTime) < REFRESH_INTERVAL) {
    return exchangeRates;
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Error al obtener tasas de cambio');
    const data = await response.json();
    exchangeRates = data.rates;
    lastFetchTime = now;
    console.log('💱 Tasas de cambio actualizadas (API)');
    return exchangeRates;
  } catch (error) {
    console.error('API de divisas falló:', error);
    if (!exchangeRates) {
      exchangeRates = { USD: 0.00025, EUR: 0.00023 };
    }
    return exchangeRates;
  }
}

export function convertCurrency(amountCOP, currency) {
  if (currency === 'COP') return amountCOP;
  if (!exchangeRates) {
    console.warn('Tasas no cargadas, usando COP por defecto');
    return amountCOP;
  }
  const rate = exchangeRates[currency];
  if (!rate) return amountCOP;
  return amountCOP * rate;
}

// Obtener tasas actuales (para mostrar en el diálogo)
export function getCurrentRates() {
  if (exchangeRates) {
    return { USD: exchangeRates.USD, EUR: exchangeRates.EUR };
  }
  return null;
}

export function startAutoRefresh() {
  fetchExchangeRates(true);
  setInterval(() => fetchExchangeRates(true), REFRESH_INTERVAL);
}
