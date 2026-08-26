import html2pdf from 'html2pdf.js';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCOP) {
  // 1. Reemplazar marcadores
  let html = templateHtml
    .replace(/\{\{clientName\}\}/g, clientName)
    .replace(/\{\{productName\}\}/g, productName)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('es-CO'));

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

  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  html = html.replace('{{total}}', totalFormatted);

  // 2. Crear elemento contenedor y añadirlo al DOM (fuera de pantalla)
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 en píxeles (96 DPI)
  container.style.background = '#ffffff';
  container.style.zIndex = '-999';
  container.style.padding = '20px';
  document.body.appendChild(container);

  // 3. Esperar a que el navegador renderice el contenido
  await new Promise(resolve => requestAnimationFrame(resolve));

  // 4. Configurar opciones de html2pdf
  const opt = {
    margin:        [20, 14, 20, 14],
    filename:      `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`,
    image:         { type: 'jpeg', quality: 0.98 },
    html2canvas:   { 
      scale: 2, 
      useCORS: true, 
      logging: true,  // Para depurar en consola
      allowTaint: false,
      backgroundColor: '#ffffff'
    },
    jsPDF:         { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    // Limpiar el DOM
    document.body.removeChild(container);
  }
}
