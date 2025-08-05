import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple session for Vercel (stateless)
app.use((req: any, res, next) => {
  req.session = {}; // Basic session stub for compatibility
  next();
});

// Register all routes
let routesRegistered = false;

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export as Vercel serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  if (!routesRegistered) {
    await registerRoutes(app);
    routesRegistered = true;
  }
  return app(req, res);
};