'use client'

import React from "react"
import { motion } from "framer-motion"
import StatItem from "@/app/components/ui/StatItem"
import { Stagger, FadeUp } from "@/app/components/ui/motion"
import { staggerItem } from "@/app/lib/motionPresets"
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
        <FadeUp once={false}>
            <section className="w-full border-b border-b-(--border-default) py-12">
                <div className="screen-space">

                    {/* Desktop */}
                    <Stagger
                        staggerDelay={0.08}
                        delayChildren={0.1}
                        once={false}
                        className="hidden lg:flex items-stretch justify-between"
                    >
                        {TRUST_ITEMS.map((item, i) => (
                            <React.Fragment key={item.label}>
                                <motion.div variants={staggerItem}>
                                    <StatItem item={item} />
                                </motion.div>
                                {i < TRUST_ITEMS.length - 1 && (
                                    <motion.div
                                        variants={staggerItem}
                                        className="self-center h-16 w-px bg-(--border-muted) shrink-0"
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </Stagger>

                    {/* Mobile / tablet */}
                    <Stagger
                        staggerDelay={0.1}
                        delayChildren={0.05}
                        once={false}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-x-8"
                    >
                        {TRUST_ITEMS.map((item, i) => (
                            <motion.div
                                key={item.label}
                                variants={staggerItem}
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
                            </motion.div>
                        ))}
                    </Stagger>

                </div>
            </section>
        </FadeUp>
    )
}