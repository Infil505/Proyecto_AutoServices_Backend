// Context type for Hono with user payload
export interface AppContext {
  Variables: {
    user?: {
      id: number;
      type: 'technician' | 'company' | 'super_admin';
      phone: string;
      iat: number;
      exp: number;
    };
  };
}
