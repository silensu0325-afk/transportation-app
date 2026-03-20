export interface User {
  id: string;
  name: string;
  certificate_number: string;
  expiry_date: string;
  created_at: string;
}

export interface UserFormData {
  name: string;
  certificate_number: string;
  expiry_date: string;
}

export interface SupportRecord {
  id: string;
  user_id: string;
  date: string;
  content: string;
  staff_name: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  age: string;
  gender: string;
  is_cohabiting: boolean;
  is_emergency: boolean;
  created_at: string;
}

export interface TransportationExpense {
  id: string;
  user_id?: string;
  person_name: string;
  date: string;
  destination: string;
  route: string;
  section_from: string;
  section_to: string;
  distance: number;
  is_round_trip: boolean;
  amount: number;
  created_at: string;
}

export interface FavoriteDestination {
  id: string;
  name: string;
  destination: string;
  route: string;
  section_from: string;
  section_to: string;
  distance: number;
  created_at: string;
}
