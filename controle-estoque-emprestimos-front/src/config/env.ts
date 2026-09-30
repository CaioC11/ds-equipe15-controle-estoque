export function getRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value as string;
}

const keycloakJson = JSON.parse(getRequiredEnv('VITE_KEYCLOAK_JSON'));

export const env = {
  apiUrl: getRequiredEnv('VITE_API_URL'),
  baseUrl: import.meta.env.BASE_URL,
  keycloakUrl: keycloakJson['auth-server-url'],
  keycloakRealm: keycloakJson.realm,
  keycloakClientId: keycloakJson.resource,
  keycloakClientSecret: keycloakJson.credentials?.secret,
};
