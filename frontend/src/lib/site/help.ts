import type { Faq } from "./seo";

export type HelpCategory = { id: string; title: string; blurb: string; faqs: Faq[] };

export const HELP: HelpCategory[] = [
  {
    id: "account",
    title: "Account & getting started",
    blurb: "Sign-up, workspaces, trials and your team.",
    faqs: [
      { q: "How do I create an account?", a: "Go to the sign-up page and enter your name, work email, company name and a password. Your workspace and a free trial are created immediately." },
      { q: "How long is the free trial?", a: "New workspaces start with a free trial with limits that are enough to try every feature. The trial end date is shown in Settings → Plan & billing." },
      { q: "What happens when my trial ends?", a: "Your workspace moves to the free plan with lower limits. Your data is kept, and you can choose a paid plan at any time to restore higher limits." },
      { q: "How do I invite a teammate?", a: "Open Settings → Team, enter their email and choose a role. They receive an invitation link (or you can copy the link yourself if email isn't configured)." },
      { q: "I forgot my password.", a: "Use 'Forgot password' on the login page. We email a reset link that works once and expires shortly after." },
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp number & messaging",
    blurb: "Connecting a number, the 24-hour window and message delivery.",
    faqs: [
      { q: "Can I use my existing WhatsApp number?", a: "A number can be used with the Cloud API if it isn't currently registered in the consumer WhatsApp app or the WhatsApp Business app, or after you remove it from there. Using a new number is often simplest." },
      { q: "Why can't I send a normal message to a customer?", a: "WhatsApp only allows free-form messages within 24 hours of the customer's last message. Outside that window, send an approved template." },
      { q: "Why did a message fail?", a: "Open the message in the inbox to see the reason from WhatsApp — for example the number isn't on WhatsApp, the customer opted out, or a limit was reached." },
      { q: "Are my messages end-to-end encrypted?", a: "Messages sent through the WhatsApp Business Platform are encrypted in transit. Because your business software processes the messages, they are stored so your team can read them. See our privacy policy for details." },
    ],
  },
  {
    id: "templates",
    title: "Templates & campaigns",
    blurb: "Approvals, variables, audiences and reports.",
    faqs: [
      { q: "Why is my template still pending?", a: "Meta reviews templates and timing varies. The status updates automatically when Meta responds; you can also sync from the Templates page." },
      { q: "Can I edit a template after it's approved?", a: "Meta limits changes to approved templates. Create a new version if you need bigger edits." },
      { q: "Who receives my campaign?", a: "The audience you choose, minus anyone who has opted out. The preview before sending shows how many will receive it and how many were skipped." },
      { q: "How do I stop a campaign that is running?", a: "Open the campaign and choose Pause or Cancel. Messages already sent can't be recalled." },
    ],
  },
  {
    id: "automation",
    title: "Flows, replies & AI",
    blurb: "Automating conversations safely.",
    faqs: [
      { q: "Why isn't my flow running?", a: "Check that it's published (not a draft), that its trigger matches the message, and that the contact isn't inside a cooldown for that flow." },
      { q: "Why did automation stop in a conversation?", a: "When a person replies from the inbox, automation for that conversation pauses so the customer isn't answered twice. Resume it from the conversation." },
      { q: "How do I improve AI answers?", a: "Add or edit knowledge sources: FAQs, text and web pages. Review conversations, note the questions it couldn't answer and add them to the knowledge base." },
      { q: "Does the AI use my data to train models?", a: "The AI feature sends the conversation context needed to answer to Anthropic's API. See the privacy policy for what is shared and how it's handled." },
    ],
  },
  {
    id: "billing",
    title: "Plans, payments & invoices",
    blurb: "Paying for LeadForGrow and collecting payments from customers.",
    faqs: [
      { q: "How do I upgrade?", a: "Open Settings → Plan & billing, choose a plan and billing period, add your business details and pay online with UPI, card or netbanking through Razorpay." },
      { q: "Is GST included in the price?", a: "Prices are shown before GST. 18% GST is added at checkout, and your invoice shows the breakup — CGST and SGST for in-state customers, IGST otherwise." },
      { q: "Can I get a GST invoice with my GSTIN?", a: "Yes. Add your business name, address and GSTIN under Billing details before paying, and it appears on the invoice." },
      { q: "Does my plan renew automatically?", a: "No. Plans are prepaid for the period you choose and don't auto-debit. We email you before the plan ends so you can renew." },
      { q: "What if I change plan mid-period?", a: "The unused time on your current plan is credited toward the new one, and the credit is shown before you pay." },
      { q: "How do I collect payments from my own customers?", a: "Connect your own Razorpay account in Settings → Payments, then send payment links from chats or deals. Money settles directly into your Razorpay account." },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & security",
    blurb: "Where data lives and who can access it.",
    faqs: [
      { q: "Who can see my conversations?", a: "Members of your workspace according to their role. Access by LeadForGrow staff is restricted and used only to run the service or to help with a support request you make." },
      { q: "How do I delete my data?", a: "Contact us from the email on your account and we'll delete your workspace and the data in it, subject to legal retention requirements such as tax invoices." },
      { q: "How do you protect credentials?", a: "WhatsApp tokens, AI keys and payment keys are encrypted at rest. Passwords are hashed and never stored in plain text." },
    ],
  },
];

export const allHelpFaqs = () => HELP.flatMap((c) => c.faqs.map((f) => ({ ...f, category: c.title })));
