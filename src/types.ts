// Context type for Hono with user payload
export interface AppContext {
  Bindings: {
    clientIp?: string; // real TCP IP injected by Bun.serve, used by rate limiter
  };
  Variables: {
    user?: {
      id: number;
      type: 'technician' | 'company' | 'super_admin';
      phone: string;
      companyPhone?: string; // present for technician and company roles
      jti: string;           // unique token ID — used for revocation
      iat: number;
      exp: number;
      tokenType: 'access' | 'refresh';
    };
  };
}
