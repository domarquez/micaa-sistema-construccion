import { newsScraperService } from './news-scraper';

// Initialize news data
export async function initializeNews() {
  try {
    await newsScraperService.seedNews();
    console.log('News initialization completed successfully');
  } catch (error) {
    console.error('Error initializing news:', error);
  }
}

// Auto-initialize when file is imported
initializeNews();