/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'api-seatly-f4e8bqh0e2bvd5hb.francecentral-01.azurewebsites.net',
    },
  ],
},
};

export default nextConfig;