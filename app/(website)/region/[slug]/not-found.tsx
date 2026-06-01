import Link from "next/link";
import { Heading, Text } from "@/app/components/ui/Typography";
import Button from "@/app/components/ui/Button";

export default function RegionNotFound() {
    return (
        <div className="screen-space py-24 flex flex-col items-center text-center">
            <Heading level={2} weight="semibold">Region not found</Heading>
            <Text size="sm" intent="secondary" className="mt-2 max-w-md">
                The region you&apos;re looking for doesn&apos;t exist or is no longer available.
            </Text>
            <Link href="/" className="mt-6">
                <Button variant="primary">Back to home</Button>
            </Link>
        </div>
    );
}
