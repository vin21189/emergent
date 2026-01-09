import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import HistoryPage from "./pages/HistoryPage";
import ResultPage from "./pages/ResultPage";
import { Toaster } from "@/components/ui/sonner";
import { Search, Clock } from "lucide-react";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/result/:id" element={<ResultPage />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </div>
  );
}

export const Header = () => {
  return (
    <header className="header-glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
            <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center">
              <Search size={24} color="white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground" style={{ letterSpacing: '-0.02em' }}>GeoMed AI</h1>
              <p className="text-xs text-muted-foreground font-medium">Healthcare Professional Locator</p>
            </div>
          </Link>
          <nav className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors duration-300"
              data-testid="nav-search-link"
            >
              <Search size={20} />
              <span>Search</span>
            </Link>
            <Link
              to="/history"
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors duration-300"
              data-testid="nav-history-link"
            >
              <Clock size={20} />
              <span>History</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default App;