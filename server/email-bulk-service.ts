import * as nodemailer from 'nodemailer';
import { db } from './db';
import { supplierCompanies, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface BulkEmailJob {
  id: string;
  emails: Array<{
    to: string;
    companyName: string;
    contactName: string;
    userId?: number;
  }>;
  template: string;
  subject: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sentCount: number;
  totalCount: number;
  createdAt: Date;
  completedAt?: Date;
  errors: string[];
}

class BulkEmailService {
  private transporter: nodemailer.Transporter;
  private jobs: Map<string, BulkEmailJob> = new Map();
  private isProcessing = false;
  private readonly DELAY_BETWEEN_EMAILS = 300000; // 5 minutos entre emails (300,000 ms)
  private readonly BATCH_SIZE = 5; // Máximo 5 emails por lote
  private readonly BATCH_DELAY = 1800000; // 30 minutos entre lotes (1,800,000 ms)
  private readonly TEST_EMAILS = ['domarquez@yahoo.com', 'grupoeclipsew@gmail.com']; // Emails de prueba

  constructor() {
    // Configurar SMTP con el correo existente
    this.transporter = nodemailer.createTransport({
      host: 'mail.micaaa.top',
      port: 587,
      secure: false, // true para 465, false para otros puertos
      auth: {
        user: 'contacto@micaaa.top',
        pass: process.env.EMAIL_PASSWORD || 'your-email-password'
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  /**
   * Obtiene todas las empresas proveedoras para envío masivo
   */
  async getSupplierCompaniesForBulkEmail(): Promise<Array<{
    to: string;
    companyName: string;
    contactName: string;
    userId?: number;
  }>> {
    try {
      // Primero obtenemos las empresas proveedoras activas
      const companies = await db
        .select()
        .from(supplierCompanies)
        .where(eq(supplierCompanies.isActive, true));

      console.log(`Found ${companies.length} active supplier companies`);

      // Para cada empresa, obtenemos los datos del usuario si existe
      const emailList = await Promise.all(
        companies.map(async (company) => {
          let userData = null;
          if (company.userId) {
            try {
              const user = await db.select().from(users).where(eq(users.id, company.userId)).limit(1);
              if (user.length > 0) {
                userData = user[0];
              }
            } catch (error) {
              console.error(`Error fetching user ${company.userId}:`, error);
            }
          }

          const email = company.email || userData?.email || '';
          const contactName = userData 
            ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
            : 'Estimado/a';

          return {
            to: email,
            companyName: company.companyName,
            contactName: contactName || 'Estimado/a',
            userId: company.userId || undefined
          };
        })
      );

      // Filtrar solo los que tienen email válido
      const validEmails = emailList.filter(item => item.to && item.to.includes('@'));
      console.log(`Found ${validEmails.length} companies with valid emails`);
      
      return validEmails;
    } catch (error) {
      console.error('Error fetching supplier companies:', error);
      return [];
    }
  }

  /**
   * Envía emails de prueba a las direcciones configuradas
   */
  async sendTestEmails(
    template: 'password_update' | 'advertisement_reminder' | 'data_update',
    subject: string
  ): Promise<void> {
    console.log('🧪 Enviando emails de prueba...');
    
    for (const testEmail of this.TEST_EMAILS) {
      try {
        const testData = {
          to: testEmail,
          companyName: 'EMPRESA DE PRUEBA',
          contactName: 'Administrador'
        };
        
        await this.sendSingleEmail(template, testData, `[PRUEBA] ${subject}`);
        console.log(`✅ Email de prueba enviado a ${testEmail}`);
      } catch (error) {
        console.error(`❌ Error enviando email de prueba a ${testEmail}:`, error);
      }
    }
  }

  /**
   * Crea un nuevo trabajo de envío masivo
   */
  async createBulkEmailJob(
    template: 'password_update' | 'advertisement_reminder' | 'data_update',
    customSubject?: string
  ): Promise<string> {
    const jobId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const emails = await this.getSupplierCompaniesForBulkEmail();
    
    let subject = '';
    switch (template) {
      case 'password_update':
        subject = 'MICAA - Actualiza tu contraseña y accede a nuevas funcionalidades';
        break;
      case 'advertisement_reminder':
        subject = 'MICAA - Promociona tu empresa con nuestro sistema de publicidad';
        break;
      case 'data_update':
        subject = 'MICAA - Actualiza los datos de tu empresa';
        break;
    }

    const finalSubject = customSubject || subject;

    // Enviar emails de prueba primero
    await this.sendTestEmails(template, finalSubject);

    const job: BulkEmailJob = {
      id: jobId,
      emails,
      template,
      subject: finalSubject,
      status: 'pending',
      sentCount: 0,
      totalCount: emails.length,
      createdAt: new Date(),
      errors: []
    };

    this.jobs.set(jobId, job);
    
    // Iniciar procesamiento si no está en curso
    if (!this.isProcessing) {
      this.processJobs();
    }

    return jobId;
  }

  /**
   * Obtiene el estado de un trabajo
   */
  getJobStatus(jobId: string): BulkEmailJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Obtiene todos los trabajos
   */
  getAllJobs(): BulkEmailJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Procesa la cola de trabajos de envío
   */
  private async processJobs() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('Starting bulk email processing...');

    try {
      const pendingJobs = Array.from(this.jobs.values())
        .filter(job => job.status === 'pending');

      for (const job of pendingJobs) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('Error processing bulk email jobs:', error);
    } finally {
      this.isProcessing = false;
      console.log('Bulk email processing completed');
    }
  }

  /**
   * Procesa un trabajo individual
   */
  private async processJob(job: BulkEmailJob) {
    console.log(`Processing job ${job.id} with ${job.totalCount} emails`);
    job.status = 'running';

    try {
      // Procesar en lotes para evitar sobrecarga
      for (let i = 0; i < job.emails.length; i += this.BATCH_SIZE) {
        const batch = job.emails.slice(i, i + this.BATCH_SIZE);
        
        for (const emailData of batch) {
          try {
            await this.sendSingleEmail(job.template, emailData, job.subject);
            job.sentCount++;
            console.log(`Email sent to ${emailData.companyName} (${job.sentCount}/${job.totalCount})`);
            
            // Pausa entre emails para evitar ser marcado como spam
            if (job.sentCount < job.totalCount) {
              await this.sleep(this.DELAY_BETWEEN_EMAILS);
            }
          } catch (error) {
            const errorMsg = `Error sending to ${emailData.to}: ${error}`;
            job.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
        
        // Pausa adicional entre lotes (30 minutos)
        if (i + this.BATCH_SIZE < job.emails.length) {
          console.log(`Pausing for 30 minutes before next batch...`);
          await this.sleep(this.BATCH_DELAY);
        }
      }

      job.status = 'completed';
      job.completedAt = new Date();
      console.log(`Job ${job.id} completed. Sent: ${job.sentCount}/${job.totalCount}`);
      
    } catch (error) {
      job.status = 'failed';
      job.errors.push(`Job failed: ${error}`);
      console.error(`Job ${job.id} failed:`, error);
    }
  }

  /**
   * Envía un email individual usando SMTP
   */
  private async sendSingleEmail(
    template: string,
    emailData: { to: string; companyName: string; contactName: string; userId?: number },
    subject: string
  ) {
    const htmlContent = this.generateEmailTemplate(template, emailData);
    const textContent = this.generateTextTemplate(template, emailData);

    const mailOptions = {
      from: {
        name: 'MICAA - Sistema de Construcción',
        address: 'contacto@micaaa.top'
      },
      to: emailData.to,
      subject,
      text: textContent,
      html: htmlContent,
      headers: {
        'X-Mailer': 'MICAA Bulk Email System',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal'
      }
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Genera el template HTML del email
   */
  private generateEmailTemplate(template: string, emailData: any): string {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://micaaa.top' 
      : 'http://localhost:5000';

    const commonHeader = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">MICAA</h1>
          <p style="color: #e1e5fe; margin: 5px 0 0 0;">Sistema Integral de Construcción y Arquitectura</p>
        </div>
        <div style="padding: 20px; background: white;">
    `;

    const commonFooter = `
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>© 2025 MICAA - Sistema Integral de Construcción y Arquitectura</p>
          <p>Bolivia | contacto@micaaa.top</p>
          <p style="margin-top: 15px;">
            <a href="${baseUrl}/auth/login" style="color: #667eea; text-decoration: none;">Acceder al Sistema</a> |
            <a href="${baseUrl}/public" style="color: #667eea; text-decoration: none;">Versión Pública</a>
          </p>
        </div>
      </div>
    `;

    let content = '';

    switch (template) {
      case 'password_update':
        content = `
          <h2 style="color: #667eea;">¡Hola ${emailData.contactName}!</h2>
          <p><strong>${emailData.companyName}</strong></p>
          
          <p>Te contactamos desde MICAA para informarte sobre las nuevas funcionalidades disponibles en nuestro sistema.</p>
          
          <div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #667eea; margin-top: 0;">🔐 Actualiza tu Contraseña</h3>
            <p>Para acceder a las nuevas funcionalidades, te recomendamos actualizar tu contraseña:</p>
            <ul>
              <li>Accede a tu panel de usuario</li>
              <li>Ve a "Configuración de Cuenta"</li>
              <li>Actualiza tu contraseña por una más segura</li>
            </ul>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2e7d32; margin-top: 0;">✨ Nuevas Funcionalidades</h3>
            <ul>
              <li><strong>Sistema de Publicidad:</strong> Promociona tu empresa</li>
              <li><strong>Gestión Avanzada:</strong> Mejores herramientas de administración</li>
              <li><strong>Reportes Detallados:</strong> Análisis de tu actividad</li>
              <li><strong>Integración Mejorada:</strong> Mejor experiencia de usuario</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/auth/login" style="background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">
              Acceder al Sistema
            </a>
          </div>

          <p><strong>¿Necesitas ayuda?</strong><br>
          Contáctanos en <a href="mailto:contacto@micaaa.top">contacto@micaaa.top</a></p>
        `;
        break;

      case 'advertisement_reminder':
        content = `
          <h2 style="color: #667eea;">¡Promociona tu Empresa, ${emailData.contactName}!</h2>
          <p><strong>${emailData.companyName}</strong></p>
          
          <p>¿Sabías que puedes promocionar tu empresa directamente en MICAA y llegar a más clientes potenciales?</p>
          
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #f57c00; margin-top: 0;">📢 Sistema de Publicidad MICAA</h3>
            <p>Nuestro sistema de publicidad te permite:</p>
            <ul>
              <li>Mostrar tu empresa en la página principal</li>
              <li>Destacar tus productos y servicios</li>
              <li>Llegar a arquitectos, ingenieros y constructores</li>
              <li>Aumentar tu visibilidad en el mercado boliviano</li>
            </ul>
          </div>

          <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #7b1fa2; margin-top: 0;">🚀 Cómo Empezar</h3>
            <ol>
              <li>Accede a tu panel de empresa</li>
              <li>Ve a la sección "Publicidad"</li>
              <li>Sube tu logo e información</li>
              <li>Configura tu anuncio</li>
              <li>¡Comienza a recibir más clientes!</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/auth/login" style="background: #f57c00; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">
              Crear mi Publicidad
            </a>
          </div>

          <p><strong>¿Tienes preguntas?</strong><br>
          Escríbenos a <a href="mailto:contacto@micaaa.top">contacto@micaaa.top</a></p>
        `;
        break;

      case 'data_update':
        content = `
          <h2 style="color: #667eea;">Actualiza los Datos de tu Empresa, ${emailData.contactName}</h2>
          <p><strong>${emailData.companyName}</strong></p>
          
          <p>Para brindar el mejor servicio a nuestros usuarios, te pedimos mantener actualizados los datos de tu empresa.</p>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1976d2; margin-top: 0;">📋 Información a Verificar</h3>
            <ul>
              <li><strong>Datos de Contacto:</strong> Teléfono, email, dirección</li>
              <li><strong>Servicios:</strong> Especialidades y productos que ofreces</li>
              <li><strong>Logo e Imágenes:</strong> Mantén tu imagen actualizada</li>
              <li><strong>Horarios de Atención:</strong> Información para clientes</li>
            </ul>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2e7d32; margin-top: 0;">✅ Beneficios de Mantener tus Datos Actualizados</h3>
            <ul>
              <li>Mayor confianza de los clientes</li>
              <li>Mejor posicionamiento en búsquedas</li>
              <li>Más oportunidades de negocio</li>
              <li>Comunicación efectiva con clientes</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/auth/login" style="background: #2e7d32; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">
              Actualizar Datos
            </a>
          </div>

          <p><strong>¿Necesitas asistencia?</strong><br>
          No dudes en contactarnos: <a href="mailto:contacto@micaaa.top">contacto@micaaa.top</a></p>
        `;
        break;
    }

    return commonHeader + content + commonFooter;
  }

  /**
   * Genera el template de texto plano
   */
  private generateTextTemplate(template: string, emailData: any): string {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://micaaa.top' 
      : 'http://localhost:5000';

    switch (template) {
      case 'password_update':
        return `
MICAA - Sistema Integral de Construcción y Arquitectura

¡Hola ${emailData.contactName}!
${emailData.companyName}

Te contactamos desde MICAA para informarte sobre las nuevas funcionalidades disponibles en nuestro sistema.

ACTUALIZA TU CONTRASEÑA
Para acceder a las nuevas funcionalidades, te recomendamos actualizar tu contraseña:
- Accede a tu panel de usuario
- Ve a "Configuración de Cuenta"
- Actualiza tu contraseña por una más segura

NUEVAS FUNCIONALIDADES:
- Sistema de Publicidad: Promociona tu empresa
- Gestión Avanzada: Mejores herramientas de administración
- Reportes Detallados: Análisis de tu actividad
- Integración Mejorada: Mejor experiencia de usuario

Accede al sistema: ${baseUrl}/auth/login

¿Necesitas ayuda? Contáctanos en contacto@micaaa.top

© 2025 MICAA - Bolivia
        `.trim();

      case 'advertisement_reminder':
        return `
MICAA - Sistema Integral de Construcción y Arquitectura

¡Promociona tu Empresa, ${emailData.contactName}!
${emailData.companyName}

¿Sabías que puedes promocionar tu empresa directamente en MICAA y llegar a más clientes potenciales?

SISTEMA DE PUBLICIDAD MICAA:
- Mostrar tu empresa en la página principal
- Destacar tus productos y servicios
- Llegar a arquitectos, ingenieros y constructores
- Aumentar tu visibilidad en el mercado boliviano

CÓMO EMPEZAR:
1. Accede a tu panel de empresa
2. Ve a la sección "Publicidad"
3. Sube tu logo e información
4. Configura tu anuncio
5. ¡Comienza a recibir más clientes!

Crear publicidad: ${baseUrl}/auth/login

¿Tienes preguntas? Escríbenos a contacto@micaaa.top

© 2025 MICAA - Bolivia
        `.trim();

      case 'data_update':
        return `
MICAA - Sistema Integral de Construcción y Arquitectura

Actualiza los Datos de tu Empresa, ${emailData.contactName}
${emailData.companyName}

Para brindar el mejor servicio a nuestros usuarios, te pedimos mantener actualizados los datos de tu empresa.

INFORMACIÓN A VERIFICAR:
- Datos de Contacto: Teléfono, email, dirección
- Servicios: Especialidades y productos que ofreces
- Logo e Imágenes: Mantén tu imagen actualizada
- Horarios de Atención: Información para clientes

BENEFICIOS:
- Mayor confianza de los clientes
- Mejor posicionamiento en búsquedas
- Más oportunidades de negocio
- Comunicación efectiva con clientes

Actualizar datos: ${baseUrl}/auth/login

¿Necesitas asistencia? Contactanos: contacto@micaaa.top

© 2025 MICAA - Bolivia
        `.trim();

      default:
        return '';
    }
  }

  /**
   * Función helper para pausas
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const bulkEmailService = new BulkEmailService();