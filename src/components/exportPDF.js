import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCHF, lang = 'es') {
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

  const iframe = document.createElement('iframe');
  
  // EL TRUCO CLAVE: Mantenemos el iframe en la coordenada 0,0 de la pantalla
  // para que el navegador lo renderice completo, pero lo hacemos invisible.
  iframe.style.position = 'fixed';
  iframe.style.top = '0px';
  iframe.style.left = '0px';
  iframe.style.width = '794px';
  iframe.style.height = '1123px'; // Le damos altura inicial de un A4 aprox
  iframe.style.border = 'none';
  iframe.style.background = '#ffffff';
  iframe.style.opacity = '0'; // Invisible al ojo humano
  iframe.style.zIndex = '-9999'; // Detrás de todo el contenido
  iframe.style.pointerEvents = 'none'; // No se puede interactuar con él
  
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
    
    // Ajustamos la altura final basada en el contenido real
    iframe.style.height = body.scrollHeight + 'px';

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
      // Al estar en el punto 0,0, forzamos estas coordenadas para que no tome offsets extra
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: 794,
      windowWidth: 794,
    });

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdfWidth = 210;
    const scale = pdfWidth / imgWidth;
    const pdfHeight = imgHeight * scale;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
