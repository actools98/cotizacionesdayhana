import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { convertCurrency } from './currencyConverter.js';
import { formatCurrency } from '../utils/formatters.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCOP) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Título
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Cotización - actols', pageWidth / 2, 20, { align: 'center' });

  // Datos del cliente
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clientName}`, 14, 35);
  doc.text(`Producto o servicio: ${productName}`, 14, 42);
  const today = new Date().toLocaleDateString('es-CO');
  doc.text(`Fecha: ${today}`, 14, 49);

  // Listado de servicios
  let y = 56;
  const lineHeight = 5;
  const margin = 14;
  const maxWidth = pageWidth - 2 * margin;

  selectedModules.forEach((mod, index) => {
    const priceFormatted = formatCurrency(convertCurrency(mod.price, currency), currency);

    // Nombre del servicio (negrita)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Servicio: ${mod.description}`, margin, y);
    // Precio alineado a la derecha
    doc.setFont('helvetica', 'normal');
    const priceX = pageWidth - margin - doc.getTextWidth(priceFormatted);
    doc.text(priceFormatted, priceX, y);
    y += lineHeight + 2;

    // Detalle (si existe)
    if (mod.detail) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const detailLines = doc.splitTextToSize(mod.detail, maxWidth);
      doc.text(detailLines, margin, y);
      y += detailLines.length * lineHeight + 4;
    } else {
      y += 4;
    }

    // Línea separadora
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  });

  // Total
  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${totalFormatted}`, pageWidth - margin, y, { align: 'right' });
  y += 10;

  // Pie de página
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('Esta cotización es válida por 30 días.', margin, y);
  doc.text('powered by actols', margin, y + 7);

  // Guardar PDF
  const fileName = `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
