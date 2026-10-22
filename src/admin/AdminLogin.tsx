import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { adminService, AdminUser } from "../services/adminService";
export const AdminLogin: React.FC<{
  onLoginSuccess: (user: AdminUser) => void;
}> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await adminService.login(username.trim(), password);
      if (user) onLoginSuccess(user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      className="min-h-[75vh] grid place-items-center bg-slate-50 p-4"
      dir="rtl"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-3xl border bg-white p-8 shadow-sm"
      >
        <ShieldCheck className="text-[#E06518]" size={36} />
        <h1 className="text-xl font-black text-[#55565A]">
          ورود مدیریت صنعت پیش
        </h1>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <label className="grid gap-2 text-sm">
          نام کاربری
          <input
            autoComplete="username"
            required
            className="rounded-xl border p-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          رمز عبور
          <input
            autoComplete="current-password"
            required
            type="password"
            className="rounded-xl border p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          disabled={loading}
          className="w-full rounded-xl bg-[#E06518] p-3 font-bold text-white disabled:opacity-50"
        >
          {loading ? "در حال بررسی…" : "ورود به مدیریت"}
        </button>
      </form>
    </div>
  );
};
