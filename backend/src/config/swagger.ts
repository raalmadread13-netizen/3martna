import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

/**
 * OpenAPI 3 definition. Endpoint annotations live next to the route
 * definitions in each module's *.routes.ts file.
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: '3martna (عمارتنا) API',
      version: '1.0.0',
      description:
        'REST API for the 3martna apartment & building management platform. ' +
        'All endpoints (except /auth/*) require a Bearer access token.',
      contact: { name: '3martna', email: 'support@3martna.jo' },
    },
    servers: [{ url: env.apiPrefix, description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
          },
        },
        Paginated: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                totalCount: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['src/modules/**/*.routes.ts', 'dist/modules/**/*.routes.js'],
});
