export interface Appointment {
  id: number;
  customerPhone?: string;
  companyPhone: string;
  technicianPhone?: string;
  appointmentDate?: Date;
  startTime?: string;
  status: string;
  content?: string;
  metadata?: any;
  embedding?: number[];
  createdAt: Date;
  coordinates?: any;
  serviceId?: number;
}