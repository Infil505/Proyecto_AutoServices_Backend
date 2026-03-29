import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./src/config/index.js";
import { rateLimit } from "./src/middleware/validation.js";
import { verifyJWT } from "./src/utils/jwt.js";
import appointmentRoutes from "./src/routes/appointmentRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import companyRoutes from "./src/routes/companyRoutes.js";
import coverageZoneRoutes from "./src/routes/coverageZoneRoutes.js";
import customerRoutes from "./src/routes/customerRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import serviceSpecialtyRoutes from "./src/routes/serviceSpecialtyRoutes.js";
import specialtyRoutes from "./src/routes/specialtyRoutes.js";
import technicianRoutes from "./src/routes/technicianRoutes.js";
import technicianSpecialtyRoutes from "./src/routes/technicianSpecialtyRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import type { AppContext } from "./src/types.js";
import { startAppointmentWebsocket } from "./src/ws/appointmentWebsocket.js";

const app = new Hono<AppContext>();

// Start badge websocket feed for appointments (pub/sub)
startAppointmentWebsocket();

// JWT verification middleware
function jwtMiddleware(secret: string) {
  return async (c: any, next: any) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Missing authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const payload = verifyJWT(token, secret);
    if (!payload) {
      return c.json({ error: "Invalid token" }, 401);
    }
    c.var.user = payload;
    await next();
  };
}

// CORS middleware
app.use("*", cors({ origin: config.corsOrigins }));

// Rate limiting
app.use("*", rateLimit(config.rateLimitMax, config.rateLimitWindowMs));

// Public auth routes
app.route("/api/auth", authRoutes);

// JWT middleware for protected routes
const jwtProtect = jwtMiddleware(config.jwtSecret);
app.use("/api/appointments/*", jwtProtect);
app.use("/api/companies/*", jwtProtect);
app.use("/api/customers/*", jwtProtect);
app.use("/api/services/*", jwtProtect);
app.use("/api/service-specialties/*", jwtProtect);
app.use("/api/specialties/*", jwtProtect);
app.use("/api/technicians/*", jwtProtect);
app.use("/api/technician-specialties/*", jwtProtect);
app.use("/api/coverage-zones/*", jwtProtect);
app.use("/api/users/*", jwtProtect);

// Protected routes
app.route("/api/appointments", appointmentRoutes);
app.route("/api/companies", companyRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/services", serviceRoutes);
app.route("/api/service-specialties", serviceSpecialtyRoutes);
app.route("/api/specialties", specialtyRoutes);
app.route("/api/technicians", technicianRoutes);
app.route("/api/technician-specialties", technicianSpecialtyRoutes);
app.route("/api/coverage-zones", coverageZoneRoutes);
app.route("/api/users", userRoutes);

// Health check
app.get("/health", (c) =>
  c.json({ status: "OK", timestamp: new Date().toISOString() }),
);

// API Documentation endpoint
app.get("/docs", (c) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>AutoServices API Documentation</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; color: #333; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          h1 { color: #0066cc; margin: 30px 0 10px; font-size: 2.5em; }
          h2 { color: #0066cc; margin: 25px 0 15px; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
          h3 { color: #444; margin: 20px 0 10px; }
          .endpoint { background: white; padding: 20px; margin: 15px 0; border-left: 5px solid #007bff; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .method { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; margin-right: 10px; font-size: 0.9em; }
          .get { background: #61affe; color: white; }
          .post { background: #49cc90; color: white; }
          .put { background: #fca130; color: white; }
          .delete { background: #f93e3e; color: white; }
          .path { background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-family: 'Courier New', monospace; }
          .section-title { background: #f0f8ff; padding: 10px 15px; margin: 20px 0 10px; border-radius: 3px; border-left: 4px solid #0066cc; }
          .request-section, .response-section { margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 3px; border: 1px solid #e0e0e0; }
          .response-section { background: #f0f8ff; border: 1px solid #b3d9ff; }
          pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 0.9em; margin: 10px 0; }
          code { font-family: 'Courier New', monospace; }
          .status-code { display: inline-block; padding: 3px 8px; border-radius: 3px; font-weight: bold; margin-right: 10px; }
          .status-200 { background: #d4edda; color: #155724; }
          .status-201 { background: #d4edda; color: #155724; }
          .status-400 { background: #f8d7da; color: #721c24; }
          .status-401 { background: #f8d7da; color: #721c24; }
          .status-404 { background: #f8d7da; color: #721c24; }
          .status-500 { background: #f8d7da; color: #721c24; }
          .field-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .field-table th { background: #0066cc; color: white; padding: 10px; text-align: left; }
          .field-table td { padding: 10px; border-bottom: 1px solid #ddd; }
          .field-table tr:nth-child(even) { background: #f9f9f9; }
          .required { color: #ff0000; font-weight: bold; }
          .optional { color: #666; }
          .auth-required { color: #ff6b6b; font-weight: bold; padding: 5px; background: #ffe6e6; border-radius: 3px; }
          .note { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 3px; margin: 10px 0; }
          .error-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 3px; color: #721c24; margin: 10px 0; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 3px; color: #155724; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1> AutoServices Backend API</h1>
          <p><strong>Base URL:</strong> <span class="path">http://localhost:3000</span></p>
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Authentication:</strong> JWT Bearer Token</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">
          
          <h2> Public Endpoints (No Authentication Required)</h2>
          
          <!-- REGISTER -->
          <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/api/auth/register</span></h3>
            <p>Register a new user account (technician, company, or super_admin)</p>
            
            <div class="section-title">Request Body</div>
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              <tr><td><code>phone</code></td><td>string</td><td><span class="required">Yes</span></td><td>User phone number (e.g., +1234567890)</td></tr>
              <tr><td><code>password</code></td><td>string</td><td><span class="required">Yes</span></td><td>Password (minimum 6 characters)</td></tr>
              <tr><td><code>type</code></td><td>string</td><td><span class="required">Yes</span></td><td>User type: "technician" | "company" | "super_admin"</td></tr>
            </table>
            
            <div class="request-section">
              <strong>Example Request:</strong>
              <pre>curl -X POST http://localhost:3000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+1234567890",
    "password": "secure_password",
    "type": "technician"
  }'</pre>
            </div>
            
            <div class="response-section">
              <strong>Response (201 Created):</strong>
              <span class="status-code status-201">201</span> User registered successfully
              <pre>{
  "id": 1,
  "phone": "+1234567890",
  "type": "technician",
  "createdAt": "2026-03-07T10:30:00Z"
}</pre>
            </div>
            
            <div class="error-box">
              <strong>Error Response (400 Bad Request):</strong>
              <pre>{
  "error": "Phone number already registered"
}</pre>
            </div>
          </div>
          
          <!-- LOGIN -->
          <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/api/auth/login</span></h3>
            <p>Login and receive JWT authentication token</p>
            
            <div class="section-title">Request Body</div>
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              <tr><td><code>phone</code></td><td>string</td><td><span class="required">Yes</span></td><td>Registered phone number</td></tr>
              <tr><td><code>password</code></td><td>string</td><td><span class="required">Yes</span></td><td>Account password</td></tr>
            </table>
            
            <div class="request-section">
              <strong>Example Request:</strong>
              <pre>curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+1234567890",
    "password": "secure_password"
  }'</pre>
            </div>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <span class="status-code status-200">200</span> Login successful
              <pre>{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "phone": "+1234567890",
    "type": "technician"
  }
}</pre>
            </div>
            
            <div class="error-box">
              <strong>Error Response (401 Unauthorized):</strong>
              <pre>{
  "error": "Invalid credentials"
}</pre>
            </div>
          </div>
          
          <!-- HEALTH CHECK -->
          <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/health</span></h3>
            <p>Health check endpoint - verify API is running</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <span class="status-code status-200">200</span>
              <pre>{
  "status": "OK",
  "timestamp": "2026-03-07T10:30:00Z"
}</pre>
            </div>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">
          
          <h2> Protected Endpoints (Requires JWT Token)</h2>
          <p><span class="auth-required">All endpoints below require: Authorization: Bearer &lt;your_jwt_token&gt;</span></p>
          
          <!-- APPOINTMENTS -->
          <h3> Appointments</h3>
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/ws/appointments</span></h4>
            <p>WebSocket endpoint for real-time appointment events</p>
            <div class="response-section">
              <strong>Connect via:</strong>
              <pre>const socket = new WebSocket('ws://localhost:3001');</pre>
              <p>Events emitted:</p>
              <ul>
                <li><code>appointment:created</code></li>
                <li><code>appointment:updated</code></li>
                <li><code>appointment:deleted</code></li>
              </ul>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/appointments</span></h4>
            <p>Get all appointments (with pagination)</p>
            <p>Query Parameters: <code>page</code> (default: 1), <code>limit</code> (default: 10)</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "id": 1,
      "customerPhone": "+1234567890",
      "technicianPhone": "+0987654321",
      "serviceId": 1,
      "appointmentDate": "2026-03-15T14:00:00Z",
      "status": "scheduled",
      "notes": "Check air conditioning unit"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 25
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/appointments</span></h4>
            <p>Create new appointment</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              <tr><td><code>customerPhone</code></td><td>string</td><td><span class="required">Yes</span></td><td>Customer phone number</td></tr>
              <tr><td><code>technicianPhone</code></td><td>string</td><td><span class="required">Yes</span></td><td>Technician phone number</td></tr>
              <tr><td><code>serviceId</code></td><td>number</td><td><span class="required">Yes</span></td><td>Service ID</td></tr>
              <tr><td><code>appointmentDate</code></td><td>string (ISO8601)</td><td><span class="required">Yes</span></td><td>e.g., "2026-03-15T14:00:00Z"</td></tr>
              <tr><td><code>notes</code></td><td>string</td><td><span class="optional">No</span></td><td>Additional notes</td></tr>
            </table>
            
            <div class="request-section">
              <strong>Example Request:</strong>
              <pre>{
  "customerPhone": "+1234567890",
  "technicianPhone": "+0987654321",
  "serviceId": 1,
  "appointmentDate": "2026-03-15T14:00:00Z",
  "notes": "Check air conditioning"
}</pre>
            </div>
            
            <div class="response-section">
              <strong>Response (201 Created):</strong>
              <pre>{
  "id": 101,
  "customerPhone": "+1234567890",
  "technicianPhone": "+0987654321",
  "serviceId": 1,
  "appointmentDate": "2026-03-15T14:00:00Z",
  "status": "scheduled",
  "notes": "Check air conditioning",
  "createdAt": "2026-03-07T10:30:00Z"
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/appointments/:id</span></h4>
            <p>Get appointment by ID</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "id": 1,
  "customerPhone": "+1234567890",
  "technicianPhone": "+0987654321",
  "serviceId": 1,
  "appointmentDate": "2026-03-15T14:00:00Z",
  "status": "scheduled",
  "notes": "Check air conditioning"
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/appointments/:id</span></h4>
            <p>Update appointment</p>
            <p><strong>Allowed fields to update:</strong> appointmentDate, notes, status</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "message": "Appointment updated",
  "id": 1
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/appointments/:id</span></h4>
            <p>Delete appointment</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "message": "Appointment deleted",
  "id": 1
}</pre>
            </div>
          </div>
          
          <!-- COMPANIES -->
          <h3> Companies</h3>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/companies</span></h4>
            <p>Get all companies (with pagination)</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "phone": "+1234567890",
      "name": "ACME Services",
      "email": "contact@acme.com",
      "address": "123 Main St",
      "city": "New York",
      "coverageZoneId": 1
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 5
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/companies</span></h4>
            <p>Create new company</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th></tr>
              <tr><td><code>phone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>name</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>email</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>address</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>city</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>coverageZoneId</code></td><td>number</td><td><span class="optional">No</span></td></tr>
            </table>
            
            <div class="response-section">
              <strong>Response (201 Created):</strong>
              <pre>{
  "phone": "+1234567890",
  "name": "ACME Services",
  "email": "contact@acme.com",
  "address": "123 Main St",
  "city": "New York",
  "coverageZoneId": 1
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/companies/:phone</span></h4>
            <p>Get company by phone number</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/companies/:phone</span></h4>
            <p>Update company information</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "message": "Company updated successfully"
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/companies/:phone</span></h4>
            <p>Delete company</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "message": "Company deleted successfully"
}</pre>
            </div>
          </div>
          
          <!-- CUSTOMERS -->
          <h3> Customers</h3>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/customers</span></h4>
            <p>Get all customers (paginated)</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "phone": "+1234567890",
      "name": "John Doe",
      "email": "john@example.com",
      "address": "456 Oak Ave",
      "city": "Boston",
      "companyPhone": "+1111111111"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 150
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/customers</span></h4>
            <p>Create new customer</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th></tr>
              <tr><td><code>phone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>name</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>email</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>address</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>city</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>companyPhone</code></td><td>string</td><td><span class="optional">No</span></td></tr>
            </table>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/customers/:phone</span></h4>
            <p>Get customer by phone number</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/customers/:phone</span></h4>
            <p>Update customer information</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/customers/:phone</span></h4>
            <p>Delete customer</p>
          </div>
          
          <!-- SERVICES -->
          <h3>🔧 Services</h3>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/services</span></h4>
            <p>Get all services</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "id": 1,
      "name": "Air Conditioning Repair",
      "description": "Full AC system maintenance and repair",
      "price": 150.00,
      "duration": 120,
      "companyPhone": "+1234567890"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 20
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/services</span></h4>
            <p>Create new service</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th></tr>
              <tr><td><code>name</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>description</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>price</code></td><td>number</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>duration</code></td><td>number</td><td><span class="required">Yes</span> (minutes)</td></tr>
              <tr><td><code>companyPhone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
            </table>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/services/:id</span></h4>
            <p>Get service by ID</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/services/:id</span></h4>
            <p>Update service</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/services/:id</span></h4>
            <p>Delete service</p>
          </div>
          
          <!-- TECHNICIANS -->
          <h3> Technicians</h3>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/technicians</span></h4>
            <p>Get all technicians</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "phone": "+0987654321",
      "name": "Jane Smith",
      "specialization": "HVAC",
      "availability": "Available",
      "companyPhone": "+1234567890",
      "coverageZoneId": 1
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 45
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/technicians</span></h4>
            <p>Create new technician</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th></tr>
              <tr><td><code>phone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>name</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>specialization</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>availability</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>companyPhone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>coverageZoneId</code></td><td>number</td><td><span class="optional">No</span></td></tr>
            </table>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/technicians/:phone</span></h4>
            <p>Get technician by phone</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/technicians/:phone</span></h4>
            <p>Update technician</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/technicians/:phone</span></h4>
            <p>Delete technician</p>
          </div>
          
          <!-- COVERAGE ZONES -->
          <h3> Coverage Zones</h3>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/coverage-zones</span></h4>
            <p>Get all coverage zones</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "id": 1,
      "name": "Downtown Boston",
      "city": "Boston",
      "state": "MA",
      "zipCode": "02101",
      "companyPhone": "+1234567890"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 8
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/coverage-zones</span></h4>
            <p>Create new coverage zone</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th></tr>
              <tr><td><code>name</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>city</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>state</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>zipCode</code></td><td>string</td><td><span class="optional">No</span></td></tr>
              <tr><td><code>companyPhone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
            </table>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/coverage-zones/:id</span></h4>
            <p>Get coverage zone by ID</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/coverage-zones/:id</span></h4>
            <p>Update coverage zone</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/coverage-zones/:id</span></h4>
            <p>Delete coverage zone</p>
          </div>
          
          <!-- USERS -->
          <h3> Users (Admin Only)</h3>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/users</span></h4>
            <p>Get all users (super_admin only)</p>
            
            <div class="response-section">
              <strong>Response (200 OK):</strong>
              <pre>{
  "data": [
    {
      "id": 1,
      "phone": "+1234567890",
      "type": "technician",
      "createdAt": "2026-03-01T08:00:00Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 200
}</pre>
            </div>
          </div>
          
          <div class="endpoint">
            <h4><span class="method post">POST</span><span class="path">/api/users</span></h4>
            <p>Create new user (super_admin only)</p>
            
            <table class="field-table">
              <tr><th>Field</th><th>Type</th><th>Required</th></tr>
              <tr><td><code>phone</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>password</code></td><td>string</td><td><span class="required">Yes</span></td></tr>
              <tr><td><code>type</code></td><td>string</td><td><span class="required">Yes</span> (technician|company|super_admin)</td></tr>
            </table>
          </div>
          
          <div class="endpoint">
            <h4><span class="method get">GET</span><span class="path">/api/users/:id</span></h4>
            <p>Get user by ID (super_admin only)</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method put">PUT</span><span class="path">/api/users/:id</span></h4>
            <p>Update user (super_admin only)</p>
          </div>
          
          <div class="endpoint">
            <h4><span class="method delete">DELETE</span><span class="path">/api/users/:id</span></h4>
            <p>Delete user (super_admin only)</p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">
          
          <h2> Common Response Codes</h2>
          <table class="field-table">
            <tr><th>Code</th><th>Meaning</th><th>Description</th></tr>
            <tr><td><span class="status-code status-200">200</span></td><td>OK</td><td>Request successful</td></tr>
            <tr><td><span class="status-code status-201">201</span></td><td>Created</td><td>Resource created successfully</td></tr>
            <tr><td><span class="status-code status-400">400</span></td><td>Bad Request</td><td>Invalid request data</td></tr>
            <tr><td><span class="status-code status-401">401</span></td><td>Unauthorized</td><td>Missing or invalid JWT token</td></tr>
            <tr><td><span class="status-code status-404">404</span></td><td>Not Found</td><td>Resource not found</td></tr>
            <tr><td><span class="status-code status-500">500</span></td><td>Server Error</td><td>Internal server error</td></tr>
          </table>
          
          <h2> Error Response Format</h2>
          <div class="error-box">
            <strong>All error responses follow this format:</strong>
            <pre>{
  "error": "Error message describing what went wrong"
}</pre>
          </div>
          
          <h2> Tips & Best Practices</h2>
          <div class="note">
            <strong>1. JWT Token Management:</strong> Store the token securely and include it in the Authorization header for all protected endpoints
          </div>
          <div class="note">
            <strong>2. Pagination:</strong> Use <code>page</code> and <code>limit</code> query parameters for list endpoints
          </div>
          <div class="note">
            <strong>3. Timestamps:</strong> All timestamps are in ISO 8601 format (UTC)
          </div>
          <div class="note">
            <strong>4. Phone Numbers:</strong> Use international format with + prefix (e.g., +1234567890)
          </div>
          <div class="note">
            <strong>5. Role-Based Access:</strong> Some endpoints are restricted to specific user types (technician, company, super_admin)
          </div>
          
        </div>
      </body>
    </html>
  `;
  return c.html(html);
});

app.get("/", (c) =>
  c.text("AutoServices Backend API - REST API with JWT Authentication"),
);

// Global error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log("AutoServices REST API running on http://localhost:3000");
console.log("API Documentation:");
console.log("  POST /api/auth/register - Register new user");
console.log("  POST /api/auth/login - Login");
console.log("  GET /health - Health check");
console.log("  Protected endpoints require: Authorization: Bearer <token>");
