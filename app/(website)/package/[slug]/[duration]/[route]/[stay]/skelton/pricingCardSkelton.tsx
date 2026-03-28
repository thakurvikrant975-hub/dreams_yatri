import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';
import { Skeleton } from "@/app/components/skeltons/rawShimmer";


const PricingCardSkelton = () => {
    return (
        <Card className='px-6 py-5'>
            <div className="flex items-center gap-4 mb-1.5">
                <Skeleton className="w-32 h-4 rounded-pill" />
            </div>
            <div className="flex flex-col items-baseline gap-1 mt-2.5">
                <Skeleton className="w-full h-4.5 rounded-pill" />
                <Skeleton className="w-3/4 h-4 rounded-pill" />
            </div>
            <Text size='xs' intent='secondary' className='mt-1 opacity-50'>Excluding applicable taxes</Text>
            <Button variant="premium" className="w-full mt-4 pointer-events-none opacity-50">
                Proceed To Payment
            </Button>
        </Card>
    );
};

export default PricingCardSkelton;