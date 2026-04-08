// app/(website)/package/[slug]/layout.tsx
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";

export default function PackageLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    return (
        <>
            <Header />
            <div className="py-10 screen-space">
                {children}
            </div>
            <Footer />
        </>
    );
}