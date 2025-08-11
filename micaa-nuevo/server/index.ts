import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0' 
  });
});

// Basic API routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'MICAA API funcionando correctamente' });
});

// Development: Serve Vite dev server
if (process.env.NODE_ENV === 'development') {
  try {
    const { createServer } = await import('vite');
    const viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.join(process.cwd(), 'client'),
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), 'client/src'),
          '@shared': path.resolve(process.cwd(), 'shared')
        }
      }
    });
    app.use(viteServer.ssrFixStacktrace);
    app.use(viteServer.middlewares);
  } catch (error) {
    console.log('Vite not available, serving static files');
    app.use(express.static(path.join(process.cwd(), 'client')));
  }
} else {
  // Production: Serve static files
  app.use(express.static(path.join(process.cwd(), 'dist/public')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(process.cwd(), 'dist/public/index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MICAA Server running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});