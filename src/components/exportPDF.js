import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getSelectedModules } from './quoteCalculator.js';
import { convertCurrency } from './currencyConverter.js';
import { formatCurrency } from '../utils/formatters.js';

export async function generateQuotePDF(clientName, productName, checkedIds, currency, totalCOP, modules) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Cotización - actols', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clientName}`, 14, 35);
  doc.text(`Producto o servicio: ${productName}`, 14, 42);
  const today = new Date().toLocaleDateString('es-CO');
  doc.text(`Fecha: ${today}`, 14, 49);

  const selected = getSelectedModules(checkedIds, modules);
  const tableRows = selected.map(mod => {
    const priceConverted = convertCurrency(mod.price, currency);
    const priceFormatted = formatCurrency(priceConverted, currency);
    return [mod.description, priceFormatted];
  });

  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);

  doc.autoTable({
    startY: 56,
    head: [['Descripción', 'Precio']],
    body: tableRows,
    foot: [['Total', totalFormatted]],
    theme: 'striped',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [79, 70, 229] },
    footStyles: { fillColor: [240, 240, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Esta cotización es válida por 30 días.', 14, finalY);
  doc.text('powered by actols', 14, finalY + 7);

  const fileName = `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
