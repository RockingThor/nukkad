import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nukkad - Your local corner store on Alexa+',
  description: 'Multi-tenant MCP server for independent corner shops',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
