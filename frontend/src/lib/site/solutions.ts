import { Building2, GraduationCap, HeartPulse, Landmark, Megaphone, Plane, ShoppingBag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Faq } from "./seo";

export type Solution = {
  slug: string;
  navLabel: string;
  icon: LucideIcon;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  h1: string;
  lead: string;
  challenges: { title: string; body: string }[];
  playbook: { title: string; body: string; feature: string }[];
  /** An illustrative conversation, shown as a chat mock-up. Not a customer story. */
  chat: { from: "customer" | "business"; text: string }[];
  chatCaption: string;
  features: string[];
  faqs: Faq[];
};

export const SOLUTIONS: Solution[] = [
  {
    slug: "ecommerce",
    navLabel: "E-commerce & D2C",
    icon: ShoppingBag,
    tagline: "Order updates, cart recovery and support on WhatsApp",
    metaTitle: "WhatsApp Automation for E-commerce & D2C Brands",
    metaDescription: "Send order confirmations and shipping updates, recover abandoned checkouts, answer product questions and collect payments on WhatsApp — connected to Shopify and WooCommerce.",
    keywords: ["WhatsApp for ecommerce", "Shopify WhatsApp automation", "WhatsApp order updates", "abandoned cart WhatsApp"],
    h1: "WhatsApp automation for online stores that want repeat customers",
    lead: "Customers open WhatsApp more often than email. Use it to confirm orders, keep shoppers informed, recover carts and answer the questions that stop a purchase.",
    challenges: [
      { title: "Where is my order?", body: "WISMO questions flood support. Automated status messages answer them before customers ask." },
      { title: "Abandoned checkouts", body: "Shoppers leave with items in the cart. A timely, helpful nudge on WhatsApp gets more of them back." },
      { title: "Cash-on-delivery risk", body: "Confirming COD orders on WhatsApp reduces returns-to-origin from orders nobody intended to accept." },
    ],
    playbook: [
      { title: "Connect your store", body: "Link Shopify or WooCommerce so order events arrive automatically.", feature: "integrations-api" },
      { title: "Map events to templates", body: "Order placed, shipped and delivered each send an approved utility template.", feature: "templates" },
      { title: "Recover carts", body: "Send a reminder after a wait step, and let the customer pay from a link in the chat.", feature: "payments" },
      { title: "Hand tricky chats to people", body: "Returns, damage and sizing go to the shared inbox with the order already attached.", feature: "shared-inbox" },
    ],
    chat: [
      { from: "business", text: "Hi Aditi, your order #1042 is packed and will ship today. Track it here: https://…" },
      { from: "customer", text: "Can I change the delivery address?" },
      { from: "business", text: "Sure — please send the new address and PIN code and we'll update it before dispatch." },
    ],
    chatCaption: "An illustrative order-support conversation.",
    features: ["integrations-api", "templates", "payments", "shared-inbox"],
    faqs: [
      { q: "Which store platforms can I connect?", a: "Shopify and WooCommerce have built-in event adapters. Any other platform can post events through the generic webhook or the REST API." },
      { q: "Can I send order updates without the customer messaging first?", a: "Yes, using approved utility templates. Customers should have opted in to receive WhatsApp updates from you." },
      { q: "Can customers pay for COD orders in advance?", a: "You can send a Razorpay payment link in the chat so customers can convert a COD order to prepaid." },
    ],
  },
  {
    slug: "real-estate",
    navLabel: "Real Estate",
    icon: Building2,
    tagline: "Qualify enquiries and schedule site visits automatically",
    metaTitle: "WhatsApp Automation for Real Estate Agents & Developers",
    metaDescription: "Qualify property enquiries by budget and location, share brochures, book site visits and track every lead through a sales pipeline on WhatsApp.",
    keywords: ["WhatsApp for real estate", "real estate lead qualification WhatsApp", "property enquiry automation", "site visit booking WhatsApp"],
    h1: "Reply to every property enquiry in seconds, not hours",
    lead: "Property leads go cold quickly. Answer instantly, ask the right qualifying questions and put serious buyers in front of your sales team with the details already collected.",
    challenges: [
      { title: "Speed to lead", body: "Buyers enquire with several brokers. The first one to answer usually wins the conversation." },
      { title: "Unqualified enquiries", body: "Sales teams waste time on people who are outside budget or location. Qualification should happen before a call." },
      { title: "Lost follow-ups", body: "Site visits get forgotten and warm leads fade without a structured pipeline." },
    ],
    playbook: [
      { title: "Capture from every source", body: "Ad clicks, the website widget and QR codes on hoardings all open the same WhatsApp conversation.", feature: "website-widget" },
      { title: "Qualify in a flow", body: "Ask budget, configuration and preferred location; tag hot leads and assign an agent.", feature: "chat-flow-builder" },
      { title: "Track every lead", body: "Each qualified enquiry becomes a deal with an owner and an expected close date.", feature: "sales-pipeline" },
      { title: "Collect the booking amount", body: "Send a payment link when a buyer is ready to reserve a unit.", feature: "payments" },
    ],
    chat: [
      { from: "customer", text: "Looking for a 2 BHK near Whitefield" },
      { from: "business", text: "Great! What's your approximate budget range? 1) Under ₹80L  2) ₹80L–1.2Cr  3) Above ₹1.2Cr" },
      { from: "customer", text: "2" },
      { from: "business", text: "Thanks. I'm sharing three matching projects and Rohan from our team will call you today." },
    ],
    chatCaption: "An illustrative lead-qualification conversation.",
    features: ["chat-flow-builder", "sales-pipeline", "website-widget", "payments"],
    faqs: [
      { q: "Can I share brochures and location pins?", a: "Yes. Flows can send images, videos and documents, and agents can attach files in the inbox." },
      { q: "Can leads from Facebook and Instagram ads come into the same inbox?", a: "Click-to-WhatsApp ad conversations arrive as normal chats, with the ad details saved on the contact." },
      { q: "How do I assign leads by project or city?", a: "Use assignment rules for round-robin, and flow steps or tags to route enquiries to the right person." },
    ],
  },
  {
    slug: "healthcare",
    navLabel: "Clinics & Healthcare",
    icon: HeartPulse,
    tagline: "Appointment reminders and patient queries, handled gently",
    metaTitle: "WhatsApp Automation for Clinics, Hospitals & Diagnostics",
    metaDescription: "Collect appointment requests, send reminders and share timings and fees on WhatsApp — with a shared inbox for your front desk and a clear hand-over to staff.",
    keywords: ["WhatsApp for clinics", "WhatsApp appointment reminders", "hospital WhatsApp automation", "diagnostic lab WhatsApp"],
    h1: "Fewer missed appointments, calmer front desks",
    lead: "Patients prefer to ask a quick question or confirm a slot on WhatsApp. Give them fast, consistent answers and keep your front desk focused on people who are in the clinic.",
    challenges: [
      { title: "No-shows", body: "Forgotten appointments cost time and revenue. Reminders on WhatsApp are seen and easy to answer." },
      { title: "Repetitive questions", body: "Timings, fees, doctors' availability and reports — the same questions all day." },
      { title: "Privacy", body: "Health conversations need care: limited access, clear opt-outs and no unnecessary data sharing." },
    ],
    playbook: [
      { title: "Answer FAQs instantly", body: "Auto-replies and the AI agent share timings, fees and directions from your own knowledge base.", feature: "ai-agent" },
      { title: "Book through a flow", body: "Collect name, preferred date and reason, then hand the request to the front desk.", feature: "chat-flow-builder" },
      { title: "Remind and follow up", body: "Send appointment reminders and post-visit follow-ups with approved templates.", feature: "broadcasts" },
      { title: "Collect consultation fees", body: "Send a payment link to confirm a booking or settle a bill.", feature: "payments" },
    ],
    chat: [
      { from: "business", text: "Reminder: your appointment with Dr. Mehta is tomorrow at 11:30 AM. Reply 1 to confirm or 2 to reschedule." },
      { from: "customer", text: "2" },
      { from: "business", text: "No problem. Which day works better this week? Our front desk will confirm shortly." },
    ],
    chatCaption: "An illustrative appointment-reminder conversation.",
    features: ["ai-agent", "chat-flow-builder", "broadcasts", "shared-inbox"],
    faqs: [
      { q: "Should I discuss medical details on WhatsApp?", a: "We recommend using WhatsApp for logistics — bookings, reminders, timings — and moving clinical discussion to a consultation. Follow your own professional and legal obligations." },
      { q: "Can multiple staff use one clinic number?", a: "Yes. The shared inbox lets reception and support staff work from one number with their own logins and roles." },
      { q: "Can patients opt out of reminders?", a: "Yes. Contacts who reply STOP are excluded from campaigns automatically." },
    ],
  },
  {
    slug: "education",
    navLabel: "Education & Coaching",
    icon: GraduationCap,
    tagline: "Admissions enquiries, fee reminders and batch updates",
    metaTitle: "WhatsApp Automation for Schools, Colleges & Coaching Institutes",
    metaDescription: "Handle admission enquiries, share course details, send fee and class reminders and collect payments on WhatsApp for schools, colleges and coaching classes.",
    keywords: ["WhatsApp for education", "admission enquiry WhatsApp", "coaching institute WhatsApp automation", "fee reminder WhatsApp"],
    h1: "Admissions and parent communication, without the phone tag",
    lead: "Prospective students and parents ask the same questions every season. Answer them instantly, follow up with the interested ones and keep enrolled families informed.",
    challenges: [
      { title: "Admission-season surges", body: "Enquiries arrive in bursts; a small team can't reply to all of them promptly by phone." },
      { title: "Fee collection", body: "Chasing dues by phone is slow and awkward. A polite reminder with a payment link is easier for everyone." },
      { title: "Batch communication", body: "Schedules, holidays and results need to reach the right group without a dozen forwarded messages." },
    ],
    playbook: [
      { title: "Answer with a flow", body: "Ask which course and city, share brochure and fees, and offer a counselling slot.", feature: "chat-flow-builder" },
      { title: "Segment by batch", body: "Tag students by course and batch, then broadcast to exactly the group that needs to know.", feature: "broadcasts" },
      { title: "Send fee links", body: "Use a payment link for admissions and instalments, recorded against the deal.", feature: "payments" },
      { title: "Follow up on leads", body: "Track applicants through stages from enquiry to enrolled.", feature: "sales-pipeline" },
    ],
    chat: [
      { from: "customer", text: "What is the fee for the JEE 2-year programme?" },
      { from: "business", text: "The 2-year JEE programme fee is shared in this brochure. Would you like to book a free counselling call?" },
      { from: "customer", text: "Yes, Saturday please" },
    ],
    chatCaption: "An illustrative admissions conversation.",
    features: ["chat-flow-builder", "broadcasts", "payments", "sales-pipeline"],
    faqs: [
      { q: "Can I message parents and students separately?", a: "Yes. Tag contacts by role, course or batch and target each group in a campaign." },
      { q: "Can I run admissions without technical staff?", a: "Yes. Flows, templates and campaigns are built in the dashboard without code." },
      { q: "Is there a limit on contacts?", a: "Limits depend on your plan and are listed on the pricing page." },
    ],
  },
  {
    slug: "restaurants",
    navLabel: "Restaurants & Food",
    icon: UtensilsCrossed,
    tagline: "Menus, reservations and repeat orders in one thread",
    metaTitle: "WhatsApp Automation for Restaurants, Cafes & Cloud Kitchens",
    metaDescription: "Share menus and timings automatically, take reservations and enquiries, send offers to regulars and collect advance payments on WhatsApp.",
    keywords: ["WhatsApp for restaurants", "restaurant reservation WhatsApp", "cloud kitchen WhatsApp orders", "WhatsApp menu"],
    h1: "Fill more tables and repeat orders, straight from WhatsApp",
    lead: "Regulars already message you. Make it effortless: instant menus and timings, easy reservations and offers that reach the customers who actually order.",
    challenges: [
      { title: "Peak-hour overload", body: "Staff can't answer chats while serving. Automation covers the routine questions." },
      { title: "Empty weekdays", body: "A well-timed offer to past customers fills quiet slots without discounting to everyone." },
      { title: "Party bookings", body: "Large bookings need details and often an advance — easy to lose in a busy chat." },
    ],
    playbook: [
      { title: "Keyword replies", body: "'Menu', 'timing' and 'location' answer instantly with links and photos.", feature: "auto-replies" },
      { title: "Reservation flow", body: "Collect date, time and party size, then notify the manager in Slack or the inbox.", feature: "chat-flow-builder" },
      { title: "Targeted offers", body: "Broadcast to customers tagged as regulars or who haven't ordered lately.", feature: "broadcasts" },
      { title: "Advance for parties", body: "Send a payment link to secure a large booking.", feature: "payments" },
    ],
    chat: [
      { from: "customer", text: "Menu" },
      { from: "business", text: "Here's our menu 🍽️ Open daily 12pm–11pm. Want to reserve a table? Reply BOOK." },
      { from: "customer", text: "BOOK" },
    ],
    chatCaption: "An illustrative menu and reservation conversation.",
    features: ["auto-replies", "chat-flow-builder", "broadcasts", "payments"],
    faqs: [
      { q: "Can I send my menu as a PDF or image?", a: "Yes. Auto-replies and flows can send images, videos and documents, or a link to an online menu." },
      { q: "Can I take orders on WhatsApp?", a: "Yes. Use a flow with buttons and lists to collect an order, then hand it over to staff and collect payment with a link." },
      { q: "How do I avoid spamming customers?", a: "Send only to customers who have opted in, keep offers relevant and honour opt-outs, which the platform handles automatically." },
    ],
  },
  {
    slug: "agencies",
    navLabel: "Agencies & Consultants",
    icon: Megaphone,
    tagline: "Run WhatsApp for several clients with clean separation",
    metaTitle: "WhatsApp Automation for Marketing Agencies & Consultants",
    metaDescription: "Offer WhatsApp automation to your clients: separate workspaces, shared templates, reporting and payments — and grow a recurring service line.",
    keywords: ["WhatsApp for agencies", "WhatsApp reseller", "WhatsApp automation agency", "manage WhatsApp for clients"],
    h1: "Add WhatsApp automation to your agency's services",
    lead: "Clients want WhatsApp but not the setup. Deliver flows, campaigns and reporting on a platform built for teams, with each client's data kept separate.",
    challenges: [
      { title: "Client separation", body: "Every client needs their own numbers, contacts and templates — never mixed together." },
      { title: "Repeatable delivery", body: "You need proven flows and templates you can adapt quickly, not a rebuild each time." },
      { title: "Proving value", body: "Clients want reports that show conversations, response times and revenue." },
    ],
    playbook: [
      { title: "One workspace per client", body: "Each client gets an isolated workspace with its own number, team and billing.", feature: "shared-inbox" },
      { title: "Adapt proven flows", body: "Start from templates and flow presets, then customise for each brand.", feature: "chat-flow-builder" },
      { title: "Report clearly", body: "Use conversation analytics and campaign reports in client reviews.", feature: "analytics" },
      { title: "Join the partner programme", body: "Partner benefits and a dedicated contact for agencies.", feature: "integrations-api" },
    ],
    chat: [
      { from: "business", text: "Hi! This is Bloom Salon 💇 Would you like to book a slot this week?" },
      { from: "customer", text: "Yes, Friday evening" },
      { from: "business", text: "Booked for Friday 6:00 PM. We'll send a reminder the day before." },
    ],
    chatCaption: "An illustrative client booking flow an agency might build.",
    features: ["shared-inbox", "chat-flow-builder", "analytics", "integrations-api"],
    faqs: [
      { q: "Can I manage several client businesses?", a: "Yes. A person can belong to several workspaces, and each workspace keeps its data separate." },
      { q: "Do you have a partner programme?", a: "Yes. See the partners page to apply." },
      { q: "Who owns the client's contacts?", a: "The client's workspace holds their data. Contracts between you and your client determine who administers it." },
    ],
  },
  {
    slug: "financial-services",
    navLabel: "Financial Services",
    icon: Landmark,
    tagline: "Reminders, KYC follow-ups and payments with an audit trail",
    metaTitle: "WhatsApp Automation for Lending, Insurance & Financial Services",
    metaDescription: "Send payment reminders, collect documents, follow up on applications and take payments on WhatsApp — with conversation history and role-based access.",
    keywords: ["WhatsApp for financial services", "WhatsApp payment reminder", "loan follow-up WhatsApp", "insurance renewal WhatsApp"],
    h1: "Follow-ups that customers actually see — with a record of each one",
    lead: "Renewals, EMI dues and document requests all need a nudge. WhatsApp gets opened and answered, and every message is logged for your team.",
    challenges: [
      { title: "Overdue follow-ups", body: "Phone calls go unanswered. A clear message with a payment link is easier to act on." },
      { title: "Document collection", body: "Customers can send photos and PDFs in the same chat instead of emailing them." },
      { title: "Compliance", body: "Teams need consistent wording, access control and a history of what was said." },
    ],
    playbook: [
      { title: "Scheduled reminders", body: "Send renewal and due-date templates on time using scheduled campaigns.", feature: "broadcasts" },
      { title: "Collect payments", body: "Attach a Razorpay link to each reminder so customers can pay immediately.", feature: "payments" },
      { title: "Structured intake", body: "Use a flow to gather details and route applications to the right person.", feature: "chat-flow-builder" },
      { title: "Role-based access", body: "Owners, admins, agents and viewers see and do only what they should.", feature: "shared-inbox" },
    ],
    chat: [
      { from: "business", text: "Your policy renews on 30 Sep. Renew now to stay covered: https://…" },
      { from: "customer", text: "Paid just now" },
      { from: "business", text: "Thanks! We've received your payment and will email the receipt." },
    ],
    chatCaption: "An illustrative renewal-reminder conversation.",
    features: ["broadcasts", "payments", "chat-flow-builder", "shared-inbox"],
    faqs: [
      { q: "Is WhatsApp allowed for collections?", a: "Use it only for customers who have consented and follow the regulations and WhatsApp policies that apply to your business and product." },
      { q: "Can I keep a record of conversations?", a: "Every message is stored in the conversation history, visible to authorised team members." },
      { q: "Can I restrict who sees what?", a: "Yes. Roles limit access; viewers are read-only, and only owners and admins manage settings and billing." },
    ],
  },
  {
    slug: "travel-hospitality",
    navLabel: "Travel & Hospitality",
    icon: Plane,
    tagline: "Quotes, itineraries and booking updates in one chat",
    metaTitle: "WhatsApp Automation for Travel Agencies, Hotels & Tour Operators",
    metaDescription: "Capture travel enquiries, send itineraries and quotes, confirm bookings and share updates on WhatsApp — with payment links for deposits.",
    keywords: ["WhatsApp for travel agents", "hotel WhatsApp booking", "tour operator WhatsApp automation", "itinerary WhatsApp"],
    h1: "From 'how much for Goa?' to a paid booking, in one thread",
    lead: "Travel decisions are made in conversation. Capture the details once, share quotes quickly and keep guests informed before, during and after their trip.",
    challenges: [
      { title: "Long quote cycles", body: "Travellers compare options. Quick, clear quotes keep you in the running." },
      { title: "Deposits", body: "Confirming a booking often depends on collecting an advance quickly." },
      { title: "Changes on the go", body: "Guests message with changes and questions at all hours." },
    ],
    playbook: [
      { title: "Capture the trip", body: "Ask destination, dates and group size; tag the lead and assign an agent.", feature: "chat-flow-builder" },
      { title: "Track quotes", body: "Each enquiry is a deal moving from quote sent to confirmed.", feature: "sales-pipeline" },
      { title: "Take the deposit", body: "Send a payment link and let the deal record the payment.", feature: "payments" },
      { title: "Keep guests informed", body: "Booking confirmations and pre-trip reminders go out with templates.", feature: "templates" },
    ],
    chat: [
      { from: "customer", text: "Goa for 4 people, 3 nights in December?" },
      { from: "business", text: "Lovely! Which dates and what budget per person? I'll send two options within the hour." },
      { from: "customer", text: "20–23 Dec, around ₹15k" },
    ],
    chatCaption: "An illustrative enquiry conversation.",
    features: ["chat-flow-builder", "sales-pipeline", "payments", "templates"],
    faqs: [
      { q: "Can I send PDF itineraries?", a: "Yes. Agents can attach documents in the inbox and flows can send documents automatically." },
      { q: "Can I assign enquiries by destination?", a: "Yes. Use tags and assignment rules, or route inside a flow." },
      { q: "Can guests get reminders before their trip?", a: "Yes. Use scheduled campaigns or flow steps with approved templates." },
    ],
  },
];

export const solutionBySlug = (slug: string) => SOLUTIONS.find((s) => s.slug === slug);
