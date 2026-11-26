/** @type {import('next').NextConfig} */

// The O2S API. Pages served over https (Vercel) cannot call an http API from the browser, so lib/o2s sends
// those requests to /o2s-api on this site and this rewrite forwards them to the API from the server.
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")

// Firebase web config: the o2s_fb_* names (the repository's GitHub Actions secrets, or the hosting's
// environment variables named the same) win; the NEXT_PUBLIC_FIREBASE_* names still work. Only these
// public web values reach the browser; the service account (o2s_fb_private_key, ...) is the backend's.
const firebase = (o2sName, publicName) => process.env[o2sName] || process.env[publicName] || ""

const nextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: firebase("o2s_fb_apiKey", "NEXT_PUBLIC_FIREBASE_API_KEY"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebase("o2s_fb_authDomain", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebase("o2s_fb_projectId", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebase("o2s_fb_storageBucket", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebase("o2s_fb_messagingSenderId", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    NEXT_PUBLIC_FIREBASE_APP_ID: firebase("o2s_fb_appId", "NEXT_PUBLIC_FIREBASE_APP_ID"),
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: firebase("o2s_fb_measurementId", "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: firebase("o2s_fb_webpushcertificates_keypair", "NEXT_PUBLIC_FIREBASE_VAPID_KEY"),
  },
  async rewrites() {
    return apiUrl ? [{ source: "/o2s-api/:path*", destination: `${apiUrl}/:path*` }] : []
  },
}

export default nextConfig
