// Public Google Web Client ID, not a Client Secret. Must match the backend audience.
const DEFAULT_GOOGLE_CLIENT_ID = '';

export function resolveGoogleClientId(override) {
  return override?.trim() || DEFAULT_GOOGLE_CLIENT_ID;
}
