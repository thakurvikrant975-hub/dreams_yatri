// 'use client'
// import { useState } from "react"
// import Label from "@/app/components/forms/Label"
// import Input from "@/app/components/forms/Input"

// export function EditableField({
//   label,
//   value,
//   type = 'text',
//   placeholder,
// }: {
//   label: string
//   value: string
//   type?: string
//   placeholder?: string
// }) {

//   const [val, setVal] = useState(value)

//   return (
//     <div className="group">
//       <Label htmlFor={label}>{label}</Label>
//       <div className="flex items-center gap-2 mt-1">
//         <Input
//           id={label}
//           type={type}
//           value={val}
//           onChange={(e) => setVal(e.target.value)}
//           size="md"
//           wrapperClassName='flex-1'
//           autoFocus
//         />
//       </div>
//     </div>
//   )
// }


// app/(website)/profile/components/EditableField.tsx

'use client'

import Input from "@/app/components/forms/Input";
import Label from "@/app/components/forms/Label";

interface Props {
  label:       string;
  value:       string;
  onChange:    (val: string) => void;
  type?:       string;
  placeholder?: string;
}

export function EditableField({ label, value, onChange, type = "text", placeholder }: Props) {
  return (
    <div>
      <Label htmlFor={label}>{label}</Label>
      <Input
        id={label}
        type={type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        size="md"
        wrapperClassName="mt-1"
      />
    </div>
  );
}