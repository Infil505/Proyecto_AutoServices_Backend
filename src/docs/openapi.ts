const bearerAuth = [{ BearerAuth: [] }];

const phoneParam = (name: string) => ({
  name,
  in: 'path' as const,
  required: true,
  schema: { type: 'string', example: '+1234567890' },
});

const idParam = (name = 'id') => ({
  name,
  in: 'path' as const,
  required: true,
  schema: { type: 'integer', example: 1 },
});

const r200 = (schema: object) => ({
  200: { description: 'OK', content: { 'application/json': { schema } } },
});
const r201 = (schema: object) => ({
  201: { description: 'Created', content: { 'application/json': { schema } } },
});
const r204 = { 200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } } };
const r400 = { 400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } } };
const r401 = { 401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } };
const r403 = { 403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } };
const r404 = { 404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } };
const r409 = { 409: { description: 'Conflict (already registered)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } };

const protectedResponses = { ...r401, ...r403 };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AutoServices API',
    version: '1.0.0',
    description:
      'REST API for the AutoServices appointment management system.\n\n' +
      '**Authentication:** All endpoints except `/auth/register/company`, `/auth/login` and `/health` require a Bearer JWT.\n\n' +
      '**Roles:** `super_admin` · `company` · `technician`',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      MessageResponse: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['super_admin', 'company', 'technician'] },
          phone: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Company: {
        type: 'object',
        properties: {
          phone: { type: 'string', example: '+1234567890' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email', nullable: true },
          address: { type: 'string', nullable: true },
          startHour: { type: 'string', example: '08:00' },
          endHour: { type: 'string', example: '18:00' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Technician: {
        type: 'object',
        properties: {
          phone: { type: 'string', example: '+1122334455' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email', nullable: true },
          companyPhone: { type: 'string' },
          available: { type: 'boolean' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          phone: { type: 'string', example: '+0987654321' },
          name: { type: 'string', nullable: true },
          email: { type: 'string', format: 'email', nullable: true },
          state: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          content: { type: 'string', nullable: true },
        },
      },
      Service: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          companyPhone: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          category: { type: 'string', nullable: true },
          estimatedDurationMinutes: { type: 'integer' },
          active: { type: 'boolean' },
        },
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          companyPhone: { type: 'string' },
          technicianPhone: { type: 'string', nullable: true },
          customerPhone: { type: 'string', nullable: true },
          serviceId: { type: 'integer', nullable: true },
          appointmentDate: { type: 'string', format: 'date', example: '2026-04-15' },
          startTime: { type: 'string', example: '10:00' },
          status: {
            type: 'string',
            enum: ['pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'],
          },
          content: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Specialty: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          active: { type: 'boolean' },
        },
      },
      CoverageZone: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          companyPhone: { type: 'string' },
          state: { type: 'string' },
          city: { type: 'string' },
          zoneName: { type: 'string', nullable: true },
          postalCode: { type: 'string', nullable: true },
          coordinates: { type: 'object', nullable: true, description: 'GeoJSON' },
          notes: { type: 'string', nullable: true },
        },
      },
      ServiceSpecialty: {
        type: 'object',
        properties: {
          serviceId: { type: 'integer' },
          specialtyId: { type: 'integer' },
        },
      },
      TechnicianSpecialty: {
        type: 'object',
        properties: {
          technicianPhone: { type: 'string' },
          specialtyId: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    // ─── AUTH ──────────────────────────────────────────────────────────────────
    '/api/v1/auth/register/company': {
      post: {
        tags: ['Auth'],
        summary: 'Register company',
        description: 'Creates a company record and its admin user in a single transaction. **Public.**',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'name', 'password'],
                properties: {
                  phone: { type: 'string', example: '+1234567890' },
                  name: { type: 'string', example: 'AutoServices Pro' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  address: { type: 'string' },
                  startHour: { type: 'string', example: '08:00' },
                  endHour: { type: 'string', example: '18:00' },
                },
              },
            },
          },
        },
        responses: {
          ...r201({ type: 'object', properties: { company: { $ref: '#/components/schemas/Company' } } }),
          ...r400,
          ...r409,
        },
      },
    },
    '/api/v1/auth/register/admin': {
      post: {
        tags: ['Auth'],
        summary: 'Create super_admin',
        description: 'Creates a new super_admin user. **Requires super_admin JWT.**',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'name', 'password'],
                properties: {
                  phone: { type: 'string', example: '+1555000000' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          ...r201({ type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } }),
          ...r400,
          ...r401,
          ...r403,
          ...r409,
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description: 'Authenticates with phone + password. Returns a JWT valid for the configured duration. **Public.**',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'password'],
                properties: {
                  phone: { type: 'string', example: '+1234567890' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          ...r200({
            type: 'object',
            properties: {
              token: { type: 'string', description: 'Bearer JWT' },
              user: { $ref: '#/components/schemas/User' },
            },
          }),
          ...r400,
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ─── APPOINTMENTS ──────────────────────────────────────────────────────────
    '/api/v1/appointments': {
      get: {
        tags: ['Appointments'],
        summary: 'List appointments',
        description: '`super_admin` → all · `company` → own company · `technician` → assigned only',
        security: bearerAuth,
        responses: {
          ...r200({ type: 'array', items: { $ref: '#/components/schemas/Appointment' } }),
          ...protectedResponses,
        },
      },
      post: {
        tags: ['Appointments'],
        summary: 'Create appointment',
        description: 'Only `company` and `super_admin` can create appointments.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['companyPhone'],
                properties: {
                  companyPhone: { type: 'string', example: '+1234567890' },
                  customerPhone: { type: 'string' },
                  technicianPhone: { type: 'string' },
                  serviceId: { type: 'integer' },
                  appointmentDate: { type: 'string', format: 'date', example: '2026-04-15' },
                  startTime: { type: 'string', example: '10:00' },
                  status: { type: 'string', enum: ['pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          ...r201({ $ref: '#/components/schemas/Appointment' }),
          ...r400,
          ...protectedResponses,
        },
      },
    },
    '/api/v1/appointments/{id}': {
      get: {
        tags: ['Appointments'],
        summary: 'Get appointment',
        security: bearerAuth,
        parameters: [idParam()],
        responses: {
          ...r200({ $ref: '#/components/schemas/Appointment' }),
          ...protectedResponses,
          ...r404,
        },
      },
      put: {
        tags: ['Appointments'],
        summary: 'Update appointment',
        description: 'Only `company` and `super_admin`.',
        security: bearerAuth,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  technicianPhone: { type: 'string' },
                  serviceId: { type: 'integer' },
                  appointmentDate: { type: 'string', format: 'date' },
                  startTime: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          ...r200({ $ref: '#/components/schemas/Appointment' }),
          ...r400,
          ...protectedResponses,
          ...r404,
        },
      },
      delete: {
        tags: ['Appointments'],
        summary: 'Delete appointment',
        description: 'Only `company` and `super_admin`.',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── COMPANIES ─────────────────────────────────────────────────────────────
    '/api/v1/companies': {
      get: {
        tags: ['Companies'],
        summary: 'List companies',
        description: '`super_admin` → all · `company` → own · `technician` → 403',
        security: bearerAuth,
        responses: {
          ...r200({ type: 'array', items: { $ref: '#/components/schemas/Company' } }),
          ...protectedResponses,
        },
      },
      post: {
        tags: ['Companies'],
        summary: 'Create company',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'name'],
                properties: {
                  phone: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  address: { type: 'string' },
                  startHour: { type: 'string', example: '08:00' },
                  endHour: { type: 'string', example: '18:00' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/Company' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/companies/{phone}': {
      get: {
        tags: ['Companies'],
        summary: 'Get company',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        responses: { ...r200({ $ref: '#/components/schemas/Company' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Companies'],
        summary: 'Update company',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  address: { type: 'string' },
                  startHour: { type: 'string' },
                  endHour: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/Company' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Companies'],
        summary: 'Delete company',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── CUSTOMERS ─────────────────────────────────────────────────────────────
    '/api/v1/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List customers',
        description: '`super_admin` → all · `company` → own · `technician` → 403',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/Customer' } }), ...protectedResponses },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create customer',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone'],
                properties: {
                  phone: { type: 'string', example: '+0987654321' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  state: { type: 'string' },
                  city: { type: 'string' },
                  address: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/Customer' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/customers/{phone}': {
      get: {
        tags: ['Customers'],
        summary: 'Get customer',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        responses: { ...r200({ $ref: '#/components/schemas/Customer' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Customers'],
        summary: 'Update customer',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  state: { type: 'string' },
                  city: { type: 'string' },
                  address: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/Customer' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete customer',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── TECHNICIANS ───────────────────────────────────────────────────────────
    '/api/v1/technicians': {
      get: {
        tags: ['Technicians'],
        summary: 'List technicians',
        description: '`super_admin` → all · `company` → own · `technician` → own record only',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/Technician' } }), ...protectedResponses },
      },
      post: {
        tags: ['Technicians'],
        summary: 'Create technician',
        description: 'Creates a technician record and its user account.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'name', 'password'],
                properties: {
                  phone: { type: 'string', example: '+1122334455' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  companyPhone: { type: 'string', description: 'Required for super_admin; auto-set from JWT for company role' },
                  available: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/Technician' }), ...r400, ...protectedResponses, ...r409 },
      },
    },
    '/api/v1/technicians/{phone}': {
      get: {
        tags: ['Technicians'],
        summary: 'Get technician',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        responses: { ...r200({ $ref: '#/components/schemas/Technician' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Technicians'],
        summary: 'Update technician',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  available: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/Technician' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Technicians'],
        summary: 'Delete technician',
        security: bearerAuth,
        parameters: [phoneParam('phone')],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── SERVICES ──────────────────────────────────────────────────────────────
    '/api/v1/services': {
      get: {
        tags: ['Services'],
        summary: 'List services',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/Service' } }), ...protectedResponses },
      },
      post: {
        tags: ['Services'],
        summary: 'Create service',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['companyPhone', 'name', 'estimatedDurationMinutes'],
                properties: {
                  companyPhone: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  estimatedDurationMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/Service' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/services/{id}': {
      get: {
        tags: ['Services'],
        summary: 'Get service',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r200({ $ref: '#/components/schemas/Service' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Services'],
        summary: 'Update service',
        security: bearerAuth,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  estimatedDurationMinutes: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/Service' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Services'],
        summary: 'Delete service',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── SPECIALTIES ───────────────────────────────────────────────────────────
    '/api/v1/specialties': {
      get: {
        tags: ['Specialties'],
        summary: 'List specialties',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/Specialty' } }), ...protectedResponses },
      },
      post: {
        tags: ['Specialties'],
        summary: 'Create specialty',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/Specialty' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/specialties/{id}': {
      get: {
        tags: ['Specialties'],
        summary: 'Get specialty',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r200({ $ref: '#/components/schemas/Specialty' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Specialties'],
        summary: 'Update specialty',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/Specialty' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Specialties'],
        summary: 'Delete specialty',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── COVERAGE ZONES ────────────────────────────────────────────────────────
    '/api/v1/coverage-zones': {
      get: {
        tags: ['Coverage Zones'],
        summary: 'List coverage zones',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/CoverageZone' } }), ...protectedResponses },
      },
      post: {
        tags: ['Coverage Zones'],
        summary: 'Create coverage zone',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['companyPhone', 'state', 'city'],
                properties: {
                  companyPhone: { type: 'string' },
                  state: { type: 'string' },
                  city: { type: 'string' },
                  zoneName: { type: 'string' },
                  postalCode: { type: 'string' },
                  coordinates: { type: 'object', description: 'GeoJSON' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/CoverageZone' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/coverage-zones/{id}': {
      get: {
        tags: ['Coverage Zones'],
        summary: 'Get coverage zone',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r200({ $ref: '#/components/schemas/CoverageZone' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Coverage Zones'],
        summary: 'Update coverage zone',
        security: bearerAuth,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  state: { type: 'string' },
                  city: { type: 'string' },
                  zoneName: { type: 'string' },
                  postalCode: { type: 'string' },
                  coordinates: { type: 'object' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/CoverageZone' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Coverage Zones'],
        summary: 'Delete coverage zone',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── SERVICE SPECIALTIES ───────────────────────────────────────────────────
    '/api/v1/service-specialties': {
      get: {
        tags: ['Service Specialties'],
        summary: 'List service-specialty links',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/ServiceSpecialty' } }), ...protectedResponses },
      },
      post: {
        tags: ['Service Specialties'],
        summary: 'Link service to specialty',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['serviceId', 'specialtyId'],
                properties: {
                  serviceId: { type: 'integer' },
                  specialtyId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/ServiceSpecialty' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/service-specialties/{serviceId}/{specialtyId}': {
      delete: {
        tags: ['Service Specialties'],
        summary: 'Unlink service from specialty',
        security: bearerAuth,
        parameters: [idParam('serviceId'), idParam('specialtyId')],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── TECHNICIAN SPECIALTIES ────────────────────────────────────────────────
    '/api/v1/technician-specialties': {
      get: {
        tags: ['Technician Specialties'],
        summary: 'List technician-specialty links',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/TechnicianSpecialty' } }), ...protectedResponses },
      },
      post: {
        tags: ['Technician Specialties'],
        summary: 'Link technician to specialty',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['technicianPhone', 'specialtyId'],
                properties: {
                  technicianPhone: { type: 'string' },
                  specialtyId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/TechnicianSpecialty' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/technician-specialties/{phone}/{specialtyId}': {
      delete: {
        tags: ['Technician Specialties'],
        summary: 'Unlink technician from specialty',
        security: bearerAuth,
        parameters: [phoneParam('phone'), idParam('specialtyId')],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── USERS ─────────────────────────────────────────────────────────────────
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        responses: { ...r200({ type: 'array', items: { $ref: '#/components/schemas/User' } }), ...protectedResponses },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'phone', 'name', 'password'],
                properties: {
                  type: { type: 'string', enum: ['super_admin', 'company', 'technician'] },
                  phone: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { ...r201({ $ref: '#/components/schemas/User' }), ...r400, ...protectedResponses },
      },
    },
    '/api/v1/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r200({ $ref: '#/components/schemas/User' }), ...protectedResponses, ...r404 },
      },
      put: {
        tags: ['Users'],
        summary: 'Update user',
        security: bearerAuth,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { ...r200({ $ref: '#/components/schemas/User' }), ...r400, ...protectedResponses, ...r404 },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        description: 'Only `super_admin`.',
        security: bearerAuth,
        parameters: [idParam()],
        responses: { ...r204, ...protectedResponses, ...r404 },
      },
    },

    // ─── SYSTEM ────────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          ...r200({
            type: 'object',
            properties: {
              status: { type: 'string', example: 'OK' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          }),
        },
      },
    },
  },
};
