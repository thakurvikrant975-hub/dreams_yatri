import { encode } from "next-auth/jwt";

const token = await encode({
  token: {
    id: "cmr3crmh3000g04jy84883f8v",
    name: "Pooja",
    email: "pooja@dreamsyatri.com",
    role: "Travel Expert",
    permissions: [],
    pageAccess: [
      "/dashboard", "/dashboard/regions", "/dashboard/destinations", "/dashboard/categories",
      "/dashboard/policies", "/dashboard/activities", "/dashboard/activities/categories",
      "/dashboard/packages", "/dashboard/package-bookings", "/dashboard/hotels",
    ],
    departmentId: null,
  },
  secret: process.env.AUTH_SECRET,
  salt: "dy.dashboard.session-token",
});
console.log(token);
