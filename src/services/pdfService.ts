import PDFDocument from 'pdfkit';
import type { appointments, customers, companies, technicians, services } from '../db/schema.js';

type AppointmentFullData = {
  appointment: typeof appointments.$inferSelect;
  customer: typeof customers.$inferSelect | null;
  company: typeof companies.$inferSelect | null;
  technician: typeof technicians.$inferSelect | null;
  service: typeof services.$inferSelect | null;
};

export class PdfService {
  static async generateAppointmentPdf(data: AppointmentFullData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const { appointment, customer, company, technician, service } = data;

      // ── Header ──────────────────────────────────────────────────────────────
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Comprobante de Servicio Finalizado', { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#555555').text('AutoServices', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.fillColor('#000000').moveDown();

      // ── Datos de la cita ────────────────────────────────────────────────────
      doc.fontSize(13).font('Helvetica-Bold').text('Informacion de la Cita');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      PdfService.row(doc, 'ID de Cita', String(appointment.id));
      PdfService.row(doc, 'Fecha', appointment.appointmentDate ?? 'N/A');
      PdfService.row(doc, 'Hora', appointment.startTime ?? 'N/A');
      PdfService.row(doc, 'Estado', appointment.status ?? 'N/A');
      if (appointment.content) PdfService.row(doc, 'Notas', appointment.content);
      doc.moveDown();

      // ── Empresa ─────────────────────────────────────────────────────────────
      doc.fontSize(13).font('Helvetica-Bold').text('Empresa');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      PdfService.row(doc, 'Nombre', company?.name ?? 'N/A');
      PdfService.row(doc, 'Telefono', appointment.companyPhone);
      if (company?.email) PdfService.row(doc, 'Email', company.email);
      if (company?.address) PdfService.row(doc, 'Direccion', company.address);
      doc.moveDown();

      // ── Cliente ─────────────────────────────────────────────────────────────
      doc.fontSize(13).font('Helvetica-Bold').text('Cliente');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      PdfService.row(doc, 'Nombre', customer?.name ?? 'N/A');
      PdfService.row(doc, 'Telefono', appointment.customerPhone ?? 'N/A');
      if (customer?.email) PdfService.row(doc, 'Email', customer.email);
      if (customer?.address) PdfService.row(doc, 'Direccion', customer.address);
      doc.moveDown();

      // ── Tecnico ─────────────────────────────────────────────────────────────
      doc.fontSize(13).font('Helvetica-Bold').text('Tecnico Asignado');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      PdfService.row(doc, 'Nombre', technician?.name ?? 'N/A');
      PdfService.row(doc, 'Telefono', appointment.technicianPhone ?? 'N/A');
      if (technician?.email) PdfService.row(doc, 'Email', technician.email);
      doc.moveDown();

      // ── Servicio ─────────────────────────────────────────────────────────────
      if (service) {
        doc.fontSize(13).font('Helvetica-Bold').text('Servicio Realizado');
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica');
        PdfService.row(doc, 'Nombre', service.name);
        if (service.description) PdfService.row(doc, 'Descripcion', service.description);
        if (service.category) PdfService.row(doc, 'Categoria', service.category);
        PdfService.row(doc, 'Duracion estimada', `${service.estimatedDurationMinutes} minutos`);
        doc.moveDown();
      }

      // ── Confirmaciones ───────────────────────────────────────────────────────
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown();
      doc.fontSize(13).font('Helvetica-Bold').text('Confirmaciones de Finalizacion');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');

      const tecStatus = appointment.estatusTecnico ? '[CONFIRMADO]' : '[PENDIENTE]';
      const adminStatus = appointment.estatusAdministrador ? '[CONFIRMADO]' : '[PENDIENTE]';

      doc
        .font('Helvetica-Bold').fillColor(appointment.estatusTecnico ? '#1a7a1a' : '#b00000')
        .text(`Tecnico: ${tecStatus}`, { continued: false });
      doc
        .font('Helvetica-Bold').fillColor(appointment.estatusAdministrador ? '#1a7a1a' : '#b00000')
        .text(`Administrador: ${adminStatus}`);

      doc.fillColor('#000000').moveDown(2);

      // ── Footer ───────────────────────────────────────────────────────────────
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
      doc
        .fontSize(8)
        .fillColor('#888888')
        .text(
          `Documento generado el ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`,
          { align: 'center' }
        );

      doc.end();
    });
  }

  private static row(doc: InstanceType<typeof PDFDocument>, label: string, value: string) {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);
  }
}
