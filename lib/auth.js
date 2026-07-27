import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

export const authOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Tên đăng nhập', type: 'text' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { username: credentials.username } });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name, username: user.username, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id       = token.id;
      session.user.username = token.username;
      session.user.name     = token.name;
      // Luôn lấy role mới nhất từ DB để phản ánh thay đổi phân quyền ngay lập tức,
      // không cần user đăng xuất / đăng nhập lại.
      try {
        const dbUser = await prisma.user.findUnique({
          where:  { id: token.id },
          select: { role: true, name: true },
        });
        session.user.role = dbUser?.role ?? token.role;
        session.user.name = dbUser?.name ?? token.name;
      } catch {
        session.user.role = token.role;
      }
      return session;
    },
  },
};
