const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_DOCS_URL ?? 'https://cincoders-nestjs-starterkit.vercel.app';

/**
 * Link para a documentação publicada do boilerplate de backend (NestJS).
 * URL configurável via NEXT_PUBLIC_BACKEND_DOCS_URL para apontar para um
 * deploy diferente sem precisar editar cada página MDX.
 */
export function BackendLink({
  path = '',
  children,
}: {
  path?: string;
  children: React.ReactNode;
}) {
  return <a href={`${BACKEND_URL}${path}`}>{children}</a>;
}
