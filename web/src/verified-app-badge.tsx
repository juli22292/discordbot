import React from "react";
import { BadgeCheck } from "lucide-react";

export function VerifiedAppBadge() {
  return (
    <span className="discord-verified-app-badge" aria-label="Verifizierte Discord-App">
      <BadgeCheck size={11} aria-hidden="true" />
      <b>APP</b>
    </span>
  );
}
