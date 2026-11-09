import { apiUrl } from '../config/apiConfig';

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || 'ثبت سوابق مشتری در پرونده انجام نشد.');
  }
  return data as T;
}

export type DeviceImageIdentificationInput = {
  deviceImageId: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

export async function createCustomerImageIdentification(input: DeviceImageIdentificationInput): Promise<{ id: string }> {
  return post('/api/customer-intelligence/image-identifications', input);
}

export async function completeCustomerImageIdentification(
  id: string,
  result: {
    status: 'completed' | 'failed' | 'unmatched';
    detectedPartType?: string;
    summary?: string;
    technicalAdvice?: string;
    selectedProductCode?: string;
    matchedProductCodes?: string[];
    similarProductCodes?: string[];
    confidence?: number;
  }
): Promise<void> {
  await post('/api/customer-intelligence/image-identifications/' + encodeURIComponent(id) + '/result', result);
}

export async function selectCustomerImageProduct(id: string, productCode: string): Promise<void> {
  await post('/api/customer-intelligence/image-identifications/' + encodeURIComponent(id) + '/select', { productCode });
}

export type ConsultationMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: number;
};

export async function saveCustomerConsultation(input: {
  sessionId: string;
  title: string;
  messages: ConsultationMessage[];
  productCodes: string[];
  products?: Array<{ code: string; name: string }>;
  summary: string;
}): Promise<void> {
  await post('/api/customer-intelligence/consultations', input);
}
