import PackageHero from "./components/hero";
import Header from "@/app/components/navigation/Header";
import PackageTab from "./components/PackageTab";
import PricingCard from "./components/SidebardCards/PricingCard";
import CoupenCard from "./components/SidebardCards/CoupenCard";
import EnquiryForm from "./components/SidebardCards/EnquiryForm";
import Footer from "@/app/components/navigation/Footer";

export default async function WebsiteLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    return (
        <>
            <div className="mx-auto">
                <Header />
                
                <PackageHero
                    title="Shimla Manali Tour Package With Scenic Views"
                    duration="7D/6N"
                    itinerary={[
                        { days: 3, place: 'Shimla' },
                        { days: 4, place: 'Manali' },
                    ]}
                    inclusions={[
                        { key: 'transfer', label: 'Transfer' },
                        { key: 'stay', label: 'Stay' },
                        { key: 'breakfast', label: 'Breakfast' },
                        { key: 'sightseeing', label: 'Sightseeing' },
                    ]}
                    images={[
                        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&fit=crop',
                        'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400&fit=crop',
                        'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&fit=crop',
                        'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&fit=crop',
                        'https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=400&fit=crop',
                    ]}
                />

                <div className="flex gap-10 py-section-sm screen-space">
                    <div className=" flex-1">
                        <PackageTab slug={slug} />
                        {children}
                    </div>


                    <aside className="sticky top-(--header-height)  w-[27%]">
                        <div className="flex flex-col gap-3">
                            <PricingCard
                                originalPrice={300000}
                                discountedPrice={250000}
                                savings={50000}
                                packageName="Shimla Manali Tour Package With Scenic..."
                            />
                            <CoupenCard
                                coupons={[
                                    { code: 'MH45DREAM', discount: 2000, description: 'Coupon applied successfully', applied: true },
                                    { code: 'TH43MK982', discount: 2000, description: 'Get Discount Before it disappear', applied: false },
                                ]}
                            />
                            <EnquiryForm
                                discountedPrice={250000}
                                savings={50000}
                                packageName="Shimla Manali Tour Package With Scenic..."
                            />
                        </div>
                    </aside>
                </div>

                <Footer />

            </div>
        </>
    );
}