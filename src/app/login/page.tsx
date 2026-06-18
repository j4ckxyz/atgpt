import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen place-items-center px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <LoginForm />
    </main>
  );
}
