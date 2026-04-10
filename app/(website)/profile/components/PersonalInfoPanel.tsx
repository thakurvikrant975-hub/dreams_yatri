import { Section } from "./Section"
import { EditableField } from "./EditableField"

export function PersonalInfoPanel() {
  return (
    <div className="space-y-5">
      <Section title="Basic Details" subtitle="Your name and contact information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="First Name" value="Karan" placeholder="Enter first name" />
          <EditableField label="Last Name" value="Thakur" placeholder="Enter last name" />
          <EditableField label="Email Address" value="karan@dreamsyatri.com" type="email" />
          <EditableField label="Phone Number" value="+91 98765 43210" type="tel" />
          <EditableField label="Date of Birth" value="15 Aug 1995" type="text" />
          <EditableField label="City" value="Shimla, HP" placeholder="Your city" />
        </div>
      </Section>

      {/* <Section title="More Infomation" subtitle="Help us to know you more">
        <></>
      </Section> */}
    </div>
  )
}