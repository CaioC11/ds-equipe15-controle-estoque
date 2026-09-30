import { type AuthProviderProps } from 'react-oidc-context';
import { env } from '../config/env';

const keycloakBaseUrl = new URL(env.keycloakUrl, window.location.origin);

export const authProviderProps: AuthProviderProps = {
  authority: new URL(
    `realms/${env.keycloakRealm}`,
    `${keycloakBaseUrl.toString().replace(/\/$/, '')}/`,
  ).toString(),
  client_id: env.keycloakClientId,
  ...(env.keycloakClientSecret && { client_secret: env.keycloakClientSecret }),
  redirect_uri: window.location.origin + env.baseUrl,
  post_logout_redirect_uri: window.location.origin + env.baseUrl,
  accessTokenExpiringNotificationTimeInSeconds: 30,
  automaticSilentRenew: true,
  checkSessionIntervalInSeconds: 2,
  monitorSession: true,
  redirectMethod: 'replace',
};
