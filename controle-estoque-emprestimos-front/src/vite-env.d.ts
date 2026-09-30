/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_KEYCLOAK_JSON: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
