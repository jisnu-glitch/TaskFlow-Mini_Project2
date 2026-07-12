import './globals.css';
import { Poppins } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthenticatedLayout } from '@/components/AuthenticatedLayout';
import { SupabaseGuard } from '@/components/SupabaseGuard';
import OllamaChatBubble from '@/components/OllamaChatBubble';

const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-poppins',
});

export const metadata = {
  title: 'TaskFlow - Project Management',
  description: 'A modern project management and task tracking tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${poppins.variable} font-sans bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors`}>
        <SupabaseGuard>
          <ThemeProvider>
            <AuthProvider>
              <AuthenticatedLayout>
                {children}
              </AuthenticatedLayout>
              <OllamaChatBubble />
            </AuthProvider>
          </ThemeProvider>
        </SupabaseGuard>
      </body>
    </html>
  );
}
