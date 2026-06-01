'use client'

import React from "react"
import StatItem from "@/app/components/ui/StatItem"
import { StatItemI } from "@/app/types/components/ui/StatItem"
import { AirplaneTiltIcon, MapPinIcon, VanIcon, StarIcon } from "@phosphor-icons/react"

const TRUST_ITEMS: StatItemI[] = [
    { icon: AirplaneTiltIcon, label: 'Happy Travelers',      value: '10,000 +' },
    { icon: MapPinIcon,       label: 'Destinations Covered', value: '500 +'    },
    { icon: VanIcon,          label: 'Customizable Trips',   value: '100%'     },
    { icon: StarIcon,         label: 'Google Rating',        value: '4.8'      },
]

export default function TrustSignals() {
    return (
        <section className="w-full border-b border-b-(--border-default) py-12">
            <div className="screen-space">

                {/* Desktop */}
                <div className="hidden lg:flex items-stretch justify-between">
                    {TRUST_ITEMS.map((item, i) => (
                        <React.Fragment key={item.label}>
                            <div>
                                <StatItem item={item} />
                            </div>
                            {i < TRUST_ITEMS.length - 1 && (
                                <div className="self-center h-16 w-px bg-(--border-muted) shrink-0" />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Mobile / tablet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-x-8">
                    {TRUST_ITEMS.map((item, i) => (
                        <div
                            key={item.label}
                            className={[
                                i < TRUST_ITEMS.length - 1 ? 'border-b' : '',
                                i >= TRUST_ITEMS.length - (TRUST_ITEMS.length % 2 === 0 ? 2 : 1)
                                    ? 'sm:border-b-0'
                                    : '',
                                i === TRUST_ITEMS.length - 1 && TRUST_ITEMS.length % 2 !== 0
                                    ? 'sm:col-span-2'
                                    : '',
                                'border-(--border-muted)',
                            ].join(' ')}
                        >
                            <StatItem item={item} fullWidth />
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}