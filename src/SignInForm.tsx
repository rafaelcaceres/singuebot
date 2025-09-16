"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {flow === "signIn" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-gray-600 mt-2">
          {flow === "signIn" 
            ? "Sign in to your account to continue" 
            : "Sign up to get started with our platform"
          }
        </p>
      </div>
      
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData)
            .then(() => {
              toast.success(
                flow === "signIn" 
                  ? "Successfully signed in!" 
                  : "Account created successfully!"
              );
            })
            .catch((error) => {
              let toastTitle = "";
              if (error.message.includes("Invalid password")) {
                toastTitle = "Invalid password. Please try again.";
              } else if (error.message.includes("User already exists")) {
                toastTitle = "An account with this email already exists. Try signing in instead.";
              } else if (error.message.includes("User not found")) {
                toastTitle = "No account found with this email. Try signing up instead.";
              } else {
                toastTitle =
                  flow === "signIn"
                    ? "Could not sign in. Please check your credentials."
                    : "Could not create account. Please try again.";
              }
              toast.error(toastTitle);
              setSubmitting(false);
            });
        }}
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            className="auth-input-field w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            type="email"
            name="email"
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            className="auth-input-field w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            type="password"
            name="password"
            placeholder={flow === "signIn" ? "Enter your password" : "Create a password"}
            required
            minLength={flow === "signUp" ? 8 : undefined}
          />
          {flow === "signUp" && (
            <p className="text-xs text-gray-500 mt-1">
              Password must be at least 8 characters long
            </p>
          )}
        </div>
        
        <button 
          className="auth-button w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
          type="submit" 
          disabled={submitting}
        >
          {submitting 
            ? (flow === "signIn" ? "Signing in..." : "Creating account...") 
            : (flow === "signIn" ? "Sign in" : "Create account")
          }
        </button>
      </form>
      
      <div className="text-center mt-6">
        <span className="text-sm text-gray-600">
          {flow === "signIn"
            ? "Don't have an account? "
            : "Already have an account? "}
        </span>
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
        >
          {flow === "signIn" ? "Sign up" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
