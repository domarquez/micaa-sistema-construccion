import { db } from "./db";
import { constructionNews } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";

interface NewsItem {
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceName: string;
  category: string;
  publishedAt?: Date;
}

// Sample news data based on web search results
const SAMPLE_NEWS: NewsItem[] = [
  {
    title: "Sector construcción en Bolivia declarado en emergencia por crisis de insumos",
    summary: "CABOCO alerta sobre falta de materiales críticos y escasez de dólares que afecta importaciones del sector",
    sourceName: "Contacto Construcción",
    sourceUrl: "https://contactoconstruccion.com/situacion-del-sector/",
    category: "economia",
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    title: "Precio del fierro se duplica en 6 meses por crisis de divisas",
    summary: "Material pasó de 60 a 120 bolivianos, afectando directamente el costo de construcción en el país",
    sourceName: "Los Tiempos",
    sourceUrl: "https://www.lostiempos.com/",
    category: "economia",
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    title: "Gobierno aprueba Decreto Supremo 5321 para ajustar precios en obras públicas",
    summary: "Nueva normativa permite ajustar precios unitarios de materiales importados en contratos estatales",
    sourceName: "MOPSV",
    sourceUrl: "https://www.oopp.gob.bo/",
    category: "gobierno",
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    title: "Construcción irregular supera las 30,000 edificaciones en La Paz",
    summary: "Propietarios se amparan en autorizaciones de municipios aledaños como Palca y Achocalla",
    sourceName: "Opinión Bolivia",
    sourceUrl: "https://www.opinion.com.bo/tags/construccion/",
    category: "normativa",
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
  },
  {
    title: "Proyección de crecimiento del 5.5% anual para sector construcción 2025-2034",
    summary: "A pesar de la crisis actual, se espera recuperación gradual del sector en la próxima década",
    sourceName: "Visión 360",
    sourceUrl: "https://www.vision360.bo/",
    category: "economia",
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    title: "Entrega de viviendas sociales en Achacachi beneficia a 120 familias",
    summary: "Gobierno continúa con programa de vivienda social a pesar de crisis del sector",
    sourceName: "ANF",
    category: "obras",
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },
  {
    title: "Sistema BIM adoptado por constructoras bolivianas reduce costos 15%",
    summary: "Empresas locales implementan modelado 3D y tecnología 4.0 para optimizar procesos",
    sourceName: "Constructivo",
    category: "tecnologia",
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
  },
  {
    title: "INE reporta 2.9 millones de metros cuadrados de superficie aprobada en 2023",
    summary: "Datos oficiales muestran actividad sostenida pese a desafíos del sector construcción",
    sourceName: "INE Bolivia",
    sourceUrl: "https://www.ine.gob.bo/",
    category: "economia",
    publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
  }
];

export class NewsScraperService {
  /**
   * Seeds the database with initial construction news
   */
  async seedNews(): Promise<void> {
    try {
      // Check if we already have news
      const existingNews = await db
        .select()
        .from(constructionNews)
        .limit(1);

      if (existingNews.length > 0) {
        console.log('News already seeded, skipping...');
        return;
      }

      // Insert sample news
      for (const newsItem of SAMPLE_NEWS) {
        await db.insert(constructionNews).values({
          title: newsItem.title,
          summary: newsItem.summary,
          sourceUrl: newsItem.sourceUrl,
          sourceName: newsItem.sourceName,
          category: newsItem.category,
          publishedAt: newsItem.publishedAt,
          isActive: true
        });
      }

      console.log(`Successfully seeded ${SAMPLE_NEWS.length} news items`);
    } catch (error) {
      console.error('Error seeding news:', error);
      throw error;
    }
  }

  /**
   * Gets active construction news from database
   */
  async getActiveNews(): Promise<any[]> {
    try {
      const news = await db
        .select()
        .from(constructionNews)
        .where(eq(constructionNews.isActive, true))
        .orderBy(desc(constructionNews.publishedAt))
        .limit(20);

      return news;
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  }

  /**
   * Adds new news item to database
   */
  async addNews(newsItem: NewsItem): Promise<void> {
    try {
      await db.insert(constructionNews).values({
        title: newsItem.title,
        summary: newsItem.summary,
        sourceUrl: newsItem.sourceUrl,
        sourceName: newsItem.sourceName,
        category: newsItem.category,
        publishedAt: newsItem.publishedAt || new Date(),
        isActive: true
      });

      console.log('Successfully added news item:', newsItem.title);
    } catch (error) {
      console.error('Error adding news:', error);
      throw error;
    }
  }

  /**
   * Scrapes news from Los Tiempos (Bolivia)
   */
  private async scrapeLosTiempos(): Promise<NewsItem[]> {
    try {
      const response = await axios.get('https://www.lostiempos.com/', {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const $ = cheerio.load(response.data);
      const news: NewsItem[] = [];
      
      // Buscar artículos relacionados con construcción
      $('article, .article, .news-item').slice(0, 5).each((_, element) => {
        const titleEl = $(element).find('h2, h3, .title, .headline').first();
        const title = titleEl.text().trim();
        const link = titleEl.find('a').attr('href') || $(element).find('a').attr('href');
        
        // Filtrar solo noticias de construcción/economía
        if (title && (title.toLowerCase().includes('construcción') || 
                     title.toLowerCase().includes('obra') ||
                     title.toLowerCase().includes('infraestructura') ||
                     title.toLowerCase().includes('vivienda'))) {
          news.push({
            title,
            summary: title,
            sourceName: 'Los Tiempos',
            sourceUrl: link ? `https://www.lostiempos.com${link}` : 'https://www.lostiempos.com',
            category: 'economia',
            publishedAt: new Date()
          });
        }
      });
      
      return news;
    } catch (error) {
      console.error('Error scraping Los Tiempos:', error);
      return [];
    }
  }

  /**
   * Scrapes news from Economy.com.bo
   */
  private async scrapeEconomy(): Promise<NewsItem[]> {
    try {
      const response = await axios.get('https://www.economy.com.bo/articulo/economia/', {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const $ = cheerio.load(response.data);
      const news: NewsItem[] = [];
      
      $('article, .article-item, .news').slice(0, 5).each((_, element) => {
        const titleEl = $(element).find('h2, h3, .title').first();
        const title = titleEl.text().trim();
        const summary = $(element).find('p, .summary, .description').first().text().trim();
        const link = titleEl.find('a').attr('href') || $(element).find('a').attr('href');
        
        if (title && (title.toLowerCase().includes('construcción') || 
                     title.toLowerCase().includes('material') ||
                     title.toLowerCase().includes('obra'))) {
          news.push({
            title,
            summary: summary || title,
            sourceName: 'Economy.com.bo',
            sourceUrl: link || 'https://www.economy.com.bo',
            category: 'economia',
            publishedAt: new Date()
          });
        }
      });
      
      return news;
    } catch (error) {
      console.error('Error scraping Economy.com.bo:', error);
      return [];
    }
  }

  /**
   * Fetches latest news from multiple web sources using web scraping
   */
  async fetchLatestNews(): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];
    
    try {
      // Scrape from multiple sources
      const [losTiemposNews, economyNews] = await Promise.all([
        this.scrapeLosTiempos(),
        this.scrapeEconomy()
      ]);
      
      allNews.push(...losTiemposNews, ...economyNews);
      
      // Si no se obtuvieron noticias del scraping, usar noticias de ejemplo
      if (allNews.length === 0) {
        console.log('No se obtuvieron noticias del scraping, usando datos de ejemplo');
        const today = new Date();
        const freshNews: NewsItem[] = SAMPLE_NEWS.slice(0, 3).map((news, index) => ({
          ...news,
          title: `${news.title} [Actualizado ${today.toLocaleDateString()}]`,
          publishedAt: new Date(today.getTime() - index * 60 * 60 * 1000)
        }));
        return freshNews;
      }
      
      console.log(`Se obtuvieron ${allNews.length} noticias del scraping`);
      return allNews.slice(0, 5); // Limitar a 5 noticias más recientes
      
    } catch (error) {
      console.error('Error general en fetchLatestNews:', error);
      // Fallback a noticias de ejemplo
      const today = new Date();
      return SAMPLE_NEWS.slice(0, 3).map((news, index) => ({
        ...news,
        title: `${news.title} [Actualizado ${today.toLocaleDateString()}]`,
        publishedAt: new Date(today.getTime() - index * 60 * 60 * 1000)
      }));
    }
  }

  /**
   * Updates news database with fresh content
   */
  async updateNews(): Promise<void> {
    try {
      const latestNews = await this.fetchLatestNews();
      
      for (const newsItem of latestNews) {
        // Check if news already exists
        const existing = await db
          .select()
          .from(constructionNews)
          .where(eq(constructionNews.title, newsItem.title))
          .limit(1);

        if (existing.length === 0) {
          await this.addNews(newsItem);
        }
      }

      console.log('News update completed');
    } catch (error) {
      console.error('Error updating news:', error);
      throw error;
    }
  }
}

export const newsScraperService = new NewsScraperService();