import express from 'express';
import dataRouter from './routes/data';
import structureRouter from './routes/structure';
import constraintRouter from './routes/constraint';
import { negotiateFormat } from './middleware/negotiate';
import { apiLimiter } from './middleware/ratelimit';

const app = express();
const port = process.env.PORT || 4000;

// Custom CORS middleware (zero-dependency)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON request bodies
app.use(express.json());

// Apply rate limiter middleware
app.use(apiLimiter);

// Apply content negotiation middleware
app.use(negotiateFormat);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount SDMX routes
app.use('/api/v1/sdmx/data', dataRouter);
app.use('/api/v1/sdmx/structure', structureRouter);
app.use('/api/v1/sdmx/availableconstraint', constraintRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

app.listen(port, () => {
  console.log(`==================================================`);
  console.log(`  ERDI DATA SDMX REST API is running on port ${port}  `);
  console.log(`  Base URL: http://localhost:${port}/api/v1/sdmx   `);
  console.log(`==================================================`);
});

export default app;
