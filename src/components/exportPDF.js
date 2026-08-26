import html2pdf from 'html2pdf.js';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCHF, lang = 'es') {
  // 1. Rellenar plantilla
  let html = templateHtml
    .replace(/\{\{clientName\}\}/g, clientName)
    .replace(/\{\{productName\}\}/g, productName)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('es-CO'));

  const servicesRowsHtml = selectedModules.map(mod => {
    const price = convertCurrency(mod.price, currency);
    const priceFormatted = formatCurrency(price, currency);
    const description = mod[`description_${lang}`] || mod.description_es;
    const detail = mod[`detail_${lang}`] || mod.detail_es;
    let detailHtml = '';
    if (detail && detail.trim() !== '') {
      const detailWithBreaks = detail.replace(/\r?\n/g, '<br>');
      detailHtml = `<span class="service-detail">${detailWithBreaks}</span>`;
    }
    return `
      <tr class="service-row">
        <td>
          <span class="service-name">${description}</span>
          ${detailHtml}
        </td>
        <td class="service-price">${priceFormatted}</td>
      </tr>
    `;
  }).join('');

  html = html.replace('{{servicesRows}}', servicesRowsHtml);

  const totalConverted = convertCurrency(totalCHF, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  html = html.replace('{{total}}', totalFormatted);

  // 2. Crear un contenedor en el DOM (oculto) para renderizar el HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '794px'; // Ancho fijo igual al de la plantilla original
  container.style.background = '#ffffff';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';
  document.body.appendChild(container);

  // Esperar a que el navegador renderice el contenido
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    // 3. Configurar opciones de html2pdf
    const opt = {
      margin:        [0, 0, 0, 0], // Sin márgenes adicionales (los márgenes ya están en la plantilla)
      filename:      `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`,
      image:         { type: 'jpeg', quality: 0.95 },
      html2canvas:   { 
        scale: 2,                  // Buena resolución
        useCORS: true,
        logging: false,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 794,                // Ancho fijo de la captura (coincide con el contenedor)
        height: container.scrollHeight,
      },
      jsPDF:         { 
        unit: 'mm', 
        format: 'a4',              // Página A4
        orientation: 'portrait' 
      },
      pagebreak:     { mode: ['avoid-all', 'css', 'legacy'] } // Evita saltos de página no deseados
    };

    // 4. Generar el PDF
    await html2pdf().set(opt).from(container).save();

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    // Limpiar el DOM
    document.body.removeChild(container);
  }
}
