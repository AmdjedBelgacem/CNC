export interface Certification {
  id: string;
  tenantId: string;
  userId: string;
  courseId: string;
  templateId: string | null;
  certificateNumber: string;
  issuedAt: Date;
  expiresAt: Date | null;
  metadata: CertMetadata | null;
  pdfUrl: string | null;
  digitalSignature: string | null;
}

export interface CertMetadata {
  courseTitle?: string;
  courseSlug?: string;
  userName?: string;
  userEmail?: string;
  completedLessons?: number;
  totalLessons?: number;
  averageScore?: number;
  issuerName?: string;
  issuerTitle?: string;
}

export interface CertTemplate {
  id: string;
  tenantId: string;
  name: string;
  layout: 'modern' | 'classic' | 'minimal';
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  fontFamily: string;
  fields: CertTemplateField[];
}

export interface CertTemplateField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
}
