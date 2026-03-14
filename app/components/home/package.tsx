'use client'

import React from 'react'
import { motion } from 'framer-motion'
import PackageCard, { type PackageCardProps } from '../packages/Packages'
import Button from '../ui/Button'
import { ArrowRightIcon } from '@phosphor-icons/react'
import PackageGrid from '../ui/Grid'
import SectionHeader from '../ui/SectionHeader'
import { Stagger } from '@/app/components/ui/motion'
import { staggerItem, fadeIn, fadeRight } from '@/app/lib/motionPresets'

const PACKAGES: Omit<PackageCardProps, 'onRequestCallback' | 'onClick'>[] = [
    {
        title: 'Best Manali Package For Adults And Childrens',
        images: [
            'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop',
        ],
        badge: 'Honeymoon',
        badgeColor: 'teal',
        offerTag: 'Best Offer',
        duration: '8 days & 7 nights',
        rating: 4.8,
        reviewCount: 23,
        itinerary: [
            { days: 2, place: 'Kullu' },
            { days: 1, place: 'Manali' },
            { days: 1, place: 'Ladakh' },
            { days: 2, place: 'Solang' },
            { days: 1, place: 'Vall...' },
            { days: 1, place: 'Rohtang' },
        ],
        originalPrice: 50000,
        discountedPrice: 34000,
        inclusions: ['hotel', 'meals', 'cab', 'activities'],
    },
    {
        title: 'Tour Package For Ladakh',
        images: [
            'https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=800&auto=format&fit=crop',
        ],
        badge: 'Friends',
        badgeColor: 'blue',
        duration: '8 days & 7 nights',
        rating: 4.8,
        reviewCount: 23,
        itinerary: [
            { days: 2, place: 'Kullu' },
            { days: 1, place: 'Manali' },
            { days: 1, place: 'Ladakh' },
            { days: 2, place: 'Solang' },
            { days: 1, place: 'Vall...' },
        ],
        originalPrice: 50000,
        discountedPrice: 34000,
        inclusions: ['hotel', 'meals', 'cab', 'activities'],
    },
    {
        title: 'Kashmir Tour Package',
        images: [
            'https://images.unsplash.com/photo-1614591276564-7b3e69347a48?w=800&auto=format&fit=crop',
        ],
        badge: 'Adventure',
        badgeColor: 'orange',
        duration: '8 days & 7 nights',
        rating: 4.8,
        reviewCount: 23,
        itinerary: [
            { days: 2, place: 'Kullu' },
            { days: 1, place: 'Manali' },
            { days: 1, place: 'Ladakh' },
            { days: 2, place: 'Solang' },
            { days: 1, place: 'Vall...' },
        ],
        originalPrice: 50000,
        discountedPrice: 34000,
        inclusions: ['hotel', 'meals', 'cab', 'activities'],
    },
    {
        title: 'Uttarakhand Best Package For Adults',
        images: [
            'https://images.unsplash.com/photo-1502786129293-79981df4e689?w=800&auto=format&fit=crop',
        ],
        badge: 'Holidays',
        badgeColor: 'green',
        duration: '8 days & 7 nights',
        rating: 4.8,
        reviewCount: 23,
        itinerary: [
            { days: 2, place: 'Kullu' },
            { days: 1, place: 'Manali' },
            { days: 1, place: 'Ladakh' },
            { days: 2, place: 'Solang' },
            { days: 1, place: 'Vall...' },
        ],
        originalPrice: 50000,
        discountedPrice: 34000,
        inclusions: ['hotel', 'meals', 'cab'],
    },
    {
        title: 'Rajasthan Tour Packages For Family',
        images: [
            'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&auto=format&fit=crop',
        ],
        badge: 'Luxury',
        badgeColor: 'purple',
        duration: '8 days & 7 nights',
        rating: 4.8,
        reviewCount: 23,
        itinerary: [
            { days: 2, place: 'Jaipur' },
            { days: 1, place: 'Jodhpur' },
            { days: 1, place: 'Udaipur' },
        ],
        originalPrice: 50000,
        discountedPrice: 34000,
        inclusions: ['hotel', 'meals', 'cab', 'activities'],
    },
    {
        title: 'Kerala Tour Packages For Family',
        images: [
            'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=800&auto=format&fit=crop',
        ],
        badge: undefined,
        duration: '8 days & 7 nights',
        rating: 4.8,
        reviewCount: 23,
        itinerary: [
            { days: 2, place: 'Kochi' },
            { days: 2, place: 'Munnar' },
            { days: 2, place: 'Alleppey' },
        ],
        originalPrice: 50000,
        discountedPrice: 34000,
        inclusions: ['hotel', 'meals', 'cab', 'activities'],
    },
]

interface TrendingPackagesProps {
    packages?: typeof PACKAGES
    onRequestCallback?: (title: string) => void
    onViewAll?: () => void
}

export default function TrendingPackages({
    packages = PACKAGES,
    onRequestCallback,
    onViewAll,
}: TrendingPackagesProps) {
    return (
        <section className="w-full py-section">
            <div className="screen-space">

                {/* ── Section header + View All button ── */}
                <div className="flex items-end justify-between mb-6">
                    {/* SectionHeader already has its own internal animations */}
                    <SectionHeader
                        tag='Handpicked For You'
                        title='Trending Experiences'
                        subtitle='Curated packages designed around your travel style'
                    />

                    <motion.div
                        variants={fadeRight}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: false, amount: 0.3 }}
                        className="hidden sm:block shrink-0"
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1.5 text-primary-500 hover:text-primary-600 font-semibold"
                            onClick={onViewAll}
                        >
                            View All
                            <ArrowRightIcon className="size-4" weight="bold" />
                        </Button>
                    </motion.div>
                </div>

                {/* ── Divider ── */}
                <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, amount: 0.5 }}
                    className="h-px w-full bg-(--border-muted) mb-8"
                />

                {/* ── Package grid — staggered cards ── */}
                <Stagger
                    staggerDelay={0.3}
                    delayChildren={0.2}
                    once={false}
                >
                    <PackageGrid>
                        {packages.map((pkg) => (
                            <motion.div key={pkg.title} variants={staggerItem}>
                                <PackageCard
                                    {...pkg}
                                    onRequestCallback={() => onRequestCallback?.(pkg.title)}
                                />
                            </motion.div>
                        ))}
                    </PackageGrid>
                </Stagger>

                {/* ── View All — mobile ── */}
                <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, amount: 0.5 }}
                    className="flex justify-center mt-8 sm:hidden"
                >
                    <Button
                        variant="outline"
                        size="md"
                        className="gap-2"
                        onClick={onViewAll}
                    >
                        View All Packages
                        <ArrowRightIcon className="size-4" weight="bold" />
                    </Button>
                </motion.div>

            </div>
        </section>
    )
}