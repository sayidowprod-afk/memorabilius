/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['web-push', 'onnxruntime-node'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
}

module.exports = nextConfig
