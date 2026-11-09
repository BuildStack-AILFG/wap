import LegalPage, { legalMetadata } from "@/components/site/LegalPage";
import type { Block } from "@/lib/site/seo";

export const metadata = legalMetadata("data-deletion");

// Meta's data-deletion callback sends people here with ?code=<confirmation code> to check their request.
export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const raw = (await searchParams).code;
  const code = typeof raw === "string" && /^TFG-[A-F0-9]{12}$/.test(raw) ? raw : null;
  const lead: Block[] | undefined = code
    ? [{ type: "callout", tone: "info", title: `Request ${code} received`, text: "We received your Facebook data deletion request. TalkForGrow does not store Facebook profile data, so there is nothing more to remove from your Facebook account. To also delete WhatsApp data held in a TalkForGrow workspace, follow the steps below." }]
    : undefined;
  return <LegalPage slug="data-deletion" lead={lead} />;
}
