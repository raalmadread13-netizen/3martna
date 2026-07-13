import PDFDocument from 'pdfkit';

export interface ReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  paidByName: string;
  buildingName: string;
  apartmentNumber: string;
  amount: number;
  method: string;
  paidAt: Date;
  referenceNumber?: string | null;
}

/** Render a payment receipt PDF and return it as a Buffer. */
export const buildReceiptPdf = (receipt: ReceiptData): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('3martna | Payment Receipt', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text('Amman, Jordan — support@3martna.jo', { align: 'center' });
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(11);
    const rows: Array<[string, string]> = [
      ['Receipt No.', receipt.receiptNumber],
      ['Invoice No.', receipt.invoiceNumber],
      ['Paid By', receipt.paidByName],
      ['Building', receipt.buildingName],
      ['Apartment', receipt.apartmentNumber],
      ['Amount', `${receipt.amount.toFixed(2)} JOD`],
      ['Method', receipt.method],
      ['Reference', receipt.referenceNumber ?? '—'],
      ['Date', receipt.paidAt.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'],
    ];
    for (const [label, value] of rows) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
      doc.moveDown(0.35);
    }

    doc.moveDown(1);
    doc.fontSize(9).fillColor('#666')
      .text('This receipt is generated electronically and is valid without a signature.', {
        align: 'center',
      });
    doc.end();
  });
