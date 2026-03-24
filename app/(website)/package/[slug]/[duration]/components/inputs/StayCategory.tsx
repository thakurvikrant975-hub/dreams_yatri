'use client'
import  { useState } from 'react'
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioPill } from "@/app/components/forms/RadioGroup";

function StayCategory() {
    const [stay, setStay] = useState('delux');
    return (
        <section>
            <Heading level={3} weight='semibold'>Stay Category</Heading>
            <RadioGroup
                value={stay}
                onChange={setStay}
                className="flex flex-row gap-2.5 mt-1"
            >
                <RadioPill value="delux">Delux</RadioPill>
                <RadioPill value="luxury">Luxury</RadioPill>
            </RadioGroup>
        </section>
    )
}

export default StayCategory
