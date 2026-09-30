import { Analytics } from '@vercel/analytics/next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3030'),
  title: {
    template: '%s | CInCoders ReactJS StarterKit',
    default: 'CInCoders ReactJS StarterKit - Documentação',
  },
  description:
    'Documentação técnica e arquitetural do CInCoders ReactJS StarterKit com Vite, Keycloak e o padrão de módulos da CInCoders.',
  openGraph: {
    siteName: 'CInCoders ReactJS StarterKit Docs',
    type: 'website',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
