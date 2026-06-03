export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/app/lib/auth';
import { getMyBlogs } from '@/app/actions/blogs/actions';
import MyBlogsClient from './MyBlogsClient';

export const metadata = { title: 'My Blogs' };

export default async function MyBlogsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const posts = await getMyBlogs();

  return (
    <main className="screen-space py-10 min-h-screen">
      <MyBlogsClient initialPosts={posts} />
    </main>
  );
}
