import api from '../api/client';

export const MAX_DEVICE_PIN_DIGITS = 14;

export function digitsOnlyPin(value: string, maxDigits = MAX_DEVICE_PIN_DIGITS): string {
  return String(value || '').replace(/\D/g, '').slice(0, maxDigits);
}

export async function fetchNextDevicePin(isTrainee: boolean): Promise<string | null> {
  const res = await api.get('/personnel/next-pin', { params: { is_trainee: isTrainee } });
  const pin = res.data?.data?.pin;
  return pin == null ? null : digitsOnlyPin(String(pin));
}
