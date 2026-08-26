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

  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  html = html.replace('{{total}}', totalFormatted);

  // 3. Crear iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '794px';
  iframe.style.height = '1px'; // se ajustará después
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Esperar a que cargue
  await new Promise(resolve => {
    iframe.onload = resolve;
    if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
      resolve();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const container = iframe.contentDocument.querySelector('.pdf-container');
    // Ajustar altura del iframe al contenido
    iframe.style.height = container.scrollHeight + 'px';

    // Capturar el contenedor
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: true, // activar logs para depurar
      allowTaint: false,
      width: 794,
      height: container.scrollHeight,
    });

    console.log('Canvas width:', canvas.width, 'height:', canvas.height);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();  // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Escala para ajustar el ancho de la imagen al ancho de la página
    const scale = pdfWidth / imgWidth;
    const scaledHeight = imgHeight * scale;

    console.log('imgWidth:', imgWidth, 'imgHeight:', imgHeight);
    console.log('scale:', scale, 'scaledHeight:', scaledHeight);
    console.log('pdfHeight:', pdfHeight);

    if (scaledHeight <= pdfHeight) {
      // Una sola página
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, scaledHeight);
    } else {
      // Múltiples páginas
      const pageHeightPx = pdfHeight / scale; // altura en píxeles de la imagen por página
      console.log('pageHeightPx:', pageHeightPx);
      let remainingHeight = imgHeight;
      let yOffset = 0;
      let pageCount = 0;

      while (remainingHeight > 0) {
        const srcY = yOffset;
        const srcHeight = Math.min(pageHeightPx, remainingHeight);
        console.log(`Página ${pageCount + 1}: srcY=${srcY}, srcHeight=${srcHeight}, remaining=${remainingHeight}`);

        // Crear canvas temporal para la porción
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = srcHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);

        const portionData = tempCanvas.toDataURL('image/jpeg', 0.95);
        const portionHeightMm = srcHeight * scale;

        if (pageCount > 0) {
          pdf.addPage();
        }
        pdf.addImage(portionData, 'JPEG', 0, 0, pdfWidth, portionHeightMm);

        remainingHeight -= srcHeight;
        yOffset += srcHeight;
        pageCount++;
      }
      console.log(`Total páginas: ${pageCount}`);
    }

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
