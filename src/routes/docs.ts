import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';

// Create OpenAPI app
const apiDoc = new OpenAPIHono();

// API Documentation
apiDoc.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

apiDoc.openAPIRegistry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  description: 'Register a new user',
  summary: 'User Registration',
  request: {
    body: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['type', 'phone', 'name', 'password'],
            properties: {
              type: {
                type: 'string',
                enum: ['technician', 'company', 'super_admin'],
                description: 'User type'
              },
              phone: {
                type: 'string',
                description: 'Phone number (E.164 format)'
              },
              name: {
                type: 'string',
                description: 'Full name'
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'Email address'
              },
              password: {
                type: 'string',
                minLength: 8,
                description: 'Password'
              }
            }
          }
        }
      }
    }
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  type: { type: 'string' },
                  phone: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

apiDoc.openAPIRegistry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  description: 'Authenticate user and get JWT token',
  summary: 'User Login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['phone', 'password'],
            properties: {
              phone: {
                type: 'string',
                description: 'Phone number'
              },
              password: {
                type: 'string',
                description: 'Password'
              }
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  type: { type: 'string' },
                  phone: { type: 'string' },
                  name: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    }
  }
});

// Swagger UI route
export const swaggerApp = new OpenAPIHono();

swaggerApp.use('/docs', swaggerUI({
  url: '/openapi.json'
}));

swaggerApp.get('/openapi.json', (c: { json: (arg0: any) => any; }) => {
  return c.json(apiDoc.openAPIRegistry.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'AutoServices API',
      version: '1.0.0',
      description: 'Backend API for AutoServices system'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    security: [
      {
        BearerAuth: []
      }
    ]
  }));
});

export { apiDoc };