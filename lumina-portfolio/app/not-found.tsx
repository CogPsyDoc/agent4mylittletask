import { ButtonLink } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      <section className="section text-center">
        <p className="label-caps text-on-surface-variant">Error 404</p>
        <h1 className="type-display mt-6 text-on-surface">
          This frame is empty.
        </h1>
        <p className="type-body-lg mt-6 max-w-md mx-auto">
          The page you were looking for has moved or never existed.
        </p>
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/" variant="ghost">
            Return to the gallery
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
