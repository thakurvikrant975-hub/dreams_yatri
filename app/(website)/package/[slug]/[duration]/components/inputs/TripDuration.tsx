'use client'
import  {useState} from 'react';
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioImageCard } from '@/app/components/forms/RadioGroup';


function TripDuration() {
    const [duration, setDuration] = useState('7');
    return (
        <section>
            <Heading level={3} weight='semibold'>Choose Trip Duration</Heading>

            <RadioGroup
                value={duration}
                onChange={setDuration}
                className="flex flex-row gap-3 overflow-x-auto py-3 px-2 pb-1 mt-1"
            >
                <RadioImageCard value="5" label="5 Days" image="https://images.unsplash.com/photo-1621494926238-2ff657276ca3?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWFuYWxpfGVufDB8MnwwfHx8MA%3D%3D" price="₹1,80,000" />
                <RadioImageCard value="6" label="6 Days" image="https://images.unsplash.com/photo-1657687917655-20d143b844f0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fG1hbmFsaXxlbnwwfDJ8MHx8fDA%3D" price="₹2,00,000" />
                <RadioImageCard value="7" label="7 Days" image="https://images.unsplash.com/photo-1745302874687-8c75c345d5db?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8c2hpbWxhfGVufDB8MnwwfHx8MA%3D%3D" price="₹2,50,000" />
                <RadioImageCard value="8" label="8 Days" image="https://images.unsplash.com/photo-1629693725821-f7acab0438c3?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8c2hpbWxhfGVufDB8MnwwfHx8MA%3D%3D" price="₹3,00,000" />
                <RadioImageCard value="9" label="9 Days" image="https://media.istockphoto.com/id/532959840/photo/gulmarg-high-peaks.webp?a=1&b=1&s=612x612&w=0&k=20&c=s5lbs26Hlh5-6R19NOUiDKi7IJdlZZYa3vSHMHuqR3A=" price="₹4,00,000" />
            </RadioGroup>
        </section>
    )
}

export default TripDuration
