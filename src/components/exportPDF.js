import html2pdf from 'html2pdf.js';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCHF, lang = 'es') {
  // ... (rellenar html igual que antes) ...

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '1080px';
  container.style.background = '#ffffff';
  container.style.zIndex = '9999';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const opt = {
      margin: [0, 0, 0, 0],
      filename: `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: container.scrollWidth,
        height: container.scrollHeight,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };
    await html2pdf().set(opt).from(container).save();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
}
