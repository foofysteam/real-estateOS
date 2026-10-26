import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTelLink, toWaLink } from "@/lib/phone";

/** 44 px "Call" button that dials the lead. */
export function CallLink({ phone }: { phone: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={toTelLink(phone)}>
        <Phone aria-hidden="true" />
        Call
      </a>
    </Button>
  );
}

/** 44 px "WhatsApp" button that opens a chat with the lead in a new tab. */
export function WhatsAppLink({ phone }: { phone: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={toWaLink(phone)} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" />
        WhatsApp
      </a>
    </Button>
  );
}
