import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      {/* Daybreak: warm coral light meeting a pale-blue sky */}
      <div
        className="pointer-events-none absolute -left-1/4 -top-1/3 h-[70vh] w-[70vh] rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--coral)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-1/3 -right-1/4 h-[70vh] w-[70vh] rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--primary)" }}
      />
      <LoginForm />
    </main>
  );
}
