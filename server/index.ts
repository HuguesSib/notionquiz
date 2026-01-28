import dotenv from 'dotenv';
// Load environment variables BEFORE other imports that use them
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import notionRoutes from './routes/notion.js';
import evaluateRoutes from './routes/evaluate.js';
import generateRoutes from './routes/generate.js';
import type { HealthResponse, ErrorResponse } from '../shared/types/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response<HealthResponse>) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Notion API routes
app.use('/api', notionRoutes);

// Evaluation routes
app.use('/api', evaluateRoutes);

// Flashcard generation routes
app.use('/api', generateRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  
  if (!process.env.NOTION_API_KEY || process.env.NOTION_API_KEY === 'your_notion_api_key_here') {
    console.warn('\n⚠️  Warning: NOTION_API_KEY is not configured!');
    console.warn('   Please add your Notion API key to server/.env');
    console.warn('   Get your API key from: https://www.notion.so/my-integrations\n');
  }
});
