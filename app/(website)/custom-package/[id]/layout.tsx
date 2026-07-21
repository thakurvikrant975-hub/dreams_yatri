import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";

export default function CustomPackageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Header sticky={false} />
            <div>
                {children}
            </div>
            <Footer />
        </>
    );
}
