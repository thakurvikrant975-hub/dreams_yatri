"use client";

import { useState } from "react";
import { Heading, Text } from "../ui/Typography";
import Button from "../ui/Button";
import { ArrowRightIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { MicrophoneIcon } from "@heroicons/react/24/solid";
import NeuralNetworkBackground from "../ui/Neuralnetworkbackground";

const chatMessages = [
  {
    role: "user",
    text: "Plan a 7-day honeymoon in Himachal under ₹50,000.",
  },
  {
    role: "bot",
    text: (
      <>
        Perfect! <span className="text-primary-500 font-semibold">found 3 amazing options</span> for your budget
      </>
    ),
    packages: [
      {
        title: 'Shimla Manali Romantic Escape',
        price: '₹45,999'
      },
      {
        title: 'Dharamshala-Dalhousie Bliss',
        price: '₹42,500'
      },
      {
        title: 'Kasol-Tosh Mountain Retreat',
        price: '₹38,900'
      }
    ]
  },
];

export default function AvantiAISection() {

  const [inputValue, setInputValue] = useState('');


  return (
    <section className="bg-surface-inverse py-section relative overflow-hidden">
      <NeuralNetworkBackground />
      <div className="screen-space grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10 pointer-events-none">

        {/* Left Content */}
        <div className="space-y-8">
          {/* Badge */}
          <div className="relative z-10 after:absolute  after:inset-0 after:-z-10 after:rounded-full after:bg-secondary-200/75 after:opacity-50 after:blur-xl hover:after:opacity-70  w-max px-3">
            <div className="bg-gradient text-transparent bg-clip-text text-base font-semibold font-heading">
              AI Powered Planning
            </div>
          </div>

          {/* Heading */}
          <Heading level={2} intent='inverse'>
            Plan Smarter with{" "} <br />
            <span className="text-primary-100">Avanti AI</span>
          </Heading>

          {/* Subtext */}
          <Text size='base' className="text-neutral-400">
            Tell us your dream. Avanti builds it — instantly, intelligently,
            exactly how you want it.
          </Text>

          {/* Feature List */}
          <ul className="space-y-3">
            {[
              "Personalized itineraries in under 30 seconds",
              "Budget-aware package recommendations",
              "Real-time availability & expert refinement",
              "Connects directly to our travel team",
            ].map((item) => (
              <Text as='li' size='sm' key={item} className="flex items-center gap-3 text-neutral-300">
                <span className="size-1.5 rounded-full bg-primary-400 shrink-0" />
                {item}
              </Text>
            ))}
          </ul>

          {/* CTA Button */}
          <Button variant='premium'>
            Chat With Avanti
          </Button>
        </div>

        {/* Right: Chat UI */}
        <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">

            {/* Chat Header */}
            <div className="bg-neutral-900 px-5 py-4 flex items-center gap-3 border-b">
              <div className="size-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm shrink-0 ring-1 ring-offset-2 ring-offset-neutral-900 ring-primary-400">
                A
              </div>
              <div className="flex-1">
                <Text size='base' intent='inverse' weight='semibold' className="font-heading">Avanti AI</Text>
                <Text size='xs' className="text-neutral-300">Dreams Yatri Travel Assistant</Text>
              </div>
              <div className="relative top-1/2 block size-2.5 bg-success-500 rounded-full animate-pulse-ring hover:animate-none" />
            </div>

            {/* Chat Body */}
            <div className="px-5 py-5 space-y-4 min-h-70">

              {/* User Message */}
              <div className="flex justify-end animate-fade-in">
                <div className="bg-primary-500 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] leading-relaxed">
                  {chatMessages[0].text}
                </div>
              </div>



              {/* Bot Message */}
              <div className="flex justify-start animate-fade-in">
                <div className="bg-neutral-100 text-sm rounded-3xl rounded-tl-md px-4 py-4 max-w-[85%] leading-relaxed shadow-md shadow-gray-200/80">
                  <Text size='sm' weight='normal'>{chatMessages[1].text}</Text>
                  <ul className="mt-3 flex flex-col gap-2">
                    {
                      chatMessages[1].packages?.map((item, index) => (
                        <li key={index} className="bg-white py-2.5 px-3.5 rounded-xl shadow-md shadow-neutral-200  ring-1 ring-inset ring-neutral-200 flex items-center">
                          <span className="flex-1 block space-y-0.5">
                            <Text size='xs' weight='semibold' className="font-heading">{item.title}</Text>
                            <Text size='sm' weight='bold' intent='brand' className="font-heading">{item.price}</Text>
                          </span>
                          <ArrowRightIcon weight="fill" className="size-4.5 text-brand" />
                        </li>
                      ))
                    }
                  </ul>

                </div>
              </div>

            </div>

            {/* Chat Input */}
            <div className="px-4 py-4 border-t bg-neutral-50 border-default">
              <div className="flex items-center gap-2 bg-white rounded-xl ">
                <div className="ring-1 ring-inset ring-(--border-muted) flex-1 py-2.5 px-3 rounded-input flex items-center">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Tell Avanti your dream trip..."
                    className="flex-1 text-sm text-neutral-700 placeholder-(--text-muted) bg-transparent outline-none"
                    readOnly
                  />
                  {/* Mic Icon */}
                  <button className="text-secondary transition-colors">
                    <MicrophoneIcon className="size-4" />
                  </button>
                </div>
                {/* Send Button */}
                <Button variant='premium' size='auto' className="p-2.5 rounded-lg pointer-events-none">
                  <PaperPlaneTiltIcon weight="fill" className="size-4" />
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}