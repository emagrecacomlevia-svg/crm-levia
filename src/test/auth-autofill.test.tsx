import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const calls = vi.hoisted(() => ({ signIn: vi.fn(), activate: vi.fn() }));
vi.mock("@/modules/identity/auth.functions", () => ({
  signInFn: calls.signIn,
  activatePasswordFn: calls.activate,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));
import { Route as LoginRoute } from "@/routes/login";
import { Route as ActivateRoute } from "@/routes/activate";
const Login = LoginRoute.options.component as ComponentType;
const Activate = ActivateRoute.options.component as ComponentType;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("mobile password-manager autofill", () => {
  it("submits displayed credentials when autofill does not fire React change events", async () => {
    calls.signIn.mockResolvedValue({ ok: false, message: "Synthetic rejection" });
    render(<Login />);
    const email = screen.getByLabelText("E-mail") as HTMLInputElement;
    const password = screen.getByLabelText("Senha") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "old@example.invalid" } });
    fireEvent.change(password, { target: { value: "old-password" } });
    email.value = "new@example.invalid";
    password.value = "new-password-with spaces ";
    fireEvent.submit(email.form!);
    await waitFor(() =>
      expect(calls.signIn).toHaveBeenCalledWith({
        data: {
          email: "new@example.invalid",
          password: "new-password-with spaces ",
        },
      }),
    );
  });
  it("uses the visible new password for recovery and clears the private fragment", async () => {
    window.history.replaceState(null, "", "/activate#type=recovery&access_token=aaa.bbb.ccc");
    calls.activate.mockResolvedValue({ ok: true, message: "Synthetic success" });
    render(<Activate />);
    const password = screen.getByLabelText("Nova senha") as HTMLInputElement;
    const confirmation = screen.getByLabelText("Confirmar senha") as HTMLInputElement;
    password.value = "new-synthetic-password";
    confirmation.value = "new-synthetic-password";
    fireEvent.submit(password.form!);
    await waitFor(() =>
      expect(calls.activate).toHaveBeenCalledWith({
        data: {
          credential: { kind: "access", value: "aaa.bbb.ccc" },
          password: "new-synthetic-password",
        },
      }),
    );
    expect(window.location.hash).toBe("");
    expect(await screen.findByRole("status")).toHaveTextContent("Synthetic success");
  });
  it("does not submit mismatched autofilled recovery passwords", () => {
    window.history.replaceState(null, "", "/activate#type=recovery&access_token=aaa.bbb.ccc");
    render(<Activate />);
    const password = screen.getByLabelText("Nova senha") as HTMLInputElement;
    const confirmation = screen.getByLabelText("Confirmar senha") as HTMLInputElement;
    password.value = "new-synthetic-password";
    confirmation.value = "different-synthetic-password";
    fireEvent.submit(password.form!);
    expect(calls.activate).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("As senhas devem ser iguais.");
  });
});
