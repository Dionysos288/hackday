import type { NextConfig } from 'next';

/* The old static URLs keep working: /index.html is the home and the tuning pages moved from /lab/*.html to /lab/*.
   /city.html?city=<id> is handled in proxy.ts, because a redirect here would keep ?city= in the new address. */
const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/lab/day-lab.html', destination: '/lab/day', permanent: true },
      { source: '/lab/city-lab.html', destination: '/lab/city', permanent: true },
      { source: '/lab/seal-lab.html', destination: '/lab/seal', permanent: true },
      { source: '/lab/forms-lab.html', destination: '/lab/forms', permanent: true },
    ];
  },
};

export default nextConfig;
