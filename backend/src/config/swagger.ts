import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

/** OpenAPI 3 — keep in sync with `contexts/API_CONTRACT.md`. */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'E-Commerce API',
    version: '1.0.0',
    description: 'REST API for the e-commerce project (base path `/api`).',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Development' }],
  tags: [
    { name: 'Health' },
    { name: 'Products' },
    { name: 'Categories' },
    { name: 'Store settings' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check (server and database)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    data: { nullable: true },
                    meta: { nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (pagination and filters)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'integer' } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['price_asc', 'price_desc', 'newest'] },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE', 'DRAFT'] },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Products'],
        summary: 'Create product',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductCreate' },
            },
          },
        },
        responses: { '201': { description: 'Created' }, '400': { description: 'Bad request' } },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
      put: {
        tags: ['Products'],
        summary: 'Update product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductUpdate' },
            },
          },
        },
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'OK' },
          '404': { description: 'Not found' },
          '409': { description: 'Conflict (referenced by orders)' },
        },
      },
    },
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List categories',
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create category',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CategoryCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Bad request' },
          '409': { description: 'Duplicate name' },
        },
      },
    },
    '/api/store-settings': {
      get: {
        tags: ['Store settings'],
        summary: 'Get shop info (public)',
        responses: { '200': { description: 'OK' } },
      },
      put: {
        tags: ['Store settings'],
        summary: 'Update shop info (ADMIN)',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StoreSettingUpdate' },
            },
          },
        },
        responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } },
      },
    },
  },
  components: {
    schemas: {
      CategoryCreate: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Accessories' },
        },
      },
      ProductCreate: {
        type: 'object',
        required: ['name', 'price', 'stock', 'categoryId'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          price: { type: 'number', minimum: 0 },
          stock: { type: 'integer', minimum: 0 },
          imageUrl: { type: 'string', nullable: true },
          categoryId: { type: 'integer' },
          status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE', 'DRAFT'] },
        },
      },
      ProductUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          price: { type: 'number' },
          stock: { type: 'integer' },
          imageUrl: { type: 'string', nullable: true },
          categoryId: { type: 'integer' },
          status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE', 'DRAFT'] },
        },
      },
      StoreSettingUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          logoUrl: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
        },
      },
    },
  },
} as const;

export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
}
