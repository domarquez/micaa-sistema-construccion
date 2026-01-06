// Resend Email Service - Integration with Replit Connector
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

class ResendEmailService {
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    try {
      const { client, fromEmail } = await getResendClient();
      
      const { error } = await client.emails.send({
        from: fromEmail || 'MICAA <noreply@micaa.store>',
        to: email,
        subject: '🔐 MICAA - Código de Verificación',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">🏗️ MICAA</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0;">Sistema Integral de Construcción</p>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <h2 style="color: #1e293b; margin-top: 0;">Código de Verificación</h2>
              <p style="color: #475569;">Tu código de verificación es:</p>
              <div style="background: #1e293b; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
                ${code}
              </div>
              <p style="color: #64748b; font-size: 14px;">Este código expira en <strong>10 minutos</strong>.</p>
              <p style="color: #64748b; font-size: 14px;">Si no solicitaste este código, ignora este mensaje.</p>
            </div>
            <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">© 2025 MICAA - Bolivia</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error('Error sending verification email:', error);
        return false;
      }

      console.log('Verification email sent successfully to:', email);
      return true;
    } catch (error) {
      console.error('Error in sendVerificationCode:', error);
      return false;
    }
  }

  async sendPasswordResetCode(email: string, code: string): Promise<boolean> {
    try {
      const { client, fromEmail } = await getResendClient();
      
      const { error } = await client.emails.send({
        from: fromEmail || 'MICAA <noreply@micaa.store>',
        to: email,
        subject: '🔑 MICAA - Recuperar Contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">🏗️ MICAA</h1>
              <p style="color: #fef3c7; margin: 10px 0 0;">Sistema Integral de Construcción</p>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <h2 style="color: #1e293b; margin-top: 0;">Recuperar Contraseña</h2>
              <p style="color: #475569;">Tu código de recuperación es:</p>
              <div style="background: #1e293b; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
                ${code}
              </div>
              <p style="color: #64748b; font-size: 14px;">Este código expira en <strong>10 minutos</strong>.</p>
              <p style="color: #64748b; font-size: 14px;">Si no solicitaste restablecer tu contraseña, ignora este mensaje.</p>
            </div>
            <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">© 2025 MICAA - Bolivia</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error('Error sending password reset email:', error);
        return false;
      }

      console.log('Password reset email sent successfully to:', email);
      return true;
    } catch (error) {
      console.error('Error in sendPasswordResetCode:', error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
    try {
      const { client, fromEmail } = await getResendClient();
      
      const { error } = await client.emails.send({
        from: fromEmail || 'MICAA <noreply@micaa.store>',
        to: email,
        subject: '👋 ¡Bienvenido a MICAA!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">🏗️ MICAA</h1>
              <p style="color: #d1fae5; margin: 10px 0 0;">Sistema Integral de Construcción</p>
            </div>
            <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <h2 style="color: #1e293b; margin-top: 0;">¡Bienvenido, ${userName}!</h2>
              <p style="color: #475569;">Tu cuenta ha sido verificada exitosamente.</p>
              <p style="color: #475569;">Ahora puedes:</p>
              <ul style="color: #475569;">
                <li>Crear presupuestos de construcción</li>
                <li>Gestionar materiales y proveedores</li>
                <li>Calcular costos con precios regionales</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.micaa.store" style="background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ir a MICAA</a>
              </div>
              <p style="color: #64748b; font-size: 14px;">¡Gracias por unirte a MICAA!</p>
            </div>
            <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">© 2025 MICAA - Bolivia</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error('Error sending welcome email:', error);
        return false;
      }

      console.log('Welcome email sent successfully to:', email);
      return true;
    } catch (error) {
      console.error('Error in sendWelcomeEmail:', error);
      return false;
    }
  }

  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async isConfigured(): Promise<boolean> {
    try {
      await getCredentials();
      return true;
    } catch {
      return false;
    }
  }
}

export const resendService = new ResendEmailService();
