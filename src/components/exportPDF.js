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

  // 2. Extraer los estilos de la plantilla
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const styles = styleMatch ? styleMatch[1] : '';

  // 3. Crear el documento HTML completo para la nueva pestaña
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotización - actols</title>
  <!-- Cargar html2pdf desde CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" integrity="sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <style>
    ${styles}
    /* Asegurar que el body ocupe todo el ancho disponible */
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      background: #ffffff;
    }
    .pdf-container {
      max-width: 100%;
      width: 100%;
    }
  </style>
</head>
<body>
  ${html}
  <script>
    // Ejecutar html2pdf automáticamente cuando la página cargue
    window.onload = function() {
      const container = document.querySelector('.pdf-container');
      if (!container) {
        console.error('No se encontró el contenedor .pdf-container');
        return;
      }

      const opt = {
        margin:        [0, 0, 0, 0],
        filename:      '${`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`}',
        image:         { type: 'jpeg', quality: 0.95 },
        html2canvas:   {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: container.scrollWidth,
          height: container.scrollHeight,
        },
        jsPDF:         {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak:     { mode: ['avoid-all', 'css', 'legacy'] }
      };

      html2pdf().set(opt).from(container).save().then(() => {
        // Cerrar la pestaña después de guardar (con un pequeño retraso para asegurar la descarga)
        setTimeout(() => window.close(), 500);
      }).catch((error) => {
        console.error('Error al generar PDF:', error);
        alert('Error al generar el PDF. Revisa la consola para más detalles.');
      });
    };
  </script>
</body>
</html>
  `;

  // 4. Abrir una nueva pestaña con el contenido
  const newWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!newWindow) {
    throw new Error('No se pudo abrir la nueva ventana. Por favor, permite ventanas emergentes para este sitio.');
  }

  // Escribir el HTML en la nueva ventana
  newWindow.document.write(fullHtml);
  newWindow.document.close();
}
