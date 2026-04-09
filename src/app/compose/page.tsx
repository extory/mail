import { EmailComposer } from "@/components/email-composer";

export default function ComposePage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Compose Email</h1>
      <p className="text-gray-600 mb-6">
        Describe what you want to send and AI will generate the email for you.
      </p>
      <EmailComposer />
    </div>
  );
}
