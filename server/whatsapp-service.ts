import axios from 'axios';

interface WhatsAppMessage {
  phone: string;
  message: string;
}

interface WhatsAppTemplateMessage {
  phone: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string = 'v18.0';
  private baseUrl: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('591')) {
      cleaned = '591' + cleaned;
    }
    
    return cleaned;
  }

  async sendTextMessage(phone: string, message: string): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.error('WhatsApp credentials not configured');
      return false;
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('WhatsApp message sent successfully:', response.data);
      return true;
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    const message = `🔐 *MICAA - Código de Verificación*\n\nTu código es: *${code}*\n\nEste código expira en 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`;
    return this.sendTextMessage(phone, message);
  }

  async sendPasswordResetCode(phone: string, code: string): Promise<boolean> {
    const message = `🔑 *MICAA - Recuperar Contraseña*\n\nTu código de recuperación es: *${code}*\n\nEste código expira en 10 minutos.\n\nSi no solicitaste restablecer tu contraseña, ignora este mensaje.`;
    return this.sendTextMessage(phone, message);
  }

  async sendWelcomeMessage(phone: string, userName: string): Promise<boolean> {
    const message = `👋 *¡Bienvenido a MICAA, ${userName}!*\n\n🏗️ Sistema Integral de Construcción y Arquitectura\n\nTu cuenta ha sido verificada exitosamente.\n\nAhora puedes:\n• Crear presupuestos de construcción\n• Gestionar materiales y proveedores\n• Calcular costos con precios regionales\n\n¡Gracias por unirte a MICAA!`;
    return this.sendTextMessage(phone, message);
  }

  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }
}

export const whatsappService = new WhatsAppService();
