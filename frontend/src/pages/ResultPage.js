import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Globe, Mail, Building2, BookOpen, UserCheck, Stethoscope, ExternalLink } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResultPage() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResult();
  }, [id]);

  const fetchResult = async () => {
    try {
      const response = await axios.get(`${API}/search-history/${id}`);
      setResult(response.data);
    } catch (error) {
      console.error("Error fetching result:", error);
      toast.error("Failed to load result");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="result-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center" data-testid="result-not-found">
          <h2 className="text-2xl font-black text-foreground mb-4">Result Not Found</h2>
          <Link to="/" className="primary-button inline-block" data-testid="back-home-button">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        {/* Back Button */}
        <Link
          to="/history"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-300 mb-12"
          data-testid="back-to-history-link"
        >
          <ArrowLeft size={18} />
          <span>Back to History</span>
        </Link>

        {/* Result Card */}
        <div className="result-card bg-white p-12 mb-8" data-testid="result-card">
          {/* Header */}
          <div className="flex items-start justify-between mb-12">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle size={32} className="text-success" />
                <h1 className="text-3xl font-black text-foreground">Country Identified</h1>
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Analysis completed on {new Date(result.timestamp).toLocaleString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Country & Confidence */}
          <div className="bg-primary/5 p-8 rounded-sm mb-12" data-testid="prediction-summary">
            <div className="flex items-center gap-6 mb-6">
              <Globe size={48} className="text-primary" />
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-2">LOCATION</div>
                <div className="text-5xl font-light text-foreground" style={{ letterSpacing: '-0.02em' }} data-testid="predicted-country">
                  {result.predicted_country}
                </div>
                {result.city && (
                  <div className="text-xl text-muted-foreground mt-2 font-medium" data-testid="predicted-city">
                    {result.city}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-muted-foreground">CONFIDENCE SCORE</span>
                <span className="text-lg font-black text-primary" style={{ fontFamily: 'JetBrains Mono, monospace' }} data-testid="confidence-score">
                  {result.confidence_score.toFixed(1)}%
                </span>
              </div>
              <div className="confidence-bar h-3">
                <div 
                  className="confidence-fill" 
                  style={{ width: `${result.confidence_score}%` }}
                  data-testid="confidence-bar"
                ></div>
              </div>
            </div>

            {result.reasoning && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="text-sm font-semibold text-muted-foreground mb-2">REASONING</div>
                <p className="text-base text-foreground leading-relaxed" data-testid="reasoning-text">{result.reasoning}</p>
              </div>
            )}
          </div>

          {/* Professional Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="result-card bg-white p-6" data-testid="doctor-verification">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
                  <UserCheck size={20} className="text-primary" />
                </div>
                <div className="text-sm font-semibold text-muted-foreground">MEDICAL DOCTOR</div>
              </div>
              <div className="text-2xl font-black text-foreground">
                {result.is_doctor ? 'Verified ✓' : 'Not Verified'}
              </div>
            </div>

            <div className="result-card bg-white p-6" data-testid="specialty-info">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
                  <Stethoscope size={20} className="text-primary" />
                </div>
                <div className="text-sm font-semibold text-muted-foreground">SPECIALTY</div>
              </div>
              <div className="text-xl font-black text-foreground">
                {result.specialty || 'Not specified'}
              </div>
            </div>

            <div className="result-card bg-white p-6" data-testid="profile-link">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
                  <ExternalLink size={20} className="text-primary" />
                </div>
                <div className="text-sm font-semibold text-muted-foreground">PUBLIC PROFILE</div>
              </div>
              {result.public_profile_url ? (
                <a 
                  href={result.public_profile_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-primary hover:underline flex items-center gap-2"
                >
                  View Profile <ExternalLink size={16} />
                </a>
              ) : (
                <div className="text-base text-muted-foreground">Not available</div>
              )}
            </div>
          </div>

          {/* Input Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div data-testid="detail-name">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
                  <Mail size={16} className="text-primary" />
                </div>
                NAME
              </div>
              <div className="text-base font-medium text-foreground">{result.name}</div>
            </div>

            <div data-testid="detail-email">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
                  <Mail size={16} className="text-primary" />
                </div>
                EMAIL
              </div>
              <div className="text-base font-medium text-foreground">{result.email}</div>
            </div>

            <div data-testid="detail-hospital">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
                  <Building2 size={16} className="text-primary" />
                </div>
                HOSPITAL AFFILIATION
              </div>
              <div className="text-base font-medium text-foreground">{result.hospital}</div>
            </div>

            <div data-testid="detail-pubmed-topic">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
                  <BookOpen size={16} className="text-primary" />
                </div>
                PUBMED TOPIC
              </div>
              <div className="text-base font-medium text-foreground">{result.pubmed_topic}</div>
            </div>
          </div>

          {/* Data Sources */}
          <div data-testid="data-sources">
            <div className="text-sm font-semibold text-muted-foreground mb-4">DATA SOURCES ANALYZED</div>
            <div className="flex flex-wrap gap-3">
              {result.sources.map((source, index) => (
                <div
                  key={index}
                  className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-sm"
                  data-testid={`source-${index}`}
                >
                  {source}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link to="/" className="primary-button" data-testid="new-search-button">
            New Search
          </Link>
          <Link
            to="/history"
            className="px-8 py-3 border-2 border-border text-foreground font-semibold rounded-sm hover:border-primary transition-colors duration-300"
            data-testid="view-all-history-button"
          >
            View All Searches
          </Link>
        </div>
      </div>
    </div>
  );
}