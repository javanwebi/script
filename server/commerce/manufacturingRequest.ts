/** Validate an explicit manufacturing enquiry before persisting customer data. */
export function validateManufacturingRequest(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_REQUEST');
  const data = input as Record<string, unknown>;
  const digits = (value: string) => value.replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)));
  const name = typeof data.name === 'string' ? data.name.trim().replace(/\s+/g, ' ') : '';
  let phone = typeof data.phone === 'string' ? digits(data.phone).replace(/[\s()-]/g, '') : '';
  if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
  if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
  if (name.length < 2 || name.length > 120 || /[\x00-\x1f]/.test(name)) throw new Error('INVALID_NAME');
  if (!/^09\d{9}$/.test(phone)) throw new Error('INVALID_PHONE');
  if (data.imageConsent !== true) throw new Error('IMAGE_CONSENT_REQUIRED');
  const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
  if (notes.length > 2000) throw new Error('NOTES_TOO_LONG');
  // Image bytes must be separately decoded, verified and stored privately by the route.
  // Never trust a browser-supplied image URL or storage path as an attachment.
  return {name, phone, notes, imageConsent: true as const};
}
