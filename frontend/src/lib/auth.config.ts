import { NextAuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async session({ session, token }) {
      // Include user ID in session for secure session ID generation
      if (token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      // Persist the user ID to the token (works for both GitHub and Google)
      if (account && profile) {
        const profileWithId = profile as { id?: number | string; sub?: string };
        // GitHub uses profile.id, Google uses profile.sub
        token.sub = profileWithId.id?.toString() || profileWithId.sub || account.providerAccountId;
      }
      return token;
    },
  },
  // Suppress warnings for NEXTAUTH_URL if not set (for local development)
  debug: process.env.NODE_ENV === 'development',
}

