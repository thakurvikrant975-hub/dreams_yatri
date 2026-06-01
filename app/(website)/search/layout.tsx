import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            {children}
            <Footer />
        </>
    );
}
