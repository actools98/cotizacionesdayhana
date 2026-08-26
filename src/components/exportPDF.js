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

  // 2. Crear contenedor en el DOM, pero visible (opacidad 0)
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px'; // Ancho fijo
  container.style.background = '#ffffff';
  container.style.opacity = '0'; // INVISIBLE para el usuario
  container.style.pointerEvents = 'none'; // No bloquea interacciones
  container.style.zIndex = '-9999'; // Detrás de todo
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';
  document.body.appendChild(container);

  // Esperar a que el navegador renderice el contenido
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // 3. Configurar opciones de html2pdf
    const opt = {
      margin:        [0, 0, 0, 0],
      filename:      `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`,
      image:         { type: 'jpeg', quality: 0.95 },
      html2canvas:   { 
        scale: 2,
        useCORS: true,
        logging: true, // Activar logs para depurar
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: container.scrollHeight,
      },
      jsPDF:         { 
        unit: 'mm', 
        format: 'a4',
        orientation: 'portrait' 
      },
      pagebreak:     { mode: ['avoid-all', 'css', 'legacy'] }
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
