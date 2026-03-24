import PackageHighlights from "./summary";

function SummaryPage() {
    return (
        <>
            <PackageHighlights
                items={[
                    {
                        kind: 'transfer',
                        data: { label: 'Airport to hotel in Goa' },
                    },
                    {
                        kind: 'stay',
                        data: {
                            destination: 'Goa',
                            nights: 3,
                            days: [
                                {
                                    day: 1,
                                    date: 'Apr 5, Sun',
                                    cells: [
                                        {
                                            type: 'checkin',
                                            text: <>Check in to <strong>Grand Continent Anjuna A Sarovar Portico Affiliate Hotel, 4 Star</strong></>,
                                        },
                                    ],
                                },
                                {
                                    day: 2,
                                    date: 'Apr 6, Mon',
                                    cells: [
                                        {
                                            type: 'meal',
                                            text: <>Day Meals: <strong>Breakfast :</strong> Included at Grand Continent Anjuna, Goa</>,
                                        },
                                    ],
                                },
                                {
                                    day: 3,
                                    date: 'Apr 7, Tue',
                                    cells: [
                                        {
                                            type: 'meal',
                                            text: <>Day Meals: <strong>Breakfast :</strong> Included at Grand Continent Anjuna, Goa</>,
                                        },
                                    ],
                                },
                                {
                                    day: 4,
                                    date: 'Apr 8, Wed',
                                    cells: [
                                        {
                                            type: 'meal',
                                            text: <>Day Meals: <strong>Breakfast :</strong> Included at Grand Continent Anjuna, Goa</>,
                                        },
                                        {
                                            type: 'checkout',
                                            text: <>Checkout from <strong>Hotel in Goa</strong></>,
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    {
                        kind: 'transfer',
                        data: { label: 'Hotel in Goa to Airport' },
                    },
                ]}
            />
        </>
    )
}

export default SummaryPage;
