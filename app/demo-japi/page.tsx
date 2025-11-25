// app/demo-japi/page.tsx
import TopAnnouncement from "../components/TopAnnouncement";
import Header from "../components/Header";
import SubHeaderStrip from "../components/SubHeaderStrip";
import HeroFeatured from "../components/HeroFeatured";
import CurrentIssueSection from "../components/CurrentIssueSection";

export default function DemoJapiPage() {
  return (
    <>
      <TopAnnouncement />
      <Header />
      <SubHeaderStrip />
      <main>
        <HeroFeatured />
        <CurrentIssueSection />
      </main>
      <footer className="border-t text-center text-sm text-gray-500 py-6">
        © {new Date().getFullYear()} Demo · All rights reserved.
      </footer>
    </>
  );
}
