export interface Customer {
  phone: string;
  name?: string;
  email?: string;
  state?: string;
  city?: string;
  address?: string;
  content?: string;
  metadata?: any;
  embedding?: number[];
  createdAt: Date;
}