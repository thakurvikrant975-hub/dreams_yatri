import { Section } from "./Section";
import Button from "@/app/components/ui/Button";

export function SecurityPanel() {
  return (
    <div className="space-y-5">
      <Section title="Login & Security" subtitle="Manage your password and connected accounts">
        <div className="space-y-4">
          {/* Password */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-100">
            <div>
              <p className="text-sm font-semibold text-primary">Password</p>
              <p className="text-xs text-[--text-muted]">Last changed 3 months ago</p>
            </div>
            <Button size="sm" variant="outline">Change Password</Button>
          </div>

          {/* Google SSO */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-neutral-100 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Google</p>
                <p className="text-xs text-[--text-muted]">Connected · karan@gmail.com</p>
              </div>
            </div>
            <Button size="sm" variant="outline">Disconnect</Button>
          </div>

          {/* 2FA */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-primary">Two-Factor Authentication</p>
              <p className="text-xs text-[--text-muted]">Add an extra layer of protection</p>
            </div>
            <Button size="sm">Enable 2FA</Button>
          </div>
        </div>
      </Section>
    </div>
  )
}