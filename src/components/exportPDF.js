import html2pdf from 'html2pdf.js';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

/**
 * Genera un PDF a partir de una plantilla HTML.
 * @param {string} clientName - Nombre del cliente.
 * @param {string} productName - Producto o servicio.
 * @param {Array} selectedModules - Lista de módulos seleccionados (con id, description, price, detail).
 * @param {string} currency - Código de moneda ('COP', 'USD', 'EUR').
 * @param {number} totalCOP - Total en COP (sin convertir).
 */
export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCOP) {
  // 1. Reemplazar marcadores simples
  let html = templateHtml
    .replace(/\{\{clientName\}\}/g, clientName)
    .replace(/\{\{productName\}\}/g, productName)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('es-CO'));

  // 2. Generar lista de servicios
  const servicesHtml = selectedModules.map(mod => {
    const price = convertCurrency(mod.price, currency);
    const priceFormatted = formatCurrency(price, currency);
    let detailHtml = '';
    if (mod.detail) {
      detailHtml = `<div class="service-detail">${mod.detail}</div>`;
    }
    return `<div class="service-item">
              <span class="service-name">${mod.description}</span>
              <span class="service-price">${priceFormatted}</span>
              ${detailHtml}
            </div>`;
  }).join('');

  html = html.replace('{{services}}', servicesHtml);

  // 3. Total
  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  html = html.replace('{{total}}', totalFormatted);

  // 4. Crear elemento DOM temporal (sin mostrarlo)
  const container = document.createElement('div');
  container.innerHTML = html;
  const element = container.firstElementChild;

  // 5. Generar PDF con html2pdf
  const opt = {
    margin:        [20, 14, 20, 14], // superior, izquierda, inferior, derecha (mm)
    filename:      `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`,
    image:         { type: 'jpeg', quality: 0.98 },
    html2canvas:   { scale: 2, useCORS: true, logging: false },
    jsPDF:         { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  }
}
