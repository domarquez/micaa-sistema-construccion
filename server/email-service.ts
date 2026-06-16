import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private notificationEmail: string;
  private isConfigured: boolean;

  constructor() {
    // Validate required environment variables
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`⚠️ Email service not fully configured. Missing: ${missingVars.join(', ')}`);
      console.warn('Email functionality will be limited. Please configure SMTP credentials.');
      this.isConfigured = false;
    } else {
      this.isConfigured = true;
    }

    this.notificationEmail = process.env.NOTIFICATION_EMAIL || 'contacto@micaaa.top';
    
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const config: any = {
      host: process.env.SMTP_HOST || 'mail.micaaa.top',
      port: smtpPort,
      secure: smtpPort === 465, // SSL for port 465, false for 587 (uses STARTTLS)
      requireTLS: smtpPort === 587, // Force TLS upgrade for port 587
      connectionTimeout: 10000, // 10 seconds connection timeout
      greetingTimeout: 10000, // 10 seconds greeting timeout
      socketTimeout: 15000, // 15 seconds socket timeout
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    };

    this.transporter = nodemailer.createTransport(config);
    
    // Log configuration status
    if (this.isConfigured) {
      console.log('📧 Email service configured with:');
      console.log(`   Host: ${config.host}:${config.port}`);
      console.log(`   User: ${config.auth.user}`);
      console.log(`   Notification email: ${this.notificationEmail}`);
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.error('Cannot send email: SMTP service is not properly configured');
      return false;
    }

    try {
      const mailOptions = {
        from: `"MICAA Sistema" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  // Notificación de nueva inscripción
  async notifyNewRegistration(userData: {
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
  }): Promise<boolean> {
    const subject = '🔔 Nueva Inscripción en MICAA';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">
          Nueva Inscripción en MICAA
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Detalles del Usuario:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Usuario:</td>
              <td style="padding: 8px; color: #374151;">${userData.username}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Email:</td>
              <td style="padding: 8px; color: #374151;">${userData.email}</td>
            </tr>
            ${userData.firstName ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Nombre:</td>
              <td style="padding: 8px; color: #374151;">${userData.firstName} ${userData.lastName || ''}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Rol:</td>
              <td style="padding: 8px; color: #374151;">${userData.role}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Fecha:</td>
              <td style="padding: 8px; color: #374151;">${new Date().toLocaleString('es-ES')}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Este email fue enviado automáticamente por el sistema MICAA.
        </p>
      </div>
    `;

    return await this.sendEmail(this.notificationEmail, subject, html);
  }

  // Notificación de solicitud/sugerencia
  async notifyContactRequest(contactData: {
    name: string;
    email: string;
    message: string;
    type: 'contact' | 'suggestion' | 'support';
  }): Promise<boolean> {
    const typeLabels = {
      contact: 'Contacto',
      suggestion: 'Sugerencia',
      support: 'Soporte'
    };

    const subject = `📨 Nueva ${typeLabels[contactData.type]} - MICAA`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">
          Nueva ${typeLabels[contactData.type]} Recibida
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Detalles:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Nombre:</td>
              <td style="padding: 8px; color: #374151;">${contactData.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Email:</td>
              <td style="padding: 8px; color: #374151;">${contactData.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Tipo:</td>
              <td style="padding: 8px; color: #374151;">${typeLabels[contactData.type]}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Fecha:</td>
              <td style="padding: 8px; color: #374151;">${new Date().toLocaleString('es-ES')}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h4 style="color: #374151; margin-top: 0;">Mensaje:</h4>
          <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${contactData.message}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          Responder a: ${contactData.email}
        </p>
      </div>
    `;

    return await this.sendEmail(this.notificationEmail, subject, html);
  }

  // Envío de credenciales de recuperación
  async sendPasswordRecovery(userEmail: string, userData: {
    username: string;
    tempPassword: string;
    firstName?: string;
    loginUrl?: string;
  }): Promise<boolean> {
    const subject = '🔑 Nueva Contraseña Temporal - MICAA';
    const name = userData.firstName || userData.username;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">
          Nueva Contraseña Temporal
        </h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Hola <strong>${name}</strong>,<br><br>
          Hemos generado una nueva contraseña temporal para tu cuenta en MICAA.
        </p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af;">
          <h3 style="color: #374151; margin-top: 0;">Tus Datos de Acceso:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Usuario:</td>
              <td style="padding: 8px; color: #374151; font-family: monospace; background-color: #e5e7eb; border-radius: 4px;">${userData.username}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #6b7280;">Contraseña Temporal:</td>
              <td style="padding: 8px; color: #dc2626; font-family: monospace; background-color: #fef2f2; border-radius: 4px; font-size: 18px; font-weight: bold;">${userData.tempPassword}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="color: #92400e; margin: 0; font-weight: bold;">⚠️ Importante:</p>
          <p style="color: #92400e; margin: 5px 0 0 0;">
            Esta es una contraseña temporal. Te recomendamos cambiarla por una de tu preferencia después de iniciar sesión.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${userData.loginUrl || 'http://localhost:5000'}/login" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Iniciar Sesión Ahora
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Si no solicitaste este cambio, contacta inmediatamente a soporte.
          Este email fue enviado automáticamente por el sistema MICAA desde contacto@micaaa.top.
        </p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }

  // Email de bienvenida
  async sendWelcomeEmail(userEmail: string, userData: {
    username: string;
    firstName?: string;
  }): Promise<boolean> {
    const subject = '👋 Bienvenido a MICAA - Tu cuenta ha sido creada';
    const name = userData.firstName || userData.username;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">
          ¡Bienvenido a MICAA!
        </h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Hola ${name},<br><br>
          ¡Tu cuenta en MICAA ha sido creada exitosamente! Ya puedes acceder a todas las funcionalidades del sistema.
        </p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">¿Qué puedes hacer en MICAA?</h3>
          <ul style="color: #374151; line-height: 1.8;">
            <li>📋 Crear y gestionar presupuestos de construcción</li>
            <li>🧱 Explorar nuestro catálogo de más de 1,700 materiales</li>
            <li>⚙️ Utilizar análisis de precios unitarios (APU)</li>
            <li>🏢 Conectar con proveedores verificados</li>
            <li>📊 Generar reportes detallados</li>
          </ul>
        </div>
        
        <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af;">
          <p style="color: #1e40af; margin: 0; font-weight: bold;">💡 Consejo:</p>
          <p style="color: #1e40af; margin: 5px 0 0 0;">
            Guarda este email para futura referencia. Tu dirección de correo es importante para la recuperación de contraseña.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://micaaa.top'}/dashboard" 
             style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Comenzar a Usar MICAA
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          MICAA - Sistema Integral de Construcción y Arquitectura<br>
          contacto@micaaa.top | https://micaaa.top
        </p>
      </div>
    `;

    return await this.sendEmail(userEmail, subject, html);
  }
}

export const emailService = new EmailService();