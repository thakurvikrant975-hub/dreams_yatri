interface Coupon {
    code: string;
    discount: number;
    description: string;
    applied: boolean;
}

interface PricingCardProps {
    originalPrice: number;
    discountedPrice: number;
    savings: number;
    packageName: string;
    className?: string;
}

interface CoupenCardProps {
    coupons?: Coupon[];
}

interface EnquiryFormProps {
    discountedPrice: number;
    packageName: string;
    savings: number;
}