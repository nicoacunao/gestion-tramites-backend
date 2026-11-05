export interface User {
  id: string;
  rut: string;
  passwordHash: string;
  names: string;
  firstSurname: string;
  secondSurname: string | null;
  email: string;
  phone: string | null;
  description: string | null;
  role: string;
  organization: string | null;
  active: boolean;
  version: number;
}

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: string;
}
