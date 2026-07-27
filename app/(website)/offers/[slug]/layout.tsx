import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";

// Same Header/Footer every other public page uses (see custom-package/[id]/
// layout.tsx, packages/[slug]/layout.tsx) — transparent to match how the
// homepage treats its own big hero image (HomeClient.tsx), turning solid on
// scroll via Header's own scroll listener.
export default function OfferLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header transparent />
      <div>{children}</div>
      <Footer />
    </>
  );
}
