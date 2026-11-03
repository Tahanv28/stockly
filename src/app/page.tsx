import Link from "next/link";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui";
import { IconBell, IconDownload, IconQr, IconScan, IconUpload, IconUsers } from "@/components/icons";
import { getSession } from "@/lib/session";

const features = [
  { icon: IconScan, title: "Scan with your phone", text: "Barcodes and QR codes with the camera you already have. Bluetooth and USB scanners work too — included, not an upgrade." },
  { icon: IconQr, title: "Print your own QR labels", text: "Label shelves, bins, vans and tools. Scan a label to see and update the item instantly." },
  { icon: IconBell, title: "Low-stock alerts", text: "Set a level per item and see everything that needs reordering in one list." },
  { icon: IconUsers, title: "Your whole team", text: "Everyone sees the same live stock. Full history of who changed what, and when." },
  { icon: IconUpload, title: "Switch from Sortly in minutes", text: "Upload your Sortly CSV export. Folders, quantities, barcodes and custom fields come across automatically." },
  { icon: IconDownload, title: "Your data stays yours", text: "Export everything to CSV any time. No item caps holding your data hostage." },
];

export default async function Landing() {
  const session = await getSession();
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {session ? (
            <LinkButton href="/app">Open Stockly</LinkButton>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-ink">
                Log in
              </Link>
              <LinkButton href="/signup">Start free</LinkButton>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 md:pt-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
            The Sortly alternative without the price hikes
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Know what you have, where it is, and when to reorder.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-neutral-600">
            Simple inventory for small businesses, trades and teams. Track stock, tools and equipment from your
            phone — with no item limits and no surprise renewals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="lg">
              Start free
            </LinkButton>
            <LinkButton href="/signup" size="lg" variant="secondary">
              Import from Sortly
            </LinkButton>
          </div>
          <p className="mt-3 text-sm text-neutral-500">Free while in beta. No card needed.</p>
        </div>
      </section>

      <section className="border-t border-neutral-100 bg-neutral-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-neutral-200 bg-white p-6">
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-3xl bg-brand-800 px-6 py-12 text-center text-white md:px-12">
          <h2 className="text-2xl font-semibold md:text-3xl">Fair pricing, promised.</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            One simple monthly price. No caps on items, no paywalled scanning, no first-year discount that doubles at
            renewal.
          </p>
          <LinkButton href="/signup" size="lg" variant="secondary" className="mt-6">
            Create your free account
          </LinkButton>
        </div>
      </section>

      <footer className="border-t border-neutral-100 py-8 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} Stockly
      </footer>
    </div>
  );
}
