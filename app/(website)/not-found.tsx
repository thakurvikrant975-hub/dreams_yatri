// Renders when notFound() is called
import Link from "next/link";

export default function PackageNotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold">Page Not Found</h1>
      <p className="text-gray-500">
        The page you are looking for does not exist or has been removed.
      </p>
      <Link href="/packages" className="text-blue-600 underline">
        Browse all packages
      </Link>
    </main>
  );
}