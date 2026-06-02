export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { auth } from '@/app/lib/auth';
import { getBlogForEdit, getBlogCategories } from '@/app/actions/blogs/actions';
import BlogWriteForm from '@/app/components/blog/BlogWriteForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata = { title: 'Edit Blog' };

export default async function EditBlogPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { slug: id } = await params;
  const [post, categories] = await Promise.all([
    getBlogForEdit(id),
    getBlogCategories(),
  ]);

  if (!post) notFound();

  return (
    <main className="screen-space py-10 min-h-screen">
      <BlogWriteForm categories={categories} initialData={post} />
    </main>
  );
}
