"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const isSignIn = flow === "signIn";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isSignIn ? "Entrar no console" : "Criar sua conta"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {isSignIn
            ? "Acesse o painel para acompanhar as conversas e os disparos."
            : "Crie uma conta para começar a usar o console."}
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
              toast.success(isSignIn ? "Sessão iniciada" : "Conta criada");
            })
            .catch((error) => {
              // Named causes over a generic failure: "algo deu errado" gives the
              // person nothing to act on.
              let message: string;
              if (error.message.includes("Invalid password")) {
                message = "Senha incorreta. Tente novamente.";
              } else if (error.message.includes("User already exists")) {
                message = "Já existe uma conta com este email. Entre em vez de criar.";
              } else if (error.message.includes("User not found")) {
                message = "Nenhuma conta encontrada com este email. Crie uma conta.";
              } else {
                message = isSignIn
                  ? "Não foi possível entrar. Confira o email e a senha."
                  : "Não foi possível criar a conta. Tente novamente.";
              }
              toast.error(message);
              setSubmitting(false);
            });
        }}
      >
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Senha
          </label>
          <Input
            id="password"
            type="password"
            name="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            placeholder={isSignIn ? "Sua senha" : "Crie uma senha"}
            required
            minLength={isSignIn ? undefined : 8}
            aria-describedby={isSignIn ? undefined : "password-hint"}
          />
          {!isSignIn && (
            <p id="password-hint" className="text-xs text-muted-foreground mt-1">
              Mínimo de 8 caracteres.
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? isSignIn
              ? "Entrando..."
              : "Criando conta..."
            : isSignIn
              ? "Entrar"
              : "Criar conta"}
        </Button>
      </form>

      <div className="text-center mt-6">
        <span className="text-sm text-muted-foreground">
          {isSignIn ? "Ainda não tem conta? " : "Já tem uma conta? "}
        </span>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm font-medium"
          onClick={() => setFlow(isSignIn ? "signUp" : "signIn")}
        >
          {isSignIn ? "Criar conta" : "Entrar"}
        </Button>
      </div>
    </div>
  );
}
