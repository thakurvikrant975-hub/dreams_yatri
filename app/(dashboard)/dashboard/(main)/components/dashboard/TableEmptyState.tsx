import Image from "next/image";

interface TableEmptyStateProps {
    imageSrc?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageAlt?: string;
    title?: string;
    description?: string;
}

export const TableEmptyState = ({
    imageSrc = "/dashboard/not-found.png",
    imageWidth = 132,
    imageHeight = 132,
    imageAlt = "No data found",
    title = "No queries found",
    description = "No queries found — go scroll some reels 😄",
}: TableEmptyStateProps) => {
    return (
        <div className="flex flex-col items-center gap-2">
            <Image
                width={imageWidth}
                height={imageHeight}
                src={imageSrc}
                alt={imageAlt}
            />
            <p className="text-sm font-semibold text-dashboard-base-content">{title}</p>
            <p className="text-xs text-dashboard-base-content">{description}</p>
        </div>
    );
};