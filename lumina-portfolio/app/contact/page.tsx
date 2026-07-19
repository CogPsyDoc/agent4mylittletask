"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Field, TextArea } from "@/components/Field";
import { site } from "@/site.config";

const { contact } = site;

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const endpoint: string = contact.formEndpoint;
    if (endpoint.trim()) {
      // A form endpoint (e.g. Formspree) is configured — actually send it.
      const data = new FormData(e.currentTarget);
      await fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
    }
    // No endpoint configured → just show the thank-you state.
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      <section className="pt-16 md:pt-[128px] grid grid-cols-1 gap-16 md:grid-cols-12">
        {/* Left column — invitation + details */}
        <div className="md:col-span-5">
          <p className="label-caps text-on-surface-variant">{contact.eyebrow}</p>
          <h1 className="type-display mt-6 text-on-surface">{contact.headline}</h1>
          <p className="type-body-lg mt-8 max-w-md">{contact.intro}</p>

          <dl className="mt-12 space-y-6">
            {contact.details.map((d, i) => (
              <div key={i} className="border-t border-outline-variant/40 pt-4">
                <dt className="label-caps text-on-surface-variant">{d.label}</dt>
                <dd className="type-body-lg text-on-surface mt-1">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right column — form */}
        <div className="md:col-span-6 md:col-start-7">
          {sent ? (
            <div className="border border-outline-variant/60 p-10">
              <p className="type-headline-sm text-on-surface">Thank you.</p>
              <p className="type-body-md mt-3">
                Your message is on its way. I&rsquo;ll be in touch shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
                <Field label="Name" name="name" placeholder="Your name" required />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="you@studio.com"
                  required
                />
              </div>
              <Field
                label="Project type"
                name="project"
                placeholder="Editorial, commission, print…"
              />
              <TextArea
                label="Message"
                name="message"
                placeholder="Tell me about the work"
                rows={5}
                required
              />
              <Button type="submit" variant="solid">
                Send enquiry
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
