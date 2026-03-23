export interface Technician {
  phone: string;
  companyPhone: string;
  name: string;
  email?: string;
  specialty?: string;
  available: boolean;
  createdAt: Date;
}