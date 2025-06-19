import React, { useState, useEffect } from 'react';
import { publishTarball, publishAllTarballs } from '../services/api';

export default function TarballPublisher({ allTarballs, selectedTarball, setSelectedTarball }) {
  const [status, setStatus] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  useEffect(() => {
    const savedUrl = localStorage.getItem('repoUrl');
    if (savedUrl) setRepoUrl(savedUrl);
  }, []);

  useEffect(() => {
    localStorage.setItem('repoUrl', repoUrl);
  }, [repoUrl]);

  if (allTarballs.length === 0) return null;

  const isValidUrl = (urlString) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const handlePublishTarball = async (e) => {
    e.preventDefault();
    if (!selectedTarball) {
      setStatus('Please select a tarball to publish.');
      return;
    }
    if (!isValidUrl(repoUrl)) {
      setStatus('Please enter a valid Nexus repository URL.');
      return;
    }

    setStatus('Publishing tarball to Nexus...');
    try {
      const output = await publishTarball(selectedTarball, repoUrl.trim());
      setStatus(`Publish successful: ${output}`);
      setSelectedTarball('');
    } catch (err) {
      setStatus('Publish error: ' + err.message);
    }
  };

  const handlePublishAllTarballs = async (e) => {
    e.preventDefault();
    if (!isValidUrl(repoUrl)) {
      setStatus('Please enter a valid Nexus repository URL.');
      return;
    }

    setStatus('Publishing all tarballs to Nexus...');
    try {
      const results = await publishAllTarballs(repoUrl.trim());
      const successCount = results.filter((r) => r.status === 'success').length;
      const errorCount = results.filter((r) => r.status === 'error').length;
      const messages = results.map((r) =>
        r.status === 'success'
          ? `✅ ${r.tarball} — Success`
          : `❌ ${r.tarball} — Failed: ${r.error}`
      );
      setStatus(
        `Publish All Completed: ${successCount} succeeded, ${errorCount} failed.\n\n` +
          messages.join('\n')
      );
      setSelectedTarball('');
    } catch (err) {
      setStatus('Publish All error: ' + err.message);
    }
  };

  return (
    <div style={{ outline: '1px solid #ccc', padding: 16, marginTop: 24, marginBottom:10 }}>
      <section style={{ marginTop: 24 }}>
        <h2>📦 Upload .tgz Files to Custom NPM Registry</h2>
        <p>
          Select a tarball generated from <code>npm pack</code> and publish it to your custom Nexus or NPM-compatible registry.
        </p>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Nexus Repository URL:
          <input
            name="repoUrl"
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="http://localhost:8081/repository/npm-hosted/"
            required
            style={{ width: '97.7%', padding: 6, marginTop: 4 }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Select Tarball to Publish:
          <select
            value={selectedTarball}
            onChange={(e) => setSelectedTarball(e.target.value)}
            style={{ width: '100%', padding: 6, marginTop: 4 }}
          >
            <option value="">-- Select a tarball --</option>
            {allTarballs.map((path) => (
              <option key={path} value={path}>
                {path.split('/').pop().split('\\').pop()}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: '12px', marginBottom: 16 }}>
          <button onClick={handlePublishTarball} type="button" style={{ flex: 1 }}>
            Publish Selected Tarball
          </button>
          <button onClick={handlePublishAllTarballs} type="button" style={{ flex: 1 }}>
            Publish All Tarballs
          </button>
        </div>

        <div style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap', minHeight: '1.5em' }}>{status}</div>
      </section>
    </div>
  );
}
