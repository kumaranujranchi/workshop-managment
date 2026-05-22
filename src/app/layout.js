import './globals.css';
import ConvexClientProvider from './ConvexClientProvider';

export const metadata = {
  title: 'Agentic AI Workshop Management System',
  description: 'AI-powered workshop lifecycle management platform with explainable agent recommendations and role-based access control.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="bg-ambient" />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
