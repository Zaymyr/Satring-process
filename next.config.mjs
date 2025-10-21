const securityHeaders = createSecureHeaders({
  contentSecurityPolicy: {
    'default-src': "'self'",
    'script-src': "'self' 'unsafe-inline'",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src': "'self' https://fonts.gstatic.com",
    'img-src': "'self' data:",
    'connect-src': ["'self'", 'https://*.supabase.co'],
    'frame-ancestors': "'none'"
  },
  frameGuard: true,
  referrerPolicy: 'strict-origin-when-cross-origin'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: Object.entries(securityHeaders).map(([key, value]) => ({
          key,
          value
        }))
      }
    ];
  }
};

export default nextConfig;
