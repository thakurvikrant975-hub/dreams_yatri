'use client';

import { useState } from "react";
import { RadioGroup, RadioImageCard, RadioRoute, RadioPill } from "@/app/components/forms/RadioGroup";
import ItinerarySection from "./components/Itnary";
import { Heading } from "@/app/components/ui/Typography";

export default function Page() {
    const [duration, setDuration] = useState('7');
    const [route, setRoute] = useState('shimla-manali');
    const [stay, setStay] = useState('delux');

    return (
        <div className="flex flex-col gap-8 p-6">

            {/* Trip Duration */}
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

            {/* Destination Routes */}
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

            {/* Stay Category */}
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

            <ItinerarySection days={[
                {
                    day: 1,
                    title: 'Arrival In Shimla | Day In New Shimla',
                    description: 'Today, board your transfer to explore...',
                    sections: [
                        {
                            type: 'flight',
                            from: {
                                label: 'From :',
                                value: 'Your Nearest Airport',
                                note: 'Please Note: Reach to your nearest airport at your own',
                                noteVariant: 'red',
                            },
                            to: {
                                label: 'To :',
                                value: 'Shimla Airport',
                                notePill: {
                                    text: 'Option by Bus or Cab is also available.',
                                    linkText: 'Check Now',
                                    linkVariant: 'red',
                                },
                            },
                        },
                        {
                            type: 'cab',
                            subtitle: 'Transfer to oberoi hotel',
                            from: {
                                label: 'From :',
                                value: 'Shimla Airport',
                                note: 'Discount: You will get discount for first cab',
                                noteVariant: 'green',
                            },
                            to: {
                                label: 'To :',
                                value: 'Oberoi Hotel Shimla',
                                notePill: {
                                    text: 'Room no. is not assigned, it will be generated by hotel on arrival.',
                                    linkText: 'Know More',
                                    linkVariant: 'blue',
                                },
                            },
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
                                { label: 'Lunch', status: 'excluded' },
                                { label: 'Dinner', status: 'included' },
                            ],
                            images: [
                                'https://images.unsplash.com/photo-1600011689032-8b628b8a8747?w=600',
                                'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=300',
                                'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=300',
                                'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=300',
                                'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=300',
                            ],
                        },
                    ],
                },
            ]} />

        </div>
    );
}