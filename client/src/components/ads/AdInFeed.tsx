import { PublicAdSense } from "./AdSenseSlot";

/** Legacy wrapper: solo renderiza si VITE_ADSENSE_CLIENT está configurado. */
export default function LegacyAd(props: { slot?: string; className?: string }) {
  return <PublicAdSense className={props.className} />;
}
