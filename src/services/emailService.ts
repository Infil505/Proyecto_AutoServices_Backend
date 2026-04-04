import { Resend } from 'resend';
import { config } from '../config/index.js';
import { AppointmentService } from './appointmentService.js';
import { PdfService } from './pdfService.js';
import logger from '../utils/logger.js';

// Lazy — instanciado la primera vez que se envía un correo para evitar error en tests sin key
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!config.resendApiKey) throw new Error('RESEND_API_KEY no está configurado');
    _resend = new Resend(config.resendApiKey);
  }
  return _resend;
}

export class EmailService {
  static async sendAppointmentCompletionEmail(appointmentId: number): Promise<void> {
    const fullData = await AppointmentService.getFullById(appointmentId);
    if (!fullData) {
      logger.warn(`[EmailService] Cita ${appointmentId} no encontrada`);
      return;
    }

    const { appointment, customer, company } = fullData;

    if (!customer?.email) {
      logger.warn(`[EmailService] Cliente de cita ${appointmentId} no tiene email registrado`);
      return;
    }

    const pdfBuffer = await PdfService.generateAppointmentPdf(fullData);

    const { error } = await getResend().emails.send({
      from: config.resendFromEmail,
      to: customer.email,
      subject: `Comprobante de Servicio — Cita #${appointment.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #1a7a1a;">Servicio completado</h2>
          <p>Estimado/a <strong>${customer.name ?? 'cliente'}</strong>,</p>
          <p>
            Su cita <strong>#${appointment.id}</strong> programada para el
            <strong>${appointment.appointmentDate ?? 'N/A'}</strong> a las
            <strong>${appointment.startTime ?? 'N/A'}</strong>
            ha sido completada satisfactoriamente.
          </p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Empresa</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${company?.name ?? 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Estado</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #1a7a1a;">${appointment.status ?? 'N/A'}</td>
            </tr>
          </table>
          <p>Adjunto encontrará el comprobante de servicio en formato PDF.</p>
          <p style="color: #888; font-size: 12px;">Este correo fue generado automáticamente por AutoServices.</p>
        </div>
      `,
      attachments: [
        {
          filename: `cita-${appointment.id}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      logger.error(`[EmailService] Error al enviar email para cita ${appointmentId}: ${error.message}`);
      throw new Error(error.message);
    }

    logger.info(`[EmailService] Comprobante de cita ${appointmentId} enviado a ${customer.email}`);
  }

  /**
   * Registra el listener sobre AppointmentService.events.
   * Llamar una sola vez desde index.ts al arrancar el servidor.
   */
  static startEmailListener(): void {
    AppointmentService.events.on('appointment:both_completed', async (appointment: { id: number }) => {
      try {
        await EmailService.sendAppointmentCompletionEmail(appointment.id);
      } catch (err) {
        logger.error(`[EmailService] Fallo al procesar evento both_completed para cita ${appointment.id}: ${err}`);
      }
    });
    logger.info('[EmailService] Listener de correos iniciado');
  }
}
