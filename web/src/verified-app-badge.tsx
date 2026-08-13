import React from "react";
import { Check } from "lucide-react";

export function VerifiedAppBadge() {
  return (
    <span className="discord-verified-app-badge" aria-label="Verifizierte Discord-App">
      <Check size={10} aria-hidden="true" />
      <b>APP</b>
    </span>
  );
}
