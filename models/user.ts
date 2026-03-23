export type UserType = 'technician' | 'company' | 'super_admin';

export interface User {
  id: number;
  type: UserType;
  phone: string;
  name: string;
  email?: string;
  passwordHash: string;
  createdAt: Date;
}