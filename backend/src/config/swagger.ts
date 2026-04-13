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
    { name: 'Orders' },
    { name: 'Feedbacks' },
    { name: 'Feedback Types' },
    { name: 'Dashboard' },
    { name: 'System logs' },
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
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'User not found' },
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
          {
            name: 'categoryIds',
            in: 'query',
            description: 'Repeat param or comma-separated — products in any of these categories',
            schema: { type: 'array', items: { type: 'integer' } },
            style: 'form',
            explode: true,
          },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['price_asc', 'price_desc', 'newest', 'oldest'] },
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
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
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
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductUpdate' },
            },
          },
        },
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '404': { description: 'Not found' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
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
        security: [{ bearerAuth: [] }],
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
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '409': { description: 'Duplicate name' },
        },
      },
    },
    '/api/categories/{id}': {
      patch: {
        tags: ['Categories'],
        summary: 'Update category',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CategoryCreate' },
            },
          },
        },
        responses: {
          '200': { description: 'OK' },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '404': { description: 'Not found' },
          '409': { description: 'Duplicate name' },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete category',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Deleted' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '404': { description: 'Not found' },
          '409': { description: 'Category still has products' },
        },
      },
    },
    '/api/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Create a new order (User)',
        description:
          'Validates stock, calculates total and decrements product stock atomically. `userId` is taken from the JWT.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Order created' },
          '400': { description: 'Missing fields or invalid productId/quantity' },
          '401': { description: 'Unauthorized' },
          '422': { description: 'Product not available or insufficient stock' },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'List all orders — Admin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by customer name or email' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
      },
    },
    '/api/orders/me': {
      get: {
        tags: ['Orders'],
        summary: 'List orders of a user (User)',
        description: '`userId` is taken from the JWT.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'] } },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders/me/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get a specific order of a user (User)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/orders/me/{id}/cancel': {
      patch: {
        tags: ['Orders'],
        summary: 'Cancel a pending order (User)',
        description: 'Only PENDING orders can be cancelled. Stock is automatically restored.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Cancelled — stock restored' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Order not found' },
          '422': { description: 'Only pending orders can be cancelled' },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get any order by id — Admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update order status — Admin',
        security: [{ bearerAuth: [] }],
        description: 'Allowed transitions: PENDING→CONFIRMED|CANCELLED · CONFIRMED→SHIPPING · SHIPPING→DONE. Cancelling a PENDING order also restores stock.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderStatusUpdate' },
            },
          },
        },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Invalid status' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '404': { description: 'Not found' },
          '422': { description: 'Invalid status transition' },
        },
      },
    },
    '/api/feedbacks': {
      get: {
        tags: ['Feedbacks'],
        summary: 'List all feedbacks (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by customer name/email, product name or comment' },
          { name: 'sentiment', in: 'query', schema: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] } },
          { name: 'rating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
          { name: 'typeId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
      },
      post: {
        tags: ['Feedbacks'],
        summary: 'Submit a new feedback (User)',
        description:
          'Sentiment is auto-analyzed by Gemini AI based on the comment. If AI is unavailable, sentiment defaults to NEUTRAL. `userId` is taken from the JWT.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Feedback created' },
          '400': { description: 'Validation error (invalid rating, order not DONE, product not in order…)' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — order does not belong to this user' },
          '404': { description: 'Order or product not found' },
          '409': { description: 'Feedback already submitted for this product in this order' },
        },
      },
    },
    '/api/feedbacks/product/{id}': {
      get: {
        tags: ['Feedbacks'],
        summary: 'List feedbacks for a product (Public)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'Invalid productId' } },
      },
    },
    '/api/feedback-types': {
      get: {
        tags: ['Feedback Types'],
        summary: 'List all feedback types',
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Feedback Types'],
        summary: 'Create a new feedback type (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackTypeCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Name is required' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '409': { description: 'Duplicate name' },
        },
      },
    },
    '/api/feedback-types/{id}': {
      patch: {
        tags: ['Feedback Types'],
        summary: 'Update a feedback type — name, description or isActive toggle (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackTypeUpdate' },
            },
          },
        },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Invalid id or empty name' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
          '404': { description: 'Not found' },
          '409': { description: 'Duplicate name or last active type' },
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
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StoreSettingUpdate' },
            },
          },
        },
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
      },
    },
    '/api/dashboard/export-pdf': {
      get: {
        tags: ['Dashboard'],
        summary: 'Export business performance PDF (revenue, orders, sentiment)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'type',
            in: 'query',
            description: 'ALL | MONTH | QUARTER | YEAR | CUSTOM',
            schema: { type: 'string', enum: ['ALL', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'] },
          },
          { name: 'month', in: 'query', schema: { type: 'integer' }, description: '1–12 (with MONTH)' },
          { name: 'quarter', in: 'query', schema: { type: 'integer' }, description: '1–4 (with QUARTER)' },
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Calendar year' },
          { name: 'start', in: 'query', schema: { type: 'string', format: 'date' }, description: 'CUSTOM range start' },
          { name: 'end', in: 'query', schema: { type: 'string', format: 'date' }, description: 'CUSTOM range end' },
        ],
        responses: {
          '200': {
            description: 'PDF file',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          '400': { description: 'Invalid filter parameters' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
      },
    },
    '/api/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get all dashboard statistics (Metrics, Actions, Charts)',
        description: 'Returns a JSON containing all aggregated data needed to render the Admin Dashboard: key metrics, action-required items, and chart data.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
      },
    },
    '/api/system-logs': {
      get: {
        tags: ['System logs'],
        summary: 'List recent system traffic logs',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'integer' } },
          { name: 'url', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
      },
    },
    '/api/system-logs/export-pdf': {
      get: {
        tags: ['System logs'],
        summary: 'Export system logs as PDF (time filter + same filters as list)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'filterType',
            in: 'query',
            description: 'Time window: ALL | MONTH | QUARTER | YEAR | RANGE',
            schema: { type: 'string', enum: ['ALL', 'MONTH', 'QUARTER', 'YEAR', 'RANGE'] },
          },
          { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'quarter', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 4 } },
          { name: 'year', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'integer' } },
          { name: 'url', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'PDF file',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          '400': { description: 'Invalid filter' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden — ADMIN only' },
        },
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
      OrderCreate: {
        type: 'object',
        required: ['shippingAddress', 'items'],
        properties: {
          shippingAddress: { type: 'string', example: '101 Apple St, New York, NY' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'integer', example: 1 },
                quantity: { type: 'integer', minimum: 1, example: 2 },
              },
            },
          },
        },
      },
      OrderStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'],
            example: 'CONFIRMED',
          },
        },
      },
      FeedbackCreate: {
        type: 'object',
        required: ['orderId', 'productId', 'rating'],
        properties: {
          orderId: { type: 'integer', example: 4 },
          productId: { type: 'integer', example: 6 },
          rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
          comment: { type: 'string', nullable: true, example: 'iPad dùng siêu mượt, shop đóng gói cực kỳ cẩn thận nhé, rất đáng tiền!' },
          typeId: { type: 'integer', nullable: true, description: 'Optional — Gemini AI tự phân tích comment và gán type. Chỉ truyền nếu muốn override AI.' },
        },
      },
      FeedbackTypeCreate: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Product Quality' },
          description: { type: 'string', nullable: true, example: 'Durability, design, and performance' },
        },
      },
      FeedbackTypeUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Product Quality' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean', example: true, description: 'At least 1 type must remain active' },
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
