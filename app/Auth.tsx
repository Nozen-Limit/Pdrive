import { useEffect, useRef } from "react";
// Keep the original login document isolated from workspace styles.
export function Auth({
  onSignedIn,
  recovering,
}: {
  onSignedIn: () => Promise<void>;
  recovering: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const authenticated = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== "sikap:authenticated"
      )
        return;
      if (event.data.recovered)
        history.replaceState(null, "", location.pathname);
      void onSignedIn();
    };
    window.addEventListener("message", authenticated);
    return () => window.removeEventListener("message", authenticated);
  }, [onSignedIn]);
  return (
    <iframe
      key={recovering ? "recovery" : "login"}
      ref={frame}
      title="Project SIKAP school account"
      src={`${import.meta.env.BASE_URL}original-login/index.html`}
      style={{
        display: "block",
        border: 0,
        width: "100%",
        height: "100dvh",
        background: "#101720",
      }}
    />
  );
}
