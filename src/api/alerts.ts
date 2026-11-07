import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import {
  AlertKeyResponseSchema,
  TurnOffAlertsResponseSchema,
  TurnOnAlertsResponseSchema,
  type AlertKeyResponse,
  type TurnOffAlertsRequest,
  type TurnOnAlertsRequest,
  type TurnOnAlertsResponse,
} from '../contracts/alerts';

export const alertKeyKey = ['alerts', 'key'] as const;

/** The server's public alert key; `available` is false when the server has no alert keys. */
export async function getAlertKey(signal?: AbortSignal): Promise<AlertKeyResponse> {
  return AlertKeyResponseSchema.parse(await api.get<unknown>('/api/alerts/key', { signal }));
}

/** Saves this device's push address; the server then sends one alert at once. */
export async function turnOnAlerts(device: TurnOnAlertsRequest): Promise<TurnOnAlertsResponse> {
  return TurnOnAlertsResponseSchema.parse(await api.post<unknown>('/api/alerts/devices', device));
}

/** Removes this device's push address. Nothing to remove is still a success. */
export async function turnOffAlerts(device: TurnOffAlertsRequest): Promise<void> {
  TurnOffAlertsResponseSchema.parse(await api.post<unknown>('/api/alerts/devices/off', device));
}

/**
 * The alert key. It changes only when the server's keys do, so it is not asked again while the
 * page stays open. It is asked again each time the page opens: the offline copy brings back the
 * last answer, and an old "no keys" answer must not hide alerts once the server has keys.
 */
export function useAlertKey() {
  return useQuery({
    queryKey: alertKeyKey,
    queryFn: ({ signal }) => getAlertKey(signal),
    staleTime: Infinity,
    refetchOnMount: 'always',
  });
}
