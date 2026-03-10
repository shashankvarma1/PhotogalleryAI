import Providers from "./providers";
import './globals.css';

export const metadata = {
  title: 'Photo Manager',
  description: 'AI-Powered Photo Management Web Application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          minHeight: '100vh',
        }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
