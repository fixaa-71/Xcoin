export function getDeviceId(): string {
  let id = localStorage.getItem('xcoin_device_id');
  if (!id) {
    id = `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('xcoin_device_id', id);
  }
  return id;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const telegramUserId = localStorage.getItem('xcoin_auth_user_id') || '';
  const adminToken = localStorage.getItem('xcoin_admin_token') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (telegramUserId) {
    headers['x-telegram-user-id'] = telegramUserId;
  }
  if (adminToken) {
    headers['x-admin-token'] = adminToken;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }

  return data;
}
