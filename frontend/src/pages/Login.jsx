import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.access_token && data.user) {
        // Purani session information clear karo
        localStorage.removeItem("lifecue_token");
        localStorage.removeItem("lifecue_user");

        // JWT authentication token save karo
        localStorage.setItem("lifecue_token", data.access_token);

        // User ki basic information save karo
        localStorage.setItem(
          "lifecue_user",
          JSON.stringify({
            name: data.user.name,
            email: data.user.email,
          })
        );

        // Dashboard par jao
        navigate("/dashboard", { replace: true });
      } else {
        setMessage(
          data.message ||
            data.detail ||
            "Login failed. Please check your email and password."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage(
        "Backend connection failed. Please check whether the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B18] text-white flex items-center justify-center px-6 py-10 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-[-180px] left-[-150px] w-[450px] h-[450px] bg-violet-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-180px] right-[-120px] w-[450px] h-[450px] bg-blue-500/20 rounded-full blur-[120px]" />

      <div className="relative w-full max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
        {/* Left Section */}
        <div className="hidden lg:block px-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <span className="text-xl font-bold">L</span>
            </div>

            <span className="text-2xl font-semibold tracking-tight">
              LifeCue
            </span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight">
            Your day.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Your direction.
            </span>
          </h1>

          <p className="mt-7 text-lg text-slate-400 max-w-lg leading-8">
            Plan your tasks, build better habits, focus on what matters,
            and understand your progress — all in one place.
          </p>

          <div className="flex flex-wrap gap-3 mt-9">
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
              ✦ Smart Planning
            </span>

            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
              ◉ Focus Sessions
            </span>

            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
              ↗ Progress Tracking
            </span>
          </div>

          <div className="mt-12 border-l-2 border-violet-500/50 pl-5">
            <p className="text-slate-500 text-sm">
              Remember → Plan → Focus → Track → Review → Improve
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/30">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                <span className="font-bold">L</span>
              </div>

              <span className="text-xl font-semibold">LifeCue</span>
            </div>

            <div className="mb-8">
              <p className="text-violet-400 text-sm font-medium mb-2">
                Welcome back
              </p>

              <h2 className="text-3xl font-bold tracking-tight">
                Sign in to LifeCue
              </h2>

              <p className="text-slate-400 mt-2 text-sm">
                Continue where you left off.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Email address
                </label>

                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 outline-none transition focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "Password reset feature abhi available nahi hai."
                      )
                    }
                    className="text-xs text-violet-400 hover:text-violet-300 transition"
                  >
                    Forgot password?
                  </button>
                </div>

                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 outline-none transition focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 accent-violet-500"
                />

                <label
                  htmlFor="remember"
                  className="text-sm text-slate-400"
                >
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 font-semibold transition-all duration-300 shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {message && (
              <p
                role="status"
                aria-live="polite"
                className="mt-5 text-center text-sm text-violet-300 break-words"
              >
                {message}
              </p>
            )}

            <div className="flex items-center gap-4 my-7">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() =>
                setMessage("Google sign-in abhi configure nahi hua hai.")
              }
              className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center gap-3 text-sm font-medium"
            >
              <span className="text-lg">G</span>
              Continue with Google
            </button>

            <p className="text-center text-sm text-slate-500 mt-7">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-violet-400 hover:text-violet-300 font-medium transition"
              >
                Create account
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            © 2026 LifeCue · Plan better. Live better.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;