import api from '../api/client';

export async function fetchNextDevicePin(isTrainee: boolean): Promise<string | null> {
  const res = await api.get('/personnel/next-pin', { params: { is_trainee: isTrainee } });
  const pin = res.data?.data?.pin;
  return pin == null ? null : String(pin);
}
