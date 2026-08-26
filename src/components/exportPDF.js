import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCOP) {
  // 1. Rellenar plantilla
  let html = templateHtml
    .replace(/\{\{clientName\}\}/g, clientName)
    .replace(/\{\{productName\}\}/g, productName)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('es-CO'));

  // 2. Generar filas de servicios
  const servicesRowsHtml = selectedModules.map(mod => {
    const price = convertCurrency(mod.price, currency);
    const priceFormatted = formatCurrency(price, currency);
    let detailHtml = '';
    if (mod.detail && mod.detail.trim() !== '') {
      // Convertir saltos de línea a <br>
      const detailWithBreaks = mod.detail.replace(/\r?\n/g, '<br>');
      detailHtml = `<span class="service-detail">${detailWithBreaks}</span>`;
    }
    return `
      <tr class="service-row">
        <td>
          <span class="service-name">${mod.description}</span>
          ${detailHtml}
        </td>
        <td class="service-price">${priceFormatted}</td>
      </tr>
    `;
  }).join('');

  html = html.replace('{{servicesRows}}', servicesRowsHtml);

  // 3. Total
  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  html = html.replace('{{total}}', totalFormatted);

  // 4. Crear iframe oculto
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '794px';
  iframe.style.height = 'auto'; // altura automática según contenido
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Esperar a que cargue y renderice
  await new Promise(resolve => {
    iframe.onload = resolve;
    if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
      resolve();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 400));

  try {
    // Capturar el contenedor .pdf-container (no el body)
    const container = iframe.contentDocument.querySelector('.pdf-container');
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
      width: 794,
      height: container.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();  // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Escala para ajustar el ancho de la imagen al ancho de la página
    const scale = pdfWidth / imgWidth;
    const scaledHeight = imgHeight * scale;

    if (scaledHeight <= pdfHeight) {
      // Una sola página
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, scaledHeight);
    } else {
      // Múltiples páginas
      const pageHeightPx = pdfHeight / scale; // altura en píxeles de la imagen por página
      let remainingHeight = imgHeight;
      let yOffset = 0;

      while (remainingHeight > 0) {
        const srcY = yOffset;
        const srcHeight = Math.min(pageHeightPx, remainingHeight);

        // Crear canvas temporal para la porción
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = srcHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);

        const portionData = tempCanvas.toDataURL('image/jpeg', 0.95);
        const portionHeightMm = srcHeight * scale;

        if (pdf.internal.getNumberOfPages() > 1) {
          pdf.addPage();
        }
        pdf.addImage(portionData, 'JPEG', 0, 0, pdfWidth, portionHeightMm);

        remainingHeight -= srcHeight;
        yOffset += srcHeight;
      }
    }

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
