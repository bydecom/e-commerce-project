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
        summary: 'Register account (sends verification email)',
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
                schema: { $ref: '#/components/schemas/SuccessResponse_RegisterPending' },
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
    '/api/auth/verify-email': {
      get: {
        tags: ['Auth'],
        summary: 'Verify email from token (redirects by default)',
        parameters: [
          { name: 'token', in: 'query', required: true, schema: { type: 'string' } },
          {
            name: 'mode',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['json'] },
            description: 'Use `json` to get JSON response instead of redirect',
          },
        ],
        responses: {
          '200': {
            description: 'OK (mode=json)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse_VerifyEmail' },
              },
            },
          },
          '302': { description: 'Redirect to frontend login' },
          '400': { description: 'Invalid or expired token' },
        },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification email (pending only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthResendVerificationRequest' },
              examples: { example: { value: { email: 'a@gmail.com' } } },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse_ResendVerification' },
              },
            },
          },
          '429': { description: 'Too many requests' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login, returns JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthLoginRequest' },
              examples: {
                example: {
                  value: { email: 'a@gmail.com', password: '123456' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse_Login' },
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
                  missingPassword: { value: { success: false, message: 'password is required', errors: null } },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized — invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FailureResponse' },
                examples: {
                  invalidCredentials: {
                    value: { success: false, message: 'Email or Password wrong', errors: null },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (blacklist current JWT in Redis until expiry)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse_Logout' },
              },
            },
          },
          '401': { description: 'Missing/invalid token or already logged out' },
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
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT from POST /api/auth/login (HS256)',
      },
    },
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
      AuthLoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'a@gmail.com' },
          password: { type: 'string', example: '123456' },
        },
      },
      AuthResendVerificationRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', example: 'a@gmail.com' },
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
      LoginData: {
        type: 'object',
        required: ['token', 'user'],
        properties: {
          token: { type: 'string', example: 'jwt...' },
          user: { $ref: '#/components/schemas/UserPublic' },
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
      RegisterPendingData: {
        type: 'object',
        required: ['email', 'message'],
        properties: {
          email: { type: 'string', example: 'a@gmail.com' },
          message: { type: 'string', example: 'Verification email sent' },
        },
      },
      SuccessResponse_RegisterPending: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Created' },
          data: { $ref: '#/components/schemas/RegisterPendingData' },
          meta: { nullable: true, example: null },
        },
      },
      VerifyEmailData: {
        type: 'object',
        required: ['user'],
        properties: {
          user: { $ref: '#/components/schemas/UserPublic' },
        },
      },
      SuccessResponse_VerifyEmail: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Verification successful' },
          data: { $ref: '#/components/schemas/VerifyEmailData' },
          meta: { nullable: true, example: null },
        },
      },
      ResendVerificationData: {
        type: 'object',
        required: ['email', 'message'],
        properties: {
          email: { type: 'string', example: 'a@gmail.com' },
          message: { type: 'string', example: 'If the account exists, a verification email has been sent' },
        },
      },
      SuccessResponse_ResendVerification: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'OK' },
          data: { $ref: '#/components/schemas/ResendVerificationData' },
          meta: { nullable: true, example: null },
        },
      },
      SuccessResponse_Login: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'OK' },
          data: { $ref: '#/components/schemas/LoginData' },
          meta: { nullable: true, example: null },
        },
      },
      SuccessResponse_Logout: {
        type: 'object',
        required: ['success', 'message', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Logged out' },
          data: { nullable: true, example: null },
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
