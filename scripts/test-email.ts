import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { appointments } from '../src/db/schema.js';
import { EmailService } from '../src/services/emailService.js';

const results = await db
  .select()
  .from(appointments)
  .where(and(eq(appointments.estatusTecnico, true), eq(appointments.estatusAdministrador, true)));

if (results.length === 0) {
  console.log('No hay citas con ambos estatus en true');
  process.exit(0);
}

const appt = results[0];
console.log(`Cita encontrada: #${appt.id} | customer: ${appt.customerPhone} | company: ${appt.companyPhone}`);
console.log('Enviando email...');

await EmailService.sendAppointmentCompletionEmail(appt.id);
console.log('Listo.');
process.exit(0);
