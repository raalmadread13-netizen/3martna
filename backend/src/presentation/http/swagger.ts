import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@shared/config/env';

/**
 * OpenAPI 3 definition. Endpoint annotations live as @openapi JSDoc next
 * to each route definition (see routes/health.routes.ts).
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: '3martna (عمارتنا) API',
      version: '0.1.0',
      description:
        'REST API for the 3martna apartment & building management platform. ' +
        'Sprint 1 exposes the health endpoints; feature endpoints arrive in later sprints.',
      contact: { name: '3martna', email: 'support@3martna.jo' },
    },
    servers: [
      { url: '/', description: 'Root (health)' },
      { url: env.apiPrefix, description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['src/presentation/http/routes/*.ts', 'dist/presentation/http/routes/*.js'],
});
