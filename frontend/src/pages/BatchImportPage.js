import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BatchImportPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
      } else {
        toast.error("Please upload an Excel file (.xlsx or .xls)");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
      } else {
        toast.error("Please upload an Excel file (.xlsx or .xls)");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/batch-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResults(response.data);
      toast.success(`Batch processing complete! ${response.data.successful} records processed successfully.`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Failed to process batch upload");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ["Firstname", "Lastname", "Email ID", "Hospital Affiliation", "PubMed Article Title"],
      ["John", "Smith", "john.smith@stanford.edu", "Stanford Medical Center", "Cardiology"],
      ["Emma", "Wilson", "emma.wilson@royallondon.nhs.uk", "Royal London Hospital", "Oncology"],
      ["Hiroshi", "Tanaka", "hiroshi.t@tokyo-med.ac.jp", "Tokyo General Hospital", "Neuroscience"]
    ];

    const csvContent = template.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "geomed-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded!");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-light text-foreground mb-3" style={{ letterSpacing: '-0.02em' }}>
            Batch Import
          </h1>
          <p className="text-base text-muted-foreground font-medium">
            Upload an Excel file to process multiple healthcare professionals at once
          </p>
        </div>

        {/* Template Download */}
        <div className="stat-card bg-white p-6 mb-8" data-testid="template-section">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-foreground mb-2">Need a Template?</h3>
              <p className="text-sm text-muted-foreground">
                Download our Excel template with the correct column format
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-6 py-3 border-2 border-border text-foreground font-semibold rounded-sm hover:border-primary transition-colors duration-300"
              data-testid="download-template-button"
            >
              <Download size={18} />
              <span>Download Template</span>
            </button>
          </div>
        </div>

        {/* Required Columns Info */}
        <div className="stat-card bg-white p-6 mb-8" data-testid="columns-info">
          <h3 className="text-lg font-black text-foreground mb-4">Required Columns</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {['Firstname', 'Lastname', 'Email ID', 'Hospital Affiliation', 'PubMed Article Title'].map((col, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="text-sm text-foreground font-medium">{col}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upload Area */}
        <div
          className={`search-form-card bg-white p-12 mb-8 transition-all duration-300 ${
            dragActive ? 'border-2 border-primary border-dashed' : ''
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="upload-area"
        >
          <div className="text-center">
            <div className="w-16 h-16 rounded-sm bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <FileSpreadsheet size={32} className="text-primary" />
            </div>

            {!file ? (
              <>
                <h3 className="text-xl font-black text-foreground mb-3">Drop Excel File Here</h3>
                <p className="text-muted-foreground mb-6">or click to browse</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  data-testid="file-input"
                />
                <label
                  htmlFor="file-upload"
                  className="primary-button inline-flex items-center gap-2 cursor-pointer"
                  data-testid="browse-button"
                >
                  <Upload size={20} />
                  <span>Browse Files</span>
                </label>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 mb-6">
                  <FileSpreadsheet size={24} className="text-primary" />
                  <span className="text-lg font-semibold text-foreground" data-testid="selected-filename">{file.name}</span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="primary-button flex items-center gap-2"
                    data-testid="upload-button"
                  >
                    {uploading ? (
                      <>
                        <div className="loading-spinner"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>Process File</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setFile(null)}
                    disabled={uploading}
                    className="px-6 py-3 border-2 border-border text-foreground font-semibold rounded-sm hover:border-destructive hover:text-destructive transition-colors duration-300"
                    data-testid="remove-file-button"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-8" data-testid="results-section">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat-card bg-white p-6" data-testid="total-processed-card">
                <div className="text-sm font-semibold text-muted-foreground mb-2">TOTAL PROCESSED</div>
                <div className="text-3xl font-black text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {results.total_processed}
                </div>
              </div>
              <div className="stat-card bg-white p-6" data-testid="successful-card">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-success" />
                  <div className="text-sm font-semibold text-muted-foreground">SUCCESSFUL</div>
                </div>
                <div className="text-3xl font-black text-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {results.successful}
                </div>
              </div>
              <div className="stat-card bg-white p-6" data-testid="failed-card">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={16} className="text-destructive" />
                  <div className="text-sm font-semibold text-muted-foreground">FAILED</div>
                </div>
                <div className="text-3xl font-black text-destructive" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {results.failed}
                </div>
              </div>
            </div>

            {/* Errors */}
            {results.errors.length > 0 && (
              <div className="stat-card bg-white p-6" data-testid="errors-section">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={20} className="text-destructive" />
                  <h3 className="text-lg font-black text-foreground">Errors</h3>
                </div>
                <div className="space-y-2">
                  {results.errors.map((error, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground" data-testid={`error-${idx}`}>
                      <span className="font-semibold">Row {error.row}:</span> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Message */}
            {results.successful > 0 && (
              <div className="result-card bg-white p-6 text-center" data-testid="success-message">
                <CheckCircle size={48} className="text-success mx-auto mb-4" />
                <h3 className="text-xl font-black text-foreground mb-2">Batch Processing Complete!</h3>
                <p className="text-muted-foreground mb-6">
                  {results.successful} healthcare professionals have been processed and added to your search history.
                </p>
                <Link to="/history" className="primary-button inline-block" data-testid="view-results-button">
                  View Results in History
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}