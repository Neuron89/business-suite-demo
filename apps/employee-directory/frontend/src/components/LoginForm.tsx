import type { FormEvent } from "react";
import { useState } from "react";

type LoginFormProps = {
  onSubmit: (values: { username: string; password: string }) => Promise<void>;
  submitting: boolean;
  errorMessage: string | null;
};

function LoginForm({ onSubmit, submitting, errorMessage }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ username, password });
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <p>Enter your administrator credentials to access the dashboard.</p>
      {errorMessage ? <div className="inline-error">{errorMessage}</div> : null}
      <label>
        Username
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default LoginForm;


