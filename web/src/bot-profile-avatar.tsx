import React from "react";

export const BOT_PROFILE_IMAGE = "/modmail-manager-avatar.webp";

type BotProfileAvatarProps = {
  alt?: string;
  className?: string;
};

export function BotProfileAvatar({ alt = "", className = "" }: BotProfileAvatarProps) {
  return (
    <img
      className={`bot-profile-avatar ${className}`.trim()}
      src={BOT_PROFILE_IMAGE}
      alt={alt}
      draggable={false}
    />
  );
}
