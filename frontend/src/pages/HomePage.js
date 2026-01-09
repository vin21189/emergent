import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Globe, Search, Building2, Mail, User, BookOpen } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HomePage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    hospital: "",
    pubmed_topic: ""
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.hospital || !formData.pubmed_topic) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/predict-country`, formData);
      toast.success("Country prediction complete!");
      navigate(`/result/${response.data.id}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.response?.data?.detail || "Failed to predict country");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Tetris Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Main Search Form - 8 columns */}
          <div className="md:col-span-8 search-form-card bg-white p-12" data-testid="search-form-container">
            <div className="mb-12">
              <h2 className="text-4xl sm:text-5xl font-light text-foreground mb-4" style={{ letterSpacing: '-0.02em' }}>
                Identify Healthcare Professionals Globally
              </h2>
              <p className="text-base text-muted-foreground font-medium leading-relaxed">
                Enter details below to discover the country of origin for any healthcare professional or researcher.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8" data-testid="search-form">
              <div>
                <label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <User size={18} />
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Dr. John Smith"
                  className="input-field w-full"
                  data-testid="input-name"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <Mail size={18} />
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john.smith@hospital.edu"
                  className="input-field w-full"
                  data-testid="input-email"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="hospital" className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <Hospital size={18} weight="duotone" />
                  Hospital Affiliation
                </label>
                <input
                  id="hospital"
                  name="hospital"
                  type="text"
                  value={formData.hospital}
                  onChange={handleChange}
                  placeholder="Massachusetts General Hospital"
                  className="input-field w-full"
                  data-testid="input-hospital"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="pubmed_topic" className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <BookOpen size={18} weight="duotone" />
                  PubMed Article Topic
                </label>
                <input
                  id="pubmed_topic"
                  name="pubmed_topic"
                  type="text"
                  value={formData.pubmed_topic}
                  onChange={handleChange}
                  placeholder="Cardiology, Oncology, Neuroscience"
                  className="input-field w-full"
                  data-testid="input-pubmed-topic"
                  disabled={loading}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="primary-button w-full flex items-center justify-center gap-3"
                  data-testid="submit-button"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Globe size={20} weight="bold" />
                      <span>Predict Country</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Info Cards - 4 columns */}
          <div className="md:col-span-4 space-y-8">
            {/* How it works */}
            <div className="stat-card bg-white p-8" data-testid="info-how-it-works">
              <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center mb-6">
                <MagnifyingGlass size={24} weight="duotone" className="text-primary" />
              </div>
              <h3 className="text-lg font-black text-foreground mb-3">How It Works</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We analyze PubMed publications, hospital affiliations, and email domains using AI to predict geographic origin with high accuracy.
              </p>
            </div>

            {/* Accuracy */}
            <div className="stat-card bg-white p-8" data-testid="info-accuracy">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="text-4xl font-black text-primary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>85%+</div>
                  <div className="text-xs text-muted-foreground font-semibold mt-1">ACCURACY RATE</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our AI model achieves over 85% accuracy by combining multiple data sources and institutional patterns.
              </p>
            </div>

            {/* Data Sources */}
            <div className="stat-card bg-white p-8" data-testid="info-data-sources">
              <h3 className="text-lg font-black text-foreground mb-4">Data Sources</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground font-medium">PubMed Database</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground font-medium">Email Domain Analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground font-medium">Hospital Name Patterns</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground font-medium">AI Pattern Recognition</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}