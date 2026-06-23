import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/quotes/:path*',
    '/approvals/:path*',
    '/admin/:path*',
  ],
};
