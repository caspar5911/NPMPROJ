import React, { useState } from 'react';
import { uploadPackageJson } from '../services/api';

function UploadPackageJsonForm({ fetchAllTarballs, setPackedTarballs }) {
  const [selectedPackageJsonFile, setSelectedPackageJsonFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handlePackageJsonFileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedPackageJsonFile(file);
    setStatus(file ? `Selected file: ${file.name}` : 'No file selected');
  };

  const handleUploadPackageJsonClick = async () => {
    if (!selectedPackageJsonFile) {
      setStatus('Please select a package.json file first.');
      return;
    }

    setUploading(true);
    setStatus('Uploading package.json and installing dependencies...');

    try {
      const data = await uploadPackageJson(selectedPackageJsonFile);

      // Append newly packed tarballs to existing state
      const newTarballs = data.results
        .map((result) => result.tarballPath)
        .filter(Boolean); // Skip undefined/null

      if (newTarballs.length > 0) {
        setPackedTarballs((prev) => {
          const combined = [...prev, ...newTarballs];
          return Array.from(new Set(combined)); // Remove duplicates
        });
      }

      await fetchAllTarballs();

      setStatus(data.message || 'Dependencies installed and packages packed successfully.');
      // setSelectedPackageJsonFile(null);
    } catch (err) {
      setStatus('Upload error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ outline: '1px solid #ccc', padding: 16, marginTop: 24 }}>
      <h2>📦 Generate Tarballs via package.json</h2>
      <div style={{ marginBottom: 16 }}>
        <label>
          Upload package.json
          <div className="input-group">
            <input
              type="file"
              accept=".json"
              onChange={handlePackageJsonFileSelect}
              disabled={uploading}
              style={{ width: '68%', padding: 6, marginTop: 4 }}
              name="packageJson"
            />
            <button
              type="button"
              onClick={handleUploadPackageJsonClick}
              disabled={uploading || !selectedPackageJsonFile}
              style={{ marginLeft: 8 }}
            >
              Upload
            </button>
          </div>
        </label>
        {status && <p style={{ marginTop: 8, color: 'blue' }}>{status}</p>}
      </div>
    </div>
  );
}

export default UploadPackageJsonForm;
