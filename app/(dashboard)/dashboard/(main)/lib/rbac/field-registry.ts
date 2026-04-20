// app/lib/rbac/field-registry.ts
export const FIELD_REGISTRY: Record<string, { key: string; label: string; sensitive?: boolean }[]> = {
  destinations: [
    { key: "name",        label: "Name" },
    { key: "slug",        label: "Slug" },
    { key: "country",     label: "Country" },
    { key: "region",      label: "Region" },
    { key: "thumbnail",   label: "Thumbnail" },
    { key: "cover_image", label: "Cover Image" },
    { key: "status",      label: "Status" },
    { key: "created_at",  label: "Added" },
    // add actions column separately — it's not a data field
  ],
  hotels: [
    { key: "name",           label: "Hotel Name" },
    { key: "location",       label: "Location" },
    { key: "category",       label: "Category" },
    { key: "price",          label: "Price/Night" },
    { key: "commission",     label: "Commission %",   sensitive: true },
    { key: "internal_code",  label: "Internal Code",  sensitive: true },
  ],
  team_members: [
    { key: "name",         label: "Name" },
    { key: "email",        label: "Email" },
    { key: "department",   label: "Department" },
    { key: "role",         label: "Role" },
    { key: "salary",       label: "Salary",      sensitive: true },
    { key: "joining_date", label: "Joining Date" },
    { key: "status",       label: "Status" },
  ],
};