import { config } from '../config/index.js';

export async function sendInviteEmail(params: {
  to: string;
  name: string;
  role: 'company' | 'technician';
  token: string;
}): Promise<void> {
  if (!config.resendApiKey) {
    console.warn(`[email] RESEND_API_KEY not set — invite token for ${params.to}: ${params.token}`);
    return;
  }

  const link = `${config.appUrl}/set-password?token=${params.token}`;
  const roleLabel = params.role === 'company' ? 'administrador' : 'técnico';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.resendFromEmail,
      to: params.to,
      subject: 'Configura tu contraseña — AutoServices',
      html: `
        <h2>Bienvenido, ${params.name}</h2>
        <p>Has sido registrado como ${roleLabel} en AutoServices.</p>
        <p>Haz clic en el siguiente enlace para configurar tu contraseña (válido por 24 horas):</p>
        <p><a href="${link}">Configurar contraseña</a></p>
        <p>Si no esperabas este correo, puedes ignorarlo.</p>
      `,
    }),
  });
}
