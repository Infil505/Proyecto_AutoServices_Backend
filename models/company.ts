export interface Company {
  phone: string;
  name: string;
  email?: string;
  address?: string;
  createdAt: Date;
  startHour?: string;
  endHour?: string;
}