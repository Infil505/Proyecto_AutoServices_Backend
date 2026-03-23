export interface CoverageZone {
  id: number;
  companyPhone: string;
  state: string;
  city: string;
  zoneName?: string;
  postalCode?: string;
  coordinates?: any;
  notes?: string;
  createdAt: Date;
}