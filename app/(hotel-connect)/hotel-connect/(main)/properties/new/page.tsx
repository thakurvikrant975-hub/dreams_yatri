import ConnectHeader from "../../components/ConnectHeader";
import PropertyTypeSelector from "./PropertyTypeSelector";

export default function NewPropertyPage() {
  return (
    <>
      <ConnectHeader title="New Property" />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight mb-1.5">
            What type of property would you like to list?
          </h1>
          <p className="text-sm text-neutral-500">
            Choose the option that best describes your property. You can always refine details later.
          </p>
        </div>

        <PropertyTypeSelector />
      </div>
    </>
  );
}
