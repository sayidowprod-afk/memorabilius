/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['web-push'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
}

module.exports = nextConfig
