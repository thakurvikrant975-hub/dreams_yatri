export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@/app/lib/auth';
import { getBlogCategories } from '@/app/actions/blogs/actions';
import BlogWriteForm from '@/app/components/blog/BlogWriteForm';

export const metadata = { title: 'Write a Blog' };

export default async function WriteBlogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const categories = await getBlogCategories();

  return (
    <main className="screen-space py-10 min-h-screen">
      <BlogWriteForm categories={categories} initialData={null} />
    </main>
  );
}
