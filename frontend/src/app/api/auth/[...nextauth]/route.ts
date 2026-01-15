import NextAuth, { NextAuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
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
      // Include GitHub user ID in session for secure session ID generation
      if (token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      // Persist the GitHub user ID to the token
      if (account && profile) {
        token.sub = (profile as any).id?.toString() || account.providerAccountId;
      }
      return token;
    },
  },
  // Suppress warnings for NEXTAUTH_URL if not set (for local development)
  debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
