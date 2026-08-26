import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCHF, lang = 'es') {
  // Rellenar plantilla
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

  // Crear iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1080px';
  iframe.style.border = 'none';
  iframe.style.background = '#ffffff';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  await new Promise(resolve => {
    iframe.onload = resolve;
    if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
      resolve();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const body = iframe.contentDocument.body;
    const container = iframe.contentDocument.querySelector('.pdf-container');
    body.style.width = '1080px';
    body.style.margin = '0';
    body.style.padding = '0';
    if (container) {
      container.style.width = '100%';
      container.style.maxWidth = '100%';
      container.style.boxSizing = 'border-box';
    }
    iframe.style.height = body.scrollHeight + 'px';

    const targetElement = container || body;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
      width: targetElement.scrollWidth,
      height: targetElement.scrollHeight,
    });

    const imgWidth = canvas.width;    // ~2160px
    const imgHeight = canvas.height;

    // Convertir píxeles a mm (1px = 0.352778 mm a 72 DPI)
    const widthMm = imgWidth * 0.352778;
    const heightMm = imgHeight * 0.352778;

    // Crear PDF con formato exacto de la imagen
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm],
      compress: true,
      putOnlyUsedFonts: true,
      floatPrecision: 16,
    });

    // Añadir la imagen sin escalado (1:1 en mm)
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      0,
      0,
      widthMm,
      heightMm
    );

    // Establecer que el visor se ajuste al ancho de la ventana
    pdf.internal.write('<< /Type /Catalog /ViewerPreferences << /FitWindow true >> >>');

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
