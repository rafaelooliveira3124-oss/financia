import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./components/ui/button";
export class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    return this.state.failed ? (
      <div className="access-screen">
        <section className="panel access-card" role="alert">
          <h1>Não foi possível abrir esta tela</h1>
          <p>
            Recarregue para retomar o acesso e consultar o estado salvo da sua carteira.
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar o site
          </Button>
        </section>
      </div>
    ) : (
      this.props.children
    );
  }
}
