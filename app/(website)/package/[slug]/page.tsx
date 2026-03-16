'use client';

import { useState } from "react";
import { RadioGroup, RadioImageCard, RadioRoute, RadioPill } from "@/app/components/forms/RadioGroup";
import ItinerarySection from "./components/Itnary";

export default function Page() {
    const [duration, setDuration] = useState('7');
    const [route, setRoute] = useState('shimla-manali');
    const [stay, setStay] = useState('delux');

    return (
        <div className="flex flex-col gap-8 p-6 max-w-2xl">

            {/* Trip Duration */}
            <section>
                <h2 className="text-xl font-semibold text-primary mb-4">Choose Trip Duration</h2>
                <RadioGroup
                    value={duration}
                    onChange={setDuration}
                    className="flex flex-row gap-2.5 overflow-x-auto pb-1"
                >
                    <RadioImageCard value="5" label="5 Days" image="https://images.unsplash.com/photo-1621494926238-2ff657276ca3?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWFuYWxpfGVufDB8MnwwfHx8MA%3D%3D" price="₹1,80,000" />
                    <RadioImageCard value="6" label="6 Days" image="https://images.unsplash.com/photo-1657687917655-20d143b844f0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fG1hbmFsaXxlbnwwfDJ8MHx8fDA%3D" price="₹2,00,000" />
                    <RadioImageCard value="7" label="7 Days" image="https://images.unsplash.com/photo-1745302874687-8c75c345d5db?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8c2hpbWxhfGVufDB8MnwwfHx8MA%3D%3D" price="₹2,50,000" />
                    <RadioImageCard value="8" label="8 Days" image="https://images.unsplash.com/photo-1629693725821-f7acab0438c3?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8c2hpbWxhfGVufDB8MnwwfHx8MA%3D%3D" price="₹3,00,000" />
                    <RadioImageCard value="9" label="9 Days" image="https://media.istockphoto.com/id/532959840/photo/gulmarg-high-peaks.webp?a=1&b=1&s=612x612&w=0&k=20&c=s5lbs26Hlh5-6R19NOUiDKi7IJdlZZYa3vSHMHuqR3A=" price="₹4,00,000" />
                </RadioGroup>
            </section>

            {/* Destination Routes */}
            <section>
                <h2 className="text-xl font-semibold text-primary mb-4">Destination Routes</h2>
                <RadioGroup
                    value={route}
                    onChange={setRoute}
                    className="flex flex-col gap-2"
                >
                    <RadioRoute value="shimla-manali" stops={['Shimla', 'Manali']} />
                    <RadioRoute value="shimla-chandigarh-manali" stops={['Shimla', 'Chandigarh', 'Manali']} />
                </RadioGroup>
            </section>

            {/* Stay Category */}
            <section>
                <h2 className="text-xl font-semibold text-primary mb-4">Stay Category</h2>
                <RadioGroup
                    value={stay}
                    onChange={setStay}
                    className="flex flex-row gap-2.5"
                >
                    <RadioPill value="delux">Delux</RadioPill>
                    <RadioPill value="luxury">Luxury</RadioPill>
                </RadioGroup>
            </section>

            <ItinerarySection days={[
                {
                    day: 1,
                    title: 'Arrival In Shimla | Day In New Shimla',
                    description: 'Today, board your transfer...',
                    sections: [
                        {
                            type: 'flight',
                            from: { label: 'From :', value: 'Your Nearest Airport', note: 'Please Note: Reach to your nearest airport at your own', noteVariant: 'red' },
                            to: { label: 'To :', value: 'Shimla Airport', note: 'Option by Bus or Cab is also available. Check Now', noteVariant: 'gray' },
                        },
                        {
                            type: 'cab',
                            subtitle: 'Transfer to oberoi hotel',
                            from: { label: 'From :', value: 'Shimla Airport', note: 'Discount: You will get discount for first cab', noteVariant: 'green' },
                            to: { label: 'To :', value: 'Oberoi Hotel Shimla', note: 'Room no. is not assigned, Know More', noteVariant: 'gray' },
                        },
                        {
                            type: 'stay',
                            nights: 3,
                            hotelName: 'Oberoi Hotel Shimla',
                            stars: 5,
                            checkIn: '2:00 PM',
                            checkOut: '11:00 AM',
                            inclusions: [
                                { label: 'Breakfast', status: 'included' },
                                { label: 'Lunch', status: 'included' },
                                { label: 'Dinner', status: 'excluded' },
                            ],
                            images: ['/img/hotel1.jpg', '/img/hotel2.jpg', '/img/hotel3.jpg', '/img/hotel4.jpg', '/img/hotel5.jpg'],
                        },
                    ],
                },
            ]} />

        </div>
    );
}