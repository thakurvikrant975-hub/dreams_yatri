// // app/(website)/packages/[slug]/page.tsx
// import { Metadata } from "next";
// import { packageSchema, breadcrumbSchema } from "./schema";
// import SchemaScript from "@/app/components/seo/SchemaScript";
// import { getPackageBySlug } from "@/lib/db/packages";
// import { SITE_CONFIG } from "./site-config";

// type Props = { params: { slug: string } };

// export async function generateMetadata({ params }: Props): Promise<Metadata> {
//   const pkg = await getPackageBySlug(params.slug);

//   return {
//     title: pkg.name,
//     description: pkg.seoDescription ?? pkg.description.slice(0, 160),
//     alternates: { canonical: `/packages/${pkg.slug}` },
//     openGraph: {
//       title: `${pkg.name} | DreamsYatri`,
//       description: pkg.seoDescription ?? pkg.description.slice(0, 160),
//       url: `/packages/${pkg.slug}`,
//       type: "website",
//       // opengraph-image.tsx auto-generates the image
//     },
//   };
// }

// export default async function PackagePage({ params }: Props) {
//   const pkg = await getPackageBySlug(params.slug);

//   return (
//     <>
//       <SchemaScript
//         data={[
//           packageSchema({
//             name: pkg.name,
//             slug: pkg.slug,
//             description: pkg.description,
//             image: pkg.images,
//             price: pkg.price,
//             duration: pkg.duration,
//             destination: pkg.destination,
//             rating: pkg.rating,
//             reviewCount: pkg.reviewCount,
//           }),
//           breadcrumbSchema([
//             { name: "Home", url: "/" },
//             { name: "Packages", url: "/packages" },
//             { name: pkg.destination, url: `/packages?destination=${pkg.destination}` },
//             { name: pkg.name, url: `/packages/${pkg.slug}` },
//           ]),
//         ]}
//       />
//       {/* page content */}
//     </>
//   );
// }