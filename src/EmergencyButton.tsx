import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  Clock3,
  LocateFixed,
  ShieldCheck,
  Siren,
} from "lucide-react";

type Phase = "idle" | "holding" | "armed" | "sent";

interface AlertContext {
  location: string;
  incident: string;
  risk: string;
}

function AlertConfirmation({
  location,
  incident,
  risk,
  onClose,
}: AlertContext & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [seconds, setSeconds] = useState(240);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (seconds === 0) return;
    const countdown = setTimeout(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(countdown);
  }, [seconds]);

  return (
    <dialog
      ref={dialog}
      className="police-confirmation"
      aria-labelledby="police-alert-title"
      aria-describedby="police-demo-notice"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <span className="police-demo-badge" id="police-demo-notice">
        DEMO / No real dispatch
      </span>
      <ShieldCheck
        className="police-confirmation-icon"
        size={52}
        aria-hidden="true"
      />
      <h2 id="police-alert-title">Police alerted</h2>
      <div className="police-shared-location">
        <LocateFixed size={18} />
        <span>
          Your location shared <strong>{location}</strong>
        </span>
        <CheckCheck size={20} />
      </div>
      <div className="police-incident">
        <Siren size={18} />
        <span>{incident}</span>
        <b>{risk} risk</b>
      </div>
      <section
        className="police-eta"
        aria-label="Simulated police arrival estimate"
      >
        <span>
          <Clock3 size={16} /> Estimated police arrival
        </span>
        <strong>
          {seconds === 240
            ? "ETA: 4 min"
            : `ETA: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </strong>
        <progress
          max={240}
          value={240 - seconds}
          aria-label="Simulated arrival progress"
        />
        <small>
          {seconds === 0
            ? "Demo ETA elapsed / No real dispatch"
            : "Simulated countdown"}
        </small>
      </section>
      <span className="police-privacy">
        Location + incident metadata only / No identity shared
      </span>
      <button className="police-return" onClick={onClose} autoFocus>
        <ArrowLeft size={18} />
        Return to Map
      </button>
    </dialog>
  );
}

export default function EmergencyButton({
  location,
  incident,
  risk,
}: AlertContext) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [taps, setTaps] = useState(0);
  const phaseRef = useRef<Phase>("idle");
  const tapRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<"idle" | "armed" | null>(null);
  const suppressClick = useRef(false);

  function transition(value: Phase) {
    phaseRef.current = value;
    setPhase(value);
  }
  function clearTimer() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }
  function reset() {
    setConfirmationOpen(false);
    clearTimer();
    holdOrigin.current = null;
    tapRef.current = 0;
    setTaps(0);
    transition("idle");
  }

  useEffect(() => {
    const cancel = () => {
      if (phaseRef.current !== "sent") reset();
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearTimer();
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  function begin() {
    if (phaseRef.current === "holding") return;
    suppressClick.current = false;
    if (phaseRef.current === "idle") {
      holdOrigin.current = "idle";
      suppressClick.current = true;
      transition("holding");
      timer.current = setTimeout(() => {
        timer.current = null;
        transition("armed");
      }, 3000);
    } else if (phaseRef.current === "armed") {
      holdOrigin.current = "armed";
      timer.current = setTimeout(() => {
        reset();
        suppressClick.current = true;
      }, 1200);
    }
  }

  function release() {
    clearTimer();
    if (holdOrigin.current === "idle") {
      suppressClick.current = true;
      if (phaseRef.current === "holding") reset();
    }
    holdOrigin.current = null;
  }

  function activate() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (phaseRef.current === "sent") {
      reset();
      return;
    }
    if (phaseRef.current !== "armed") return;
    tapRef.current += 1;
    setTaps(tapRef.current);
    if (tapRef.current === 3) {
      transition("sent");
      setConfirmationOpen(true);
    }
  }

  const title =
    phase === "sent"
      ? "Alert sent"
      : phase === "armed"
        ? `Confirm alert ${taps}/3`
        : phase === "holding"
          ? "Keep holding..."
          : "Alert campus police";
  const detail =
    phase === "sent"
      ? "Location shared (demo) / Tap to reset"
      : phase === "armed"
        ? "Tap 3 times / Hold to cancel"
        : phase === "holding"
          ? "Release to cancel"
          : "Hold 3 seconds / Location + metadata";

  return (
    <footer className="emergency-dock">
      {confirmationOpen && (
        <AlertConfirmation
          location={location}
          incident={incident}
          risk={risk}
          onClose={() => setConfirmationOpen(false)}
        />
      )}
      <button
        className={`emergency-button emergency-${phase}`}
        data-phase={phase}
        aria-label="Alert campus police"
        title={
          phase === "armed"
            ? "Tap three times to confirm; hold to cancel or press Escape"
            : `Demo alert / ${location}`
        }
        onPointerDown={(event) => {
          if (event.button !== 0 || event.isPrimary === false) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          begin();
        }}
        onPointerUp={release}
        onPointerCancel={() => {
          reset();
          suppressClick.current = true;
        }}
        onLostPointerCapture={() => {
          if (phaseRef.current === "holding") reset();
        }}
        onClick={activate}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          if (!event.repeat) begin();
        }}
        onKeyUp={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          release();
          activate();
        }}
      >
        {phase === "holding" && <span className="hold-progress" />}
        {phase === "sent" ? <CheckCheck size={23} /> : <Siren size={23} />}
        <span className="emergency-copy">
          <strong>{title}</strong>
          <small>{detail}</small>
        </span>
        {phase === "armed" ? (
          <span className="tap-count" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <i key={index} className={index < taps ? "complete" : ""} />
            ))}
          </span>
        ) : phase === "sent" ? (
          <LocateFixed size={19} />
        ) : (
          <span className="hold-duration">3s</span>
        )}
      </button>
      <span className="emergency-note" role="status">
        {phase === "sent"
          ? `${location} / No real dispatch`
          : "DEMO / No real dispatch"}
      </span>
      <span className="route-accessible-summary" role="status">
        {title}. {detail}.
      </span>
    </footer>
  );
}
