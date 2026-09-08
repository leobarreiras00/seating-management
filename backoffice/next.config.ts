/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'api-seatly.onrender.com',
    },
  ],
},
};

export default nextConfig;