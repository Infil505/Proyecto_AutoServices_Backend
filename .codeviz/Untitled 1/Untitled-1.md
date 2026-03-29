# Unnamed CodeViz Diagram

```mermaid
graph TD

    base.cv::admin["**Admin User**<br>[External]"]
    base.cv::customer["**Customer User**<br>[External]"]
    subgraph base.cv::api["**AutoServices Backend API**<br>index.ts `import`, src/controllers `class`"]
        subgraph base.cv::api_server["**API Server**<br>index.ts `app = new Hono()`, package.json `"start": "NODE_ENV=production bun run index.ts"`"]
            base.cv::api_routes["**API Routes**<br>src/routes `app.route`"]
            base.cv::controllers["**Controllers**<br>src/controllers `class`"]
            base.cv::services["**Services**<br>src/services `class`"]
            base.cv::data_access["**Data Access Layer**<br>src/db/index.ts `db`, src/db/schema.ts `table`"]
            base.cv::auth_middleware["**Authentication Middleware**<br>src/middleware/validation.ts `jwtMiddleware`, src/utils/jwt.ts `verifyJWT`"]
            base.cv::validation_middleware["**Validation Middleware**<br>src/middleware/validation.ts `rateLimit`, src/validation/schemas.ts `z.object`"]
            base.cv::websocket_event_publisher["**WebSocket Event Publisher**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`, src/services/appointmentService.ts `events.emit`"]
            %% Edges at this level (grouped by source)
            base.cv::api_routes["**API Routes**<br>src/routes `app.route`"] -->|"Delegates to"| base.cv::controllers["**Controllers**<br>src/controllers `class`"]
            base.cv::controllers["**Controllers**<br>src/controllers `class`"] -->|"Uses"| base.cv::services["**Services**<br>src/services `class`"]
            base.cv::services["**Services**<br>src/services `class`"] -->|"Queries"| base.cv::data_access["**Data Access Layer**<br>src/db/index.ts `db`, src/db/schema.ts `table`"]
            base.cv::services["**Services**<br>src/services `class`"] -->|"Publishes events"| base.cv::websocket_event_publisher["**WebSocket Event Publisher**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`, src/services/appointmentService.ts `events.emit`"]
            base.cv::auth_middleware["**Authentication Middleware**<br>src/middleware/validation.ts `jwtMiddleware`, src/utils/jwt.ts `verifyJWT`"] -->|"Authenticates requests before routing"| base.cv::api_routes["**API Routes**<br>src/routes `app.route`"]
            base.cv::validation_middleware["**Validation Middleware**<br>src/middleware/validation.ts `rateLimit`, src/validation/schemas.ts `z.object`"] -->|"Validates requests before routing"| base.cv::api_routes["**API Routes**<br>src/routes `app.route`"]
        end
        subgraph base.cv::websocket_server["**Appointment WebSocket Server**<br>src/ws/appointmentWebsocket.ts `startAppointmentWebsocket()`, src/ws/appointmentWebsocket.ts `new WebSocketServer({ port: WS_PORT })`"]
            base.cv::websocket_server_instance["**WebSocket Server Instance**<br>src/ws/appointmentWebsocket.ts `new WebSocketServer`"]
            base.cv::auth_handler["**Authentication Handler**<br>src/ws/appointmentWebsocket.ts `verifyJWT`"]
            base.cv::client_manager["**Client Manager**<br>src/ws/appointmentWebsocket.ts `clients = new Map()`"]
            base.cv::message_broadcaster["**Message Broadcaster**<br>src/ws/appointmentWebsocket.ts `broadcast(event, appointment)`"]
            base.cv::event_listener["**Event Listener**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`"]
            %% Edges at this level (grouped by source)
            base.cv::websocket_server_instance["**WebSocket Server Instance**<br>src/ws/appointmentWebsocket.ts `new WebSocketServer`"] -->|"Verifies token for new connection"| base.cv::auth_handler["**Authentication Handler**<br>src/ws/appointmentWebsocket.ts `verifyJWT`"]
            base.cv::websocket_server_instance["**WebSocket Server Instance**<br>src/ws/appointmentWebsocket.ts `new WebSocketServer`"] -->|"Manages connected clients"| base.cv::client_manager["**Client Manager**<br>src/ws/appointmentWebsocket.ts `clients = new Map()`"]
            base.cv::event_listener["**Event Listener**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`"] -->|"Notifies"| base.cv::message_broadcaster["**Message Broadcaster**<br>src/ws/appointmentWebsocket.ts `broadcast(event, appointment)`"]
            base.cv::message_broadcaster["**Message Broadcaster**<br>src/ws/appointmentWebsocket.ts `broadcast(event, appointment)`"] -->|"Identifies relevant clients"| base.cv::client_manager["**Client Manager**<br>src/ws/appointmentWebsocket.ts `clients = new Map()`"]
            base.cv::message_broadcaster["**Message Broadcaster**<br>src/ws/appointmentWebsocket.ts `broadcast(event, appointment)`"] -->|"Sends messages to clients via"| base.cv::websocket_server_instance["**WebSocket Server Instance**<br>src/ws/appointmentWebsocket.ts `new WebSocketServer`"]
        end
        %% Edges at this level (grouped by source)
        base.cv::api_server["**API Server**<br>index.ts `app = new Hono()`, package.json `"start": "NODE_ENV=production bun run index.ts"`"] -->|"Starts and provides events to"| base.cv::websocket_server["**Appointment WebSocket Server**<br>src/ws/appointmentWebsocket.ts `startAppointmentWebsocket()`, src/ws/appointmentWebsocket.ts `new WebSocketServer({ port: WS_PORT })`"]
        base.cv::websocket_event_publisher["**WebSocket Event Publisher**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`, src/services/appointmentService.ts `events.emit`"] -->|"Emits events to"| base.cv::event_listener["**Event Listener**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`"]
        base.cv::websocket_event_publisher["**WebSocket Event Publisher**<br>src/ws/appointmentWebsocket.ts `AppointmentService.events.on`, src/services/appointmentService.ts `events.emit`"] -->|"Sends events to"| base.cv::websocket_server["**Appointment WebSocket Server**<br>src/ws/appointmentWebsocket.ts `startAppointmentWebsocket()`, src/ws/appointmentWebsocket.ts `new WebSocketServer({ port: WS_PORT })`"]
    end
    subgraph base.cv::database["**PostgreSQL Database**<br>src/db/schema.ts `table`, drizzle.config.ts `schema`"]
        base.cv::postgresql_instance["**PostgreSQL Instance**<br>src/db/schema.ts `table`"]
    end
    %% Edges at this level (grouped by source)
    base.cv::admin["**Admin User**<br>[External]"] -->|"Manages the platform"| base.cv::api_routes["**API Routes**<br>src/routes `app.route`"]
    base.cv::customer["**Customer User**<br>[External]"] -->|"Accesses services"| base.cv::api_routes["**API Routes**<br>src/routes `app.route`"]
    base.cv::customer["**Customer User**<br>[External]"] -->|"Connects to"| base.cv::websocket_server_instance["**WebSocket Server Instance**<br>src/ws/appointmentWebsocket.ts `new WebSocketServer`"]
    base.cv::customer["**Customer User**<br>[External]"] -->|"Receives real-time updates"| base.cv::websocket_server["**Appointment WebSocket Server**<br>src/ws/appointmentWebsocket.ts `startAppointmentWebsocket()`, src/ws/appointmentWebsocket.ts `new WebSocketServer({ port: WS_PORT })`"]
    base.cv::data_access["**Data Access Layer**<br>src/db/index.ts `db`, src/db/schema.ts `table`"] -->|"Reads from and writes to"| base.cv::postgresql_instance["**PostgreSQL Instance**<br>src/db/schema.ts `table`"]

```
---
*Generated by [CodeViz.ai](https://codeviz.ai) on 3/28/2026, 9:09:41 PM*
