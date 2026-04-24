import React from "react";
import Accordion from "@/app/components/ui/Accordian";

const Page = () => {
  return (
    <div className="bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        
        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last updated: April 2026
        </p>

        {/* Content */}
        <div className="space-y-6 text-gray-700 leading-relaxed">
          
          <section>
            <h2 className="text-xl font-semibold mb-2">
              1. Information We Collect
            </h2>
            <p>
              Lorem ipsum, dolor sit amet consectetur adipisicing elit. Numquam autem porro voluptates repellat fugiat saepe natus rerum. Dolorum obcaecati atque illum eligendi, sint praesentium, officiis aperiam sapiente nulla, facilis vitae!
            </p>
            <p className="mt-6">Lorem ipsum dolor sit amet consectetur adipisicing elit. Illo voluptatum accusantium ex magni, sapiente beatae delectus nulla temporibus, quos quasi ipsa impedit sit animi similique magnam culpa cupiditate nostrum numquam.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              Lorem ipsum
            </h2>
            <p>
              Lorem ipsum, dolor sit amet consectetur adipisicing elit. Possimus tempora maxime iste expedita! Iste blanditiis, dolor obcaecati beatae natus, quo deserunt quasi voluptate provident, saepe nisi repudiandae in reiciendis sit?
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              lorem
            </h2>
            <p>
              Lorem, ipsum dolor sit amet consectetur adipisicing elit. Nam natus, nostrum, recusandae minus quo commodi voluptatum porro, officia in reiciendis sequi corrupti! Officiis alias, laborum veniam dolore voluptatum voluptatem vel?
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              4. Cookies
            </h2>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Eum recusandae consectetur quidem repudiandae magnam? Eum, ad? Nostrum nisi consequatur minus alias fuga expedita aut doloremque reiciendis, sequi laborum aspernatur dolores?
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              5. Contact Us
            </h2>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Esse sint voluptate enim placeat ex dolores doloremque fugit tempore perferendis odio nobis voluptas omnis labore ipsam distinctio quia, nesciunt possimus veniam.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Page;