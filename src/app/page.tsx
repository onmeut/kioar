import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { HorizontalCards } from "@/components/marketing/horizontal-cards";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { LeadingBusinesses } from "@/components/marketing/leading-businesses";
import { CustomerStory } from "@/components/marketing/customer-story";
import { Integrations } from "@/components/marketing/integrations";
import { FinalCta } from "@/components/marketing/final-cta";
import { getCurrentViewer } from "@/lib/auth/session";

export default async function LandingPage() {
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect("/me");
  }

  return (
    <div className="bg-paper text-ink">
      <SiteHeader />

      <main>
        <Hero />
        <HorizontalCards />
        <FeatureGrid />
        <LeadingBusinesses />
        <CustomerStory />
        <Integrations />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}
