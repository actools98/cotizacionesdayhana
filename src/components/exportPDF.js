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

  // 2. Crear iframe con ancho fijo de 1080px y altura dinámica
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1080px';
  iframe.style.height = 'auto';
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

    // Asegurar que el body tenga el ancho exacto y márgenes internos
    body.style.width = '1080px';
    body.style.margin = '0';
    body.style.padding = '0';
    body.style.boxSizing = 'border-box';

    // El container ya tiene padding de 48px, asegurar que ocupe todo el ancho
    if (container) {
      container.style.width = '100%';
      container.style.maxWidth = '100%';
      container.style.boxSizing = 'border-box';
    }

    // Ajustar altura del iframe al contenido
    iframe.style.height = body.scrollHeight + 'px';

    // 3. Capturar el contenedor completo (no solo el body, para evitar problemas de padding)
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

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // 4. Crear PDF con ancho fijo en puntos (1px = 1pt = 0.352778 mm)
    // 1080px = 1080pt = 381mm (aproximadamente)
    // Usamos el ancho de la imagen capturada (que debería ser 1080px * 2 por el scale)
    const pdfWidthPt = imgWidth; // = 2160px (por el scale 2)
    const pdfWidthMm = pdfWidthPt * 0.352778; // Convertir puntos a mm
    const pdfHeightMm = imgHeight * 0.352778;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm]
    });

    // Agregar la imagen sin escalar (1:1 en mm)
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      0,
      0,
      pdfWidthMm,
      pdfHeightMm
    );

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
