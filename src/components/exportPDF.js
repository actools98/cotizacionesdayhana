import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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

  // 2. Crear iframe con ancho ESTRICTO de 1080px
  const IFRAME_WIDTH = 1080;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = IFRAME_WIDTH + 'px';
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

    // FORZAR: body y contenedor deben tener EXACTAMENTE 1080px de ancho
    body.style.width = IFRAME_WIDTH + 'px';
    body.style.margin = '0';
    body.style.padding = '0';
    body.style.boxSizing = 'border-box';

    if (container) {
      container.style.width = '100%';
      container.style.maxWidth = '100%';
      container.style.boxSizing = 'border-box';
      // Eliminar cualquier padding que pueda desbordar
      container.style.padding = '0';
    }

    // Ajustar altura del iframe al contenido
    iframe.style.height = body.scrollHeight + 'px';

    // 3. Capturar el contenedor (o body si no hay contenedor)
    const targetElement = container || body;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
      width: targetElement.scrollWidth, // = 1080px
      height: targetElement.scrollHeight,
    });

    const imgWidth = canvas.width;    // = 2160px (1080 * 2)
    const imgHeight = canvas.height;

    // 4. Crear PDF con el ancho EXACTO de la imagen en puntos (1px = 1pt)
    // Esto asegura que el visor muestre el PDF a tamaño real (escalado 100% al ancho)
    const widthPt = imgWidth;    // 2160 puntos
    const heightPt = imgHeight;  // altura variable en puntos

    // Convertir puntos a milímetros para jsPDF (1pt = 0.352778 mm)
    const widthMm = widthPt * 0.352778;
    const heightMm = heightPt * 0.352778;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm],
      compress: true,
      putOnlyUsedFonts: true,
      floatPrecision: 16,
    });

    // Añadir la imagen sin escalar (1:1 en puntos -> mm)
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      0,
      0,
      widthMm,
      heightMm
    );

    // Forzar al visor a ajustar el ancho al 100% de la ventana
    pdf.internal.write('<< /Type /Catalog /ViewerPreferences << /FitWindow true >> >>');

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
