/** @type {import('next').NextConfig} */

// The O2S API. Pages served over https (Vercel) cannot call an http API from the browser, so lib/o2s sends
// those requests to /o2s-api on this site and this rewrite forwards them to the API from the server.
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")

const nextConfig = {
  async rewrites() {
    return apiUrl ? [{ source: "/o2s-api/:path*", destination: `${apiUrl}/:path*` }] : []
  },
}

export default nextConfig
