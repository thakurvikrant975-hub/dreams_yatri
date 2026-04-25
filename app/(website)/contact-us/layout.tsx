// app/(website)/package/[slug]/layout.tsx
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";

export default function PackageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // No data fetching here
    // No slug needed — just wraps with Header + Footer
    return (
        <>
            <Header />
            <div className="py-0 ">
                {children}
            </div>
            <Footer />
        </>
    );
}