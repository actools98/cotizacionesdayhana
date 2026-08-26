// currencyConverter.js - Conexión a API + tasas manuales (base: CHF)

const API_URL = 'https://api.exchangerate-api.com/v4/latest/CHF';
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

// Guardar tasas manuales (tasas directas: 1 CHF = ? USD, 1 CHF = ? EUR)
export function saveManualRates(usdRate, eurRate) {
  const rates = { USD: usdRate, EUR: eurRate };
  localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rates));
  if (exchangeRates) {
    exchangeRates.USD = usdRate;
    exchangeRates.EUR = eurRate;
  } else {
    exchangeRates = { USD: usdRate, EUR: eurRate };
  }
}

// Obtener tasas (prioriza manuales si existen)
export async function fetchExchangeRates(force = false) {
  const manual = loadManualRates();
  if (manual) {
    if (!exchangeRates || force) {
      exchangeRates = { ...manual };
      lastFetchTime = Date.now();
      console.log('💱 Usando tasas manuales (CHF base):', exchangeRates);
    }
    return exchangeRates;
  }

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
    console.log('💱 Tasas de cambio actualizadas (API, CHF base)');
    return exchangeRates;
  } catch (error) {
    console.error('API de divisas falló:', error);
    if (!exchangeRates) {
      exchangeRates = { USD: 1.10, EUR: 0.95 }; // valores aproximados
    }
    return exchangeRates;
  }
}

export function convertCurrency(amountCHF, currency) {
  if (currency === 'CHF') return amountCHF;
  if (!exchangeRates) {
    console.warn('Tasas no cargadas, usando CHF por defecto');
    return amountCHF;
  }
  const rate = exchangeRates[currency];
  if (!rate) return amountCHF;
  return amountCHF * rate;
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
