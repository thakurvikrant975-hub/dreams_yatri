import "./env.mjs";
import { encode } from "next-auth/jwt";
import type { Cookie } from "@playwright/test";
import { getDb } from "./db.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DOMAIN = new URL(BASE_URL).hostname;

/** Auth.js v5 default (non-secure, dev/CI-over-http) session cookie name. */
const CUSTOMER_COOKIE = "authjs.session-token";
const DASHBOARD_COOKIE = "dy.dashboard.session-token";
const HOTEL_CONNECT_COOKIE = "dy.hotel-connect.session-token";

const E2E_ROLE_NAME = "E2E Automation";
const E2E_MEMBER_EMAIL = "e2e-automation@dreamsyatri.internal";
const E2E_OWNER_EMAIL = "e2e-owner@dreamsyatri.internal";
const E2E_CUSTOMER_PHONE = "+910000000000";

function makeCookie(name: string, value: string, path: string): Cookie {
    return {
        name,
        value,
        domain: DOMAIN,
        path,
        httpOnly: true,
        secure: false,
        sameSite: "Strict",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };
}

/** Idempotent — creates (or reuses) a dashboard TeamMember with full,
 * unrestricted page access (empty pageAccess = no restriction, per
 * app/(dashboard)/dashboard/(main)/layout.tsx) purely for E2E auth. */
export async function ensureDashboardMember() {
    const db = await getDb();
    const role = await db.teamRole.upsert({
        where: { name: E2E_ROLE_NAME },
        update: {},
        create: { name: E2E_ROLE_NAME, permissions: [], pageAccess: [] },
    });
    const member = await db.teamMember.upsert({
        where: { email: E2E_MEMBER_EMAIL },
        update: { isActive: true, teamRoleId: role.id },
        create: {
            name: "E2E Automation", email: E2E_MEMBER_EMAIL, employeeId: "E2E-0001",
            isActive: true, teamRoleId: role.id,
        },
    });
    return { member, role };
}

export async function ensureHotelOwner() {
    const db = await getDb();
    return db.hotelOwner.upsert({
        where: { email: E2E_OWNER_EMAIL },
        update: { status: "ACTIVE" },
        create: {
            email: E2E_OWNER_EMAIL, password: "unused-e2e-mints-jwt-directly",
            name: "E2E Owner", businessName: "E2E Test Properties", status: "ACTIVE",
        },
    });
}

export async function ensureCustomerUser() {
    const db = await getDb();
    return db.user.upsert({
        where: { phone: E2E_CUSTOMER_PHONE },
        update: {},
        create: { phone: E2E_CUSTOMER_PHONE, name: "E2E Customer", role: "USER", status: "ACTIVE" },
    });
}

export async function dashboardCookie(): Promise<Cookie> {
    const { member, role } = await ensureDashboardMember();
    const token = {
        id: member.id, name: member.name, email: member.email,
        role: role.name, permissions: [], pageAccess: [], departmentId: null,
    };
    const jwt = await encode({ token, secret: process.env.AUTH_SECRET!, salt: DASHBOARD_COOKIE });
    return makeCookie(DASHBOARD_COOKIE, jwt, "/dashboard");
}

export async function hotelConnectCookie(): Promise<Cookie> {
    const owner = await ensureHotelOwner();
    const token = { id: owner.id, name: owner.name, email: owner.email, businessName: owner.businessName ?? "" };
    const jwt = await encode({ token, secret: process.env.AUTH_SECRET!, salt: HOTEL_CONNECT_COOKIE });
    return makeCookie(HOTEL_CONNECT_COOKIE, jwt, "/hotel-connect");
}

export async function customerCookie(): Promise<Cookie> {
    const user = await ensureCustomerUser();
    const token = {
        userId: user.id, phone: user.phone, role: user.role, status: user.status,
        isProfileComplete: user.isProfileComplete, name: user.name,
    };
    const jwt = await encode({ token, secret: process.env.AUTH_SECRET!, salt: CUSTOMER_COOKIE });
    return makeCookie(CUSTOMER_COOKIE, jwt, "/");
}
