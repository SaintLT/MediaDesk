import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-fog-500">The page you asked for does not exist or you do not have access to it.</p>
      <Link to="/dashboard" className="mt-6 inline-block text-sm font-medium text-electric-300 hover:text-electric-400">Back to the dashboard</Link>
    </div>
  );
}
