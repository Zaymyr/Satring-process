/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  experimental: { typedRoutes: true },
  async headers() {
    const scriptSrcBase = [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.jsdelivr.net',
      'https://vercel.live',
      'https://*.vercel.live'
    ];

    const scriptSrc = [...scriptSrcBase, ...(isDev ? ["'unsafe-eval'"] : [])].join(' ');
    const scriptSrcElem = scriptSrcBase.join(' ');

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      `script-src-elem ${scriptSrcElem}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://vercel.live https://*.vercel.live wss://vercel.live wss://*.vercel.live",
      "frame-src 'self' https://vercel.live https://*.vercel.live",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
        ]
      }
    ];
  }
};

export default nextConfig;
