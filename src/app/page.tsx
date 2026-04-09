import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Mail Service</h1>
      <p className="text-gray-600 mb-8">
        AI-powered newsletter and email sending service
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/subscribers"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">👥</div>
          <h2 className="font-semibold mb-1">Subscribers</h2>
          <p className="text-sm text-gray-500">
            Manage your subscriber list. Add, remove, or import from CSV.
          </p>
        </Link>

        <Link
          href="/compose"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">✍️</div>
          <h2 className="font-semibold mb-1">Compose</h2>
          <p className="text-sm text-gray-500">
            Generate email content with AI and send to your subscribers.
          </p>
        </Link>

        <Link
          href="/history"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">📋</div>
          <h2 className="font-semibold mb-1">History</h2>
          <p className="text-sm text-gray-500">
            View past emails and their delivery status.
          </p>
        </Link>
      </div>
    </div>
  );
}
