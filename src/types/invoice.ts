export type UserRole = 'Administrator' | 'Staff';

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Unpaid'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled';

export type PaymentMethod =
  | 'Transfer Bank'
  | 'Tunai'
  | 'QRIS'
  | 'E-Wallet'
  | 'Metode lainnya';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Aktif' | 'Nonaktif';
  created_at: string;
}

export interface Client {
  id: string;
  client_name: string;
  contact_person: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  service_name: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  status: 'Aktif' | 'Nonaktif';
  created_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  service_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount: number;
  additional_cost: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  balance: number;
  status: InvoiceStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  items?: InvoiceLineItem[];
  client?: Client;
}

export interface Payment {
  id: string;
  receipt_number: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string;
  notes: string;
  recorded_by?: string;
  created_at: string;
}

export interface CompanySettingsMap {
  company_name: string;
  tagline: string;
  business_field: string;
  address: string;
  whatsapp: string;
  email: string;
  website: string;
  logo_url: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  qris_url: string;
  invoice_prefix: string;
  receipt_prefix: string;
  document_year: string;
  footer_note: string;
  terms_and_conditions: string;
  tax_enabled: string; // 'true' | 'false'
  tax_rate: string; // numeric string e.g. '11'
  currency: string;
  date_format: string;
  signatory_name: string;
  signatory_role: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name?: string;
  activity: string;
  description: string;
  timestamp: string;
}

export interface DatabaseStatus {
  mode: 'GOOGLE_SHEETS' | 'DEMO_LOCAL';
  connected: boolean;
  spreadsheet_name: string;
  gas_url_configured: boolean;
  gas_url_masked: string;
  last_sync: string | null;
  message: string;
}
