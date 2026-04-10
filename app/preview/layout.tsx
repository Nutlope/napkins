import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Preview – Napkins.dev',
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
