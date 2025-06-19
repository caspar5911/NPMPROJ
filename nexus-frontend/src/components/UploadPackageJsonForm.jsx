import React, { useState } from 'react';
import { uploadPackageJson } from '../services/api';

function UploadPackageJsonForm({ fetchAllTarballs, setPackedTarballs, registryUrls }) {
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
      const data = await uploadPackageJson(selectedPackageJsonFile, registryUrls);

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
      setStatus('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ outline: '1px solid #ccc', padding: 16, marginTop: 24, marginBottom:10 }}>
      <h2>📦 Generate Tarballs via package.json</h2>
      <div>
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
        {status && <div
          style={{
            fontWeight: 'bold',
            whiteSpace: 'pre-wrap',
            minHeight: '1.5em',
            color: 'blue',
            marginTop: 12,
          }}
        >
          {status}
        </div>}
      </div>
    </div>
  );
}

export default UploadPackageJsonForm;
