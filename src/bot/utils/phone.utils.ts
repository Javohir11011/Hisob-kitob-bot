export function normalizePhone(phone: string): string {
  phone = phone.replace(/\s+/g, '');
  if (phone.startsWith('0')) phone = '+998' + phone.slice(1);
  if (!phone.startsWith('+')) phone = '+' + phone;
  return phone;
}
