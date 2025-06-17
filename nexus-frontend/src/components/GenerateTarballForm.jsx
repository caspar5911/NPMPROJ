import React, { useState } from 'react';
import { fetchPackageVersions, packNpmPackage } from '../services/api';

function GenerateTarballForm({ setPackedTarballs, fetchAllTarballs, setSelectedTarball }) {
  const [genStatus, setGenStatus] = useState('');
  const [form, setForm] = useState({ repoUrl: '', packageName: '', version: '' });
  const [availableVersions, setAvailableVersions] = useState([]);
  const [currentPackage, setCurrentPackage] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fetchVersions = async () => {
    const pkg = form.packageName.trim();
    if (!pkg) {
      setGenStatus('Please enter a package name first.');
      return;
    }
    setGenStatus('Fetching versions...');
    try {
      const versions = await fetchPackageVersions(pkg);
      setAvailableVersions(versions);
      setCurrentPackage(pkg);
      setForm((prev) => ({ ...prev, version: '' }));
      setGenStatus(`Found ${versions.length} versions.`);
    } catch (err) {
      setAvailableVersions([]);
      setCurrentPackage('');
      setSelectedTarball?.('');
      setGenStatus('Error fetching versions: ' + err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchVersions();
    }
  };

  const handleNpmPack = async () => {
    if (!form.packageName.trim() || !form.version.trim()) {
      setGenStatus('Package name and version are required.');
      return;
    }
    setGenStatus('Packing package...');
    try {
      const tarballPath = await packNpmPackage(form.packageName.trim(), form.version.trim());
      setPackedTarballs((prev) => (!prev.includes(tarballPath) ? [...prev, tarballPath] : prev));
      await fetchAllTarballs();
      setGenStatus(`Package packed successfully: ${tarballPath}`);
    } catch (err) {
      setGenStatus('Error: ' + err.message);
    }
  };

  return (
    <section style={{ outline: '1px solid #ccc', padding: 16 }}>
      <h2>📦 Generate Tarball for Specific NPM Package</h2>

      {/* Package Input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ flex: 1 }}>
          NPM Package Name:
          <input
            type="text"
            name="packageName"
            value={form.packageName}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="e.g. express"
            required
          />
        </label>
        <button type="button" onClick={fetchVersions}>
          Search Versions
        </button>
      </div>

      {/* Version Dropdown */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          marginBottom: 12,
        }}
      >
        <label style={{ flex: 1 }}>
          NPM Version {currentPackage ? `(${currentPackage})` : ''}:
          <input
            type="text"
            name="version"
            value={form.version}
            onChange={handleChange}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={
              availableVersions.length === 0
                ? 'Search or input a package first'
                : 'Select a version'
            }
            autoComplete="off"
            required
            style={{ width: '100%' }}
          />
          {showDropdown && availableVersions.length > 0 && (
            <ul
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: 150,
                overflowY: 'auto',
                border: '1px solid #ccc',
                backgroundColor: '#fff',
                zIndex: 1000,
                listStyle: 'none',
                padding: 0,
                margin: 0,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                borderRadius: 4,
              }}
            >
              {availableVersions
                .filter((v) => v.includes(form.version.trim()))
                .map((ver) => (
                  <li
                    key={ver}
                    onMouseDown={() => {
                      setForm((prev) => ({ ...prev, version: ver }));
                      setShowDropdown(false);
                    }}
                    style={{
                      padding: 8,
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    {ver}
                  </li>
                ))}
            </ul>
          )}
        </label>

        <button type="button" onClick={handleNpmPack} style={{ float: 'right' }}>
          Generate Tarball
        </button>
      </div>

      {/* Status Message */}
      <div
        style={{
          fontWeight: 'bold',
          whiteSpace: 'pre-wrap',
          minHeight: '1.5em',
          color: 'blue',
          marginTop: 12,
        }}
      >
        {genStatus}
      </div>
    </section>
  );
}

export default GenerateTarballForm;
