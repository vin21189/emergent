import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowRight, Search, FileText } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HistoryPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/search-history`);
      setSearches(response.data);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load search history");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (searches.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Name", "Email", "Hospital", "PubMed Topic", "Country", "Confidence", 
      "Is Doctor", "Specialty", "Public Profile", "Date"
    ];
    const rows = searches.map(s => [
      s.name,
      s.email,
      s.hospital,
      s.pubmed_topic,
      s.predicted_country,
      `${s.confidence_score}%`,
      s.is_doctor ? 'Yes' : 'No',
      s.specialty || 'Not specified',
      s.public_profile_url || 'Not available',
      new Date(s.timestamp).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geomed-hcp-searches-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export complete!");
  };

  const exportToExcel = async () => {
    if (searches.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const response = await axios.get(`${API}/export-history-excel`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `geomed-hcp-history-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel export complete!");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel file");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="history-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl sm:text-5xl font-light text-foreground mb-3" style={{ letterSpacing: '-0.02em' }}>
              Search History
            </h1>
            <p className="text-base text-muted-foreground font-medium">
              {searches.length} {searches.length === 1 ? 'search' : 'searches'} completed
            </p>
          </div>
          {searches.length > 0 && (
            <div className="flex gap-4">
              <button
                onClick={exportToExcel}
                className="primary-button flex items-center gap-2"
                data-testid="export-excel-button"
              >
                <FileText size={18} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={exportToCSV}
                className="px-6 py-3 border-2 border-border text-foreground font-semibold rounded-sm hover:border-primary transition-colors duration-300 flex items-center gap-2"
                data-testid="export-csv-button"
              >
                <FileText size={18} />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>

        {searches.length === 0 ? (
          <div className="history-card bg-white p-16 text-center" data-testid="no-searches-message">
            <Search size={64} className="text-muted-foreground mx-auto mb-6" />
            <h3 className="text-xl font-black text-foreground mb-3">No Searches Yet</h3>
            <p className="text-muted-foreground mb-8">Start by searching for a healthcare professional</p>
            <Link to="/" className="primary-button inline-block" data-testid="start-search-button">
              Start Searching
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="history-grid">
            {searches.map((search, index) => (
              <Link
                key={search.id}
                to={`/result/${search.id}`}
                className="history-card bg-white p-6 hover:shadow-lg transition-all duration-300 stagger-enter"
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`history-item-${search.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-base font-black text-foreground mb-1">{search.name}</h3>
                    <p className="text-xs text-muted-foreground font-medium">{search.hospital}</p>
                    {search.specialty && (
                      <p className="text-xs text-primary font-semibold mt-1">{search.specialty}</p>
                    )}
                  </div>
                  <ArrowRight size={20} className="text-muted-foreground" />
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-black text-primary mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {search.predicted_country}
                    </div>
                    <div className="text-xs text-muted-foreground font-semibold">
                      {search.confidence_score.toFixed(0)}% CONFIDENCE
                    </div>
                  </div>

                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill" 
                      style={{ width: `${search.confidence_score}%` }}
                    ></div>
                  </div>

                  <div className="text-xs text-muted-foreground font-medium">
                    {new Date(search.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}