/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["yt-search", "cheerio"],
  },
};

module.exports = nextConfig;
