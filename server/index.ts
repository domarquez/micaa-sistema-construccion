import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cron from "node-cron";
// Routes will be imported dynamically
import { setupVite, serveStatic, log } from "./vite";

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { registerRoutes } = await import("./routes");
  await registerRoutes(app);
  
  // Initialize news data
  try {
    const { newsScraperService } = await import("./news-scraper");
    await newsScraperService.seedNews();
    
    // Run an immediate update on server start to show fresh content
    log('🔄 Running initial news update...');
    await newsScraperService.updateNews();
    log('✅ Initial news update completed');
    
    // Setup automatic news updates every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      log('🔄 Running scheduled news update...');
      try {
        await newsScraperService.updateNews();
        log('✅ News update completed successfully');
      } catch (error) {
        console.error('❌ Error during scheduled news update:', error);
      }
    });
    
    log('📰 News auto-update scheduled: Every 6 hours');
  } catch (error) {
    console.error('Error initializing news:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
