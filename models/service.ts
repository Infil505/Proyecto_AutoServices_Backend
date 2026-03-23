export interface Service {
  id: number;
  companyPhone: string;
  name: string;
  description?: string;
  category?: string;
  estimatedDurationMinutes: number;
  active: boolean;
  createdAt: Date;
}