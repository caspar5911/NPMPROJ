import { useState } from 'react';
import './App.css';

function App() {
  const [form, setForm] = useState({
    repoUrl: '',
    packageName: '',
    version: '',
  });
  const [status, setStatus] = useState('');
  const [tarballPaths, setTarballPaths] = useState([]);
  const [selectedTarball, setSelectedTarball] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const isValidUrl = (urlString) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const handleNpmPack = async (e) => {
    e.preventDefault();

    if (!form.packageName.trim()) {
      setStatus('Please enter a package name to pack.');
      return;
    }

    setStatus('Packing package...');

    try {
      const body = {
        packageName: form.packageName.trim(),
        version: form.version.trim(),
      };

      const res = await fetch('http://localhost:4000/api/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setTarballPaths((prev) => {
          if (!prev.includes(data.tarballPath)) {
            return [...prev, data.tarballPath];
          }
          return prev;
        });
        setStatus(`Package packed successfully: ${data.tarballPath || ''}`);
      } else {
        setStatus(`Error packing package: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  const handlePublishTarball = async (e) => {
    e.preventDefault();

    if (!selectedTarball) {
      setStatus('Please select a tarball to publish.');
      return;
    }

    if (!isValidUrl(form.repoUrl)) {
      setStatus('Please enter a valid Nexus repository URL.');
      return;
    }

    setStatus('Publishing tarball to Nexus...');

    try {
      const res = await fetch('http://localhost:4000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarballPath: selectedTarball,
          registryUrl: form.repoUrl.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`Publish successful: ${data.output || ''}`);
        setTarballPaths([]); // clear tarballs after publishing
        setSelectedTarball('');
      } else {
        setStatus(`Publish error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setStatus('Publish error: ' + error.message);
    }
  };

  return (
    <div className="container">
      <h1>NPM Package to Nexus Uploader</h1>
      <form>
        <label>
          NPM Package Name (for pack):
          <input
            type="text"
            name="packageName"
            value={form.packageName}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          NPM Version (optional):
          <input
            type="text"
            name="version"
            value={form.version}
            onChange={handleChange}
            placeholder="e.g. 1.0.0"
          />
        </label>

        <button onClick={handleNpmPack} type="button">
          NPM Pack (from public npm)
        </button>

        <hr />

        <label>
          Nexus Repository URL:
          <input
            type="url"
            name="repoUrl"
            value={form.repoUrl}
            onChange={handleChange}
            placeholder="https://nexus.example.com/repository/npm-hosted/"
            required
          />
        </label>

        {tarballPaths.length > 0 && (
          <>
            <label>
              Select Tarball to Publish:
              <select
                value={selectedTarball}
                onChange={(e) => setSelectedTarball(e.target.value)}
              >
                <option value="">-- Select a tarball --</option>
                {tarballPaths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={handlePublishTarball} type="button">
              Publish Selected Tarball
            </button>
          </>
        )}
      </form>

      <p>{status}</p>

      {tarballPaths.length > 0 && (
        <div>
          <h3>Packed Tarballs:</h3>
          <ul>
            {tarballPaths.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
