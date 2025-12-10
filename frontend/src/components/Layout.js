import Sidebar from './ui/Sidebar';
import Disclaimer from './ui/Disclaimer';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Sidebar />
      <main className="ml-64 min-h-screen flex flex-col">
        <Disclaimer variant="banner" />
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
