// app/types/member.ts
import { getCurrentMember } from "../(dashboard)/dashboard/(main)/lib/get-current-member";

export type CurrentMember = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;