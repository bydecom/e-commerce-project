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
    { name: 'Auth' },
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
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRegisterRequest' },
              examples: {
                example: {
                  value: { name: 'John Doe', email: 'a@gmail.com', password: '123456' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse_UserPublic' },
              },
            },
          },
          '400': {
            description: 'Bad Request — invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FailureResponse' },
                examples: {
                  missingEmail: { value: { success: false, message: 'email is required', errors: null } },
                  invalidEmail: { value: { success: false, message: 'Invalid email', errors: null } },
                  shortPassword: {
                    value: { success: false, message: 'Password must be at least 6 characters', errors: null },
                  },
                },
              },
            },
          },
          '409': {
            description: 'Conflict — email already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FailureResponse' },
                examples: {
                  duplicateEmail: { value: { success: false, message: 'Email already exists', errors: null } },
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
      AuthRegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', example: 'a@gmail.com' },
          password: { type: 'string', example: '123456' },
        },
      },
      UserPublic: {
        type: 'object',
        required: ['id', 'email', 'role'],
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', nullable: true, example: 'John Doe' },
          email: { type: 'string', example: 'a@gmail.com' },
          role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
        },
      },
      SuccessResponse_UserPublic: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Created' },
          data: { $ref: '#/components/schemas/UserPublic' },
          meta: { nullable: true, example: null },
        },
      },
      FailureResponse: {
        type: 'object',
        required: ['success', 'message', 'errors'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
          errors: { nullable: true, example: null },
        },
      },
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
