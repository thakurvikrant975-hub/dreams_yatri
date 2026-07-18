import { encode } from "next-auth/jwt";

const token = await encode({
  token: {
    id: "cmra68qty000004l12jnmk6oq",
    name: "Chirag",
    email: "chirag@dreamsyatri.com",
    role: "Sales Executive",
    permissions: [],
    pageAccess: [
      "/dashboard", "/dashboard/analytics", "/sales-dashboard", "/dashboard/sales-query",
      "/dashboard/sale-analytics", "/dashboard/package-builder", "/dashboard/follow-ups",
      "/dashboard/package-library", "/dashboard/my-bookings",
    ],
    departmentId: null,
  },
  secret: process.env.AUTH_SECRET,
  salt: "dy.dashboard.session-token",
});
console.log(token);
