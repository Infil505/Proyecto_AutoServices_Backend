// Context type for Hono with user payload
export interface AppContext {
  Variables: {
    user?: {
      id: number;
      type: 'technician' | 'company' | 'super_admin';
      phone: string;
      companyPhone?: string; // only present for technician role
      iat: number;
      exp: number;
    };
  };
}
