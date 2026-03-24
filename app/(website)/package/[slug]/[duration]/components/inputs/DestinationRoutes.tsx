'use client'
import React, { useState } from 'react'
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioRoute } from "@/app/components/forms/RadioGroup";

function DestinationRoutes() {
    const [route, setRoute] = useState('shimla-manali');
    return (
        <section>
            <Heading level={3} weight='semibold'>Destination Routes</Heading>
            <RadioGroup
                value={route}
                onChange={setRoute}
                className="flex flex-col gap-2 mt-1"
            >
                <RadioRoute value="shimla-manali" stops={['Shimla', 'Manali']} />
                <RadioRoute value="shimla-chandigarh-manali" stops={['Shimla', 'Chandigarh', 'Manali']} />
            </RadioGroup>
        </section>
    )
}

export default DestinationRoutes
