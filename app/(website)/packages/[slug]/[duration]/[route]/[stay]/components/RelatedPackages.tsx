import { fetchRelatedPackages } from '@/app/actions/packages/fetch-page-data'
import PackageGrid from '@/app/components/packages/PackageGrid'
import { Heading } from '@/app/components/ui/Typography'
import RelatedPackageCard from './RelatedPackageCard'

interface Props {
    currentPackageId: number
    destinationId: number
}

export default async function RelatedPackages({ currentPackageId, destinationId }: Props) {
    const packages = await fetchRelatedPackages(currentPackageId, destinationId)
    if (packages.length === 0) return null

    return (
        <section className="screen-space ">
            <Heading level={2} weight="semibold" className="mb-6">
                Related Packages
            </Heading>
            <PackageGrid>
                {packages.map((pkg) => (
                    <RelatedPackageCard
                        key={pkg.id}
                        href={`/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`}
                        title={pkg.title}
                        images={pkg.images}
                        duration={pkg.duration}
                        rating={4.5}
                        reviewCount={0}
                        itinerary={pkg.itinerary}
                        originalPrice={pkg.originalPrice}
                        discountedPrice={pkg.discountedPrice}
                        inclusions={['hotel', 'meals', 'cab', 'activities']}
                    />
                ))}
            </PackageGrid>
        </section>
    )
}
