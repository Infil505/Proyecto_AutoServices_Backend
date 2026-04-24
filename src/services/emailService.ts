import { Resend } from 'resend';
import { config } from '../config/index.js';
import { AppointmentService } from './appointmentService.js';
import { PdfService } from './pdfService.js';
import { generateICS } from '../utils/ics.js';
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

  static async sendAppointmentCreatedEmails(
    full: NonNullable<Awaited<ReturnType<typeof AppointmentService.getFullById>>>,
    calendarLink?: string,
  ): Promise<void> {
    const { appointment, customer, technician, company, service } = full;
    if (!config.resendApiKey) return;

    const duration = service?.estimatedDurationMinutes ?? 60;
    const coords = appointment.coordinates as { lat?: number; lng?: number } | null;
    const location = coords?.lat && coords?.lng ? `${coords.lat},${coords.lng}` : undefined;

    const descLines = [
      `Servicio: ${service?.name ?? 'N/A'}`,
      `Técnico: ${technician?.name ?? 'N/A'}`,
      `Cliente: ${customer?.name ?? 'N/A'} (${appointment.customerPhone ?? ''})`,
      `Empresa: ${company?.name ?? 'N/A'}`,
      ...(appointment.description ? [`Notas: ${appointment.description}`] : []),
    ];

    const icsBuffer = generateICS({
      uid: `apt-${appointment.id}`,
      title: `Cita #${appointment.id} — ${service?.name ?? 'Servicio'}`,
      description: descLines.join('\n'),
      date: appointment.appointmentDate!,
      startTime: appointment.startTime!,
      durationMinutes: duration,
      location,
    });

    const calendarSection = calendarLink
      ? `<p><a href="${calendarLink}" style="color:#1a6fb5;">Ver evento en Google Calendar</a></p>`
      : '';

    const baseTable = `
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Fecha</td>
            <td style="padding:8px;border:1px solid #ddd;">${appointment.appointmentDate ?? 'N/A'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Hora</td>
            <td style="padding:8px;border:1px solid #ddd;">${(appointment.startTime ?? 'N/A').slice(0, 5)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Servicio</td>
            <td style="padding:8px;border:1px solid #ddd;">${service?.name ?? 'N/A'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Técnico</td>
            <td style="padding:8px;border:1px solid #ddd;">${technician?.name ?? 'N/A'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Empresa</td>
            <td style="padding:8px;border:1px solid #ddd;">${company?.name ?? 'N/A'}</td></tr>
        ${appointment.description ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Notas</td>
            <td style="padding:8px;border:1px solid #ddd;">${appointment.description}</td></tr>` : ''}
      </table>`;

    const icsAttachment = {
      filename: `cita-${appointment.id}.ics`,
      content: icsBuffer,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    };

    const sends: Promise<unknown>[] = [];

    // Email al cliente
    if (customer?.email) {
      sends.push(
        getResend().emails.send({
          from: config.resendFromEmail,
          to: customer.email,
          subject: `Confirmación de cita #${appointment.id} — AutoServices`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
            <h2 style="color:#1a6fb5;">Cita confirmada</h2>
            <p>Estimado/a <strong>${customer.name ?? 'cliente'}</strong>,</p>
            <p>Su cita ha sido programada. Adjunto encontrará el archivo para agregarlo a su calendario.</p>
            ${baseTable}${calendarSection}
            <p style="color:#888;font-size:12px;">AutoServices — Este correo fue generado automáticamente.</p>
          </div>`,
          attachments: [icsAttachment],
        }).then(({ error }) => {
          if (error) logger.warn(`[EmailService] Error email cliente cita ${appointment.id}: ${error.message}`);
          else logger.info(`[EmailService] Invitación enviada a cliente ${customer.email}`);
        }),
      );
    }

    // Email al técnico
    if (technician?.email) {
      sends.push(
        getResend().emails.send({
          from: config.resendFromEmail,
          to: technician.email,
          subject: `Nueva cita asignada #${appointment.id} — AutoServices`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
            <h2 style="color:#1a6fb5;">Cita asignada</h2>
            <p>Hola <strong>${technician.name ?? 'técnico'}</strong>,</p>
            <p>Se te ha asignado una nueva cita. Adjunto el archivo para agregar al calendario.</p>
            ${baseTable}${calendarSection}
            <p style="color:#888;font-size:12px;">AutoServices — Este correo fue generado automáticamente.</p>
          </div>`,
          attachments: [icsAttachment],
        }).then(({ error }) => {
          if (error) logger.warn(`[EmailService] Error email técnico cita ${appointment.id}: ${error.message}`);
          else logger.info(`[EmailService] Invitación enviada a técnico ${technician.email}`);
        }),
      );
    }

    // Email a la empresa
    if (company?.email) {
      sends.push(
        getResend().emails.send({
          from: config.resendFromEmail,
          to: company.email,
          subject: `Nueva cita creada #${appointment.id} — AutoServices`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
            <h2 style="color:#1a6fb5;">Nueva cita creada</h2>
            <p>Se ha creado una nueva cita en su empresa <strong>${company.name ?? ''}</strong>.</p>
            ${baseTable}${calendarSection}
            <p style="color:#888;font-size:12px;">AutoServices — Este correo fue generado automáticamente.</p>
          </div>`,
          attachments: [icsAttachment],
        }).then(({ error }) => {
          if (error) logger.warn(`[EmailService] Error email empresa cita ${appointment.id}: ${error.message}`);
          else logger.info(`[EmailService] Invitación enviada a empresa ${company.email}`);
        }),
      );
    }

    await Promise.allSettled(sends);
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
